import { Permissions, webMethod } from "wix-web-module";
import { fetch } from "wix-fetch";
import { files } from 'wix-media.v2';
import { elevate } from 'wix-auth';
import { MediaType } from 'wix-media.v2';

const PIXELBIN_API_TOKEN = "3d1ee755-e8ed-48e5-82f7-e806572da33e";
const AUTH_HEADER = `Bearer ${Buffer.from(PIXELBIN_API_TOKEN).toString('base64')}`;
const SUBMIT_URL = 'https://api.pixelbin.io/service/platform/transformation/v1.0/predictions/wm/remove';

function buildMultipartBody(fields, boundary) {
    let body = '';
    for (const [key, value] of Object.entries(fields)) {
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
        body += `${value}\r\n`;
    }
    body += `--${boundary}--\r\n`;
    return body;
}

async function submitWatermarkRemoval(imageUrl) {
    const boundary = '----PixelbinBoundary' + Date.now();
    const fields = {
        'input.image': imageUrl,
        'input.mask': '',
        'input.rem_text': 'true',
        'input.rem_logo': 'true',
        'input.box1': '0_0_100_100',
        'input.box2': '0_0_0_0',
        'input.box3': '0_0_0_0',
        'input.box4': '0_0_0_0',
        'input.box5': '0_0_0_0'
    };

    const response = await fetch(SUBMIT_URL, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Authorization': AUTH_HEADER,
            'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: buildMultipartBody(fields, boundary)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Submit failed: HTTP ${response.status} - ${errText}`);
    }

    return await response.json();
}

async function pollForResult(getUrl, maxAttempts = 30, intervalMs = 3000) {
    for (let i = 0; i < maxAttempts; i++) {
        const response = await fetch(getUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': AUTH_HEADER
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Poll failed: HTTP ${response.status} - ${errText}`);
        }

        const data = await response.json();

        if (data.status === 'SUCCESS' || data.status === 'FAILURE') {
            return data;
        }

        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error('Polling timed out after ' + maxAttempts + ' attempts');
}

export const testWatermarkRemoval = webMethod(
    Permissions.Anyone,
    async () => {
        const testImages = [
            { kwRef: "SL-0099-5", url: "https://static.wixstatic.com/media/2fbbf4_b659d606f6c440bdba5be2c922874e06~mv2.png" },
            { kwRef: "1392125", url: "https://static.wixstatic.com/media/2fbbf4_c762e6d0c64f481b9e561aef6a8fd17c~mv2.jpg" }
        ];

        const results = [];

        for (const { kwRef, url } of testImages) {
            try {
                const submitResult = await submitWatermarkRemoval(url);
                const getUrl = submitResult.urls?.get;

                if (!getUrl) {
                    results.push({ kwRef, inputUrl: url, status: 'ERROR', error: 'No get URL returned', raw: submitResult });
                    continue;
                }

                const finalResult = await pollForResult(getUrl);

                results.push({
                    kwRef,
                    inputUrl: url,
                    status: finalResult.status,
                    outputUrl: finalResult.output?.[0] || null,
                    consumedCredits: finalResult.consumedCredits || 0
                });

            } catch (err) {
                results.push({ kwRef, inputUrl: url, status: 'ERROR', error: err.message });
            }
        }

        return { success: true, results };
    }
);

export const importTestResultsToWix = webMethod(
    Permissions.Anyone,
    async () => {
        const elevatedImport = elevate(files.bulkImportFile);

        const testResults = [
            { kwRef: "SL-0099-5", pixelbinUrl: "https://delivery.pixelbin.io/predictions/outputs/30d/wm/remove/01a015ef-41ba-7ddf-8ec7-8e59b8d54e68/result_0.png" },
            { kwRef: "1392125", pixelbinUrl: "https://delivery.pixelbin.io/predictions/outputs/30d/wm/remove/01a015ef-64c7-711a-afdc-730af4e5c274/result_0.jpeg" }
        ];

        const importRequests = testResults.map(t => ({ url: t.pixelbinUrl, mediaType: 'IMAGE' }));

        try {
            const result = await elevatedImport(/** @type {any} */ (importRequests));

            const output = result.results.map((res, i) => {
                if (!res.itemMetadata?.success) {
                    return { kwRef: testResults[i].kwRef, ok: false, error: res.itemMetadata?.error };
                }
                const file = res.item;
                return {
                    kwRef: testResults[i].kwRef,
                    ok: true,
                    fileId: file._id,
                    viewableUrl: `https://static.wixstatic.com/media/${file._id}`
                };
            });

            return { success: true, output };

        } catch (err) {
            return { success: false, error: err.message };
        }
    }
);