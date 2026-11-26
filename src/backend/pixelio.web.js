import { Permissions, webMethod } from "wix-web-module";
import { fetch } from "wix-fetch";
import wixData from 'wix-data';
import { files } from 'wix-media.v2';
import { elevate } from 'wix-auth';

const PIXELBIN_API_TOKEN = "3d1ee755-e8ed-48e5-82f7-e806572da33e";
const AUTH_HEADER = `Bearer ${Buffer.from(PIXELBIN_API_TOKEN).toString('base64')}`;
const REMOVE_URL = 'https://api.pixelbin.io/service/platform/transformation/v1.0/predictions/wm/remove';
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

async function submitJob(url, fields) {
    const boundary = '----PixelbinBoundary' + Date.now();
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Authorization': AUTH_HEADER,
            'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: buildMultipartBody(fields, boundary)
    });
    if (!response.ok) throw new Error(`Submit failed: HTTP ${response.status} - ${await response.text()}`);
    return await response.json();
}

async function pollForResult(getUrl, maxAttempts = 20, intervalMs = 2500) {
    for (let i = 0; i < maxAttempts; i++) {
        const response = await fetch(getUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json', 'Authorization': AUTH_HEADER }
        });
        if (!response.ok) throw new Error(`Poll failed: HTTP ${response.status} - ${await response.text()}`);
        const data = await response.json();
        if (data.status === 'SUCCESS' || data.status === 'FAILURE') return data;
        await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error('Polling timed out');
}

async function detectWatermark(imageUrl) {
    const submit = await submitJob(DETECT_URL, { 'input.image': imageUrl, 'input.detect_text': 'false' });
    const final = await pollForResult(submit.urls.get);
    return final.output?.watermark === true;
}

async function removeWatermark(imageUrl) {
    const submit = await submitJob(REMOVE_URL, {
        'input.image': imageUrl, 'input.mask': '', 'input.rem_text': 'true', 'input.rem_logo': 'true',
        'input.box1': '0_0_100_100', 'input.box2': '0_0_0_0', 'input.box3': '0_0_0_0',
        'input.box4': '0_0_0_0', 'input.box5': '0_0_0_0'
    });
    const final = await pollForResult(submit.urls.get);
    return final.output?.[0] || null;
}

export const testFullWatermarkPipeline = webMethod(
    Permissions.Anyone,
    async () => {
        const MAX_MS = 50 * 1000;
        const startTime = Date.now();

        const testPropertyIds = [
            '684b3714-184b-4146-bb90-64ef6f5b837a',
            '18af4213-7a3a-47fc-ba6c-a5b86435214f'
        ];

        const elevatedImport = elevate(files.bulkImportFile);
        const summary = [];

        for (const propertyId of testPropertyIds) {
            if (Date.now() - startTime > MAX_MS) break;

            const prop = await wixData.get('Properties', propertyId, { suppressAuth: true });
            if (!prop) continue;

            const gallery = prop.gallery || [];
            let changed = false;

            for (let i = 0; i < gallery.length; i++) {
                if (Date.now() - startTime > MAX_MS) break;

                const img = gallery[i];

                // Skip if already done — either successfully cleaned OR confirmed clean (no watermark).
                // Only genuine pending/failed images get retried.
                if (img.isWatermarkRemoved === true || img.hasWatermark === false) continue;

                try {
                    const viewableUrl = `https://static.wixstatic.com/media/${img.slug}`;

                    // 1) Detect
                    const hasWatermark = await detectWatermark(viewableUrl);

                    if (!hasWatermark) {
                        gallery[i] = { ...img, hasWatermark: false, isWatermarkRemoved: false };
                        changed = true;
                        continue;
                    }

                    // 2) Remove
                    const cleanedUrl = await removeWatermark(viewableUrl);
                    if (!cleanedUrl) {
                        gallery[i] = { ...img, hasWatermark: true, isWatermarkRemoved: false };
                        changed = true;
                        continue;
                    }

                    // 3) Import cleaned image into Wix Media Manager
                    const importResult = await elevatedImport(/** @type {any} */ ([{ url: cleanedUrl, mediaType: 'IMAGE' }]));
                    const imported = importResult.results[0];

                    if (!imported.itemMetadata?.success) {
                        gallery[i] = { ...img, hasWatermark: true, isWatermarkRemoved: false };
                        changed = true;
                        continue;
                    }

                    const newFileId = imported.item._id;
                    const w = img.settings?.width || 1920;
                    const h = img.settings?.height || 1080;

                    gallery[i] = {
                        ...img,
                        src: `wix:image://v1/${newFileId}/_.jpg#originWidth=${w}&originHeight=${h}`,
                        slug: newFileId,
                        hasWatermark: true,
                        isWatermarkRemoved: true
                    };
                    changed = true;

                } catch (err) {
                    gallery[i] = { ...img, isWatermarkRemoved: false, lastError: err.message };
                    changed = true;
                }
            }

            if (changed) {
                await wixData.update('Properties', { ...prop, gallery }, { suppressAuth: true });
            }

            const processedCount = gallery.filter(g => g.isWatermarkRemoved === true || g.hasWatermark === false).length;
            const remainingCount = gallery.length - processedCount;

            summary.push({
                propertyId,
                kwRef: prop.kwRef,
                totalImages: gallery.length,
                processed: processedCount,
                remaining: remainingCount
            });
        }

        return { success: true, summary };
    }
);