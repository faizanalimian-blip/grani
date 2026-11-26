import { Permissions, webMethod } from "wix-web-module";
import { fetch } from "wix-fetch";

const PIXELBIN_API_TOKEN = "3d1ee755-e8ed-48e5-82f7-e806572da33e";
const AUTH_HEADER = `Bearer ${Buffer.from(PIXELBIN_API_TOKEN).toString('base64')}`;
const DETECT_URL = 'https://api.pixelbin.io/service/platform/transformation/v1.0/predictions/wmc/detect';

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

async function submitDetection(imageUrl) {
    const boundary = '----PixelbinBoundary' + Date.now();
    const fields = {
        'input.image': imageUrl,
        'input.detect_text': 'false'
    };

    const response = await fetch(DETECT_URL, {
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

    throw new Error('Polling timed out');
}

export const testWatermarkDetection = webMethod(
    Permissions.Anyone,
    async () => {
        const testImages = [
            { kwRef: "SL-0099-5", url: "https://static.wixstatic.com/media/2fbbf4_b659d606f6c440bdba5be2c922874e06~mv2.png" },
            { kwRef: "1392125",   url: "https://static.wixstatic.com/media/2fbbf4_c762e6d0c64f481b9e561aef6a8fd17c~mv2.jpg" }
        ];

        const results = [];

        for (const { kwRef, url } of testImages) {
            try {
                const submitResult = await submitDetection(url);
                const getUrl = submitResult.urls?.get;

                if (!getUrl) {
                    results.push({ kwRef, status: 'ERROR', error: 'No get URL returned', raw: submitResult });
                    continue;
                }

                const finalResult = await pollForResult(getUrl);

                results.push({
                    kwRef,
                    status: finalResult.status,
                    fullOutput: finalResult,
                    consumedCredits: finalResult.consumedCredits || 0
                });

            } catch (err) {
                results.push({ kwRef, status: 'ERROR', error: err.message });
            }
        }

        return { success: true, results };
    }
);