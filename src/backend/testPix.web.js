import { Permissions, webMethod } from "wix-web-module";
import { fetch } from "wix-fetch";
import wixData from 'wix-data';
import { files } from 'wix-media.v2';
import { elevate } from 'wix-auth';

const PIXELBIN_API_TOKEN = "3d1ee755-e8ed-48e5-82f7-e806572da33e";
const AUTH_HEADER = `Bearer ${Buffer.from(PIXELBIN_API_TOKEN).toString('base64')}`;
const REMOVE_URL = 'https://api.pixelbin.io/service/platform/transformation/v1.0/predictions/wm/remove';

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

// deadline = absolute timestamp (Date.now() + budget), NOT a duration
async function pollForResult(getUrl, deadline, intervalMs = 2000) {
    while (Date.now() < deadline) {
        const response = await fetch(getUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json', 'Authorization': AUTH_HEADER }
        });
        if (!response.ok) throw new Error(`Poll failed: HTTP ${response.status} - ${await response.text()}`);
        const data = await response.json();
        if (data.status === 'SUCCESS' || data.status === 'FAILURE') return data;

        const remaining = deadline - Date.now();
        if (remaining <= intervalMs) break; // not enough time for another poll, bail
        await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error('Polling budget exhausted before job finished — will retry next run');
}

async function removeWatermark(imageUrl, deadline) {
    const submit = await submitJob(REMOVE_URL, {
        'input.image': imageUrl,
        'input.mask': '',
        'input.rem_text': 'true',
        'input.rem_logo': 'true',
        'input.box1': '0_0_100_100',
        'input.box2': '0_0_0_0',
        'input.box3': '0_0_0_0',
        'input.box4': '0_0_0_0',
        'input.box5': '0_0_0_0'
    });
    const final = await pollForResult(submit.urls.get, deadline);
    return final.output?.[0] || null;
}

function log(msg, data = null) {
    const t = new Date().toISOString().split('T')[1].slice(0, 8);
    data
        ?
        console.log(`[${t}] [WM] ${msg}:`, data) :
        console.log(`[${t}] [WM] ${msg}`);
}

export const removeWatermarkSingleProperty = webMethod(
    Permissions.Anyone,
    async () => {
        const PROPERTY_ID = '18af4213-7a3a-47fc-ba6c-a5b86435214f';
        const HARD_DEADLINE = Date.now() + 45 * 1000;

        const elevatedImport = elevate(files.bulkImportFile);
        let hasPending = true;

        while (hasPending && Date.now() < HARD_DEADLINE - 6000) {
            const prop = await wixData.get('Properties', PROPERTY_ID, { suppressAuth: true, consistentRead: true });
            const gallery = prop.gallery || [];

            const idx = gallery.findIndex(img => img.isWatermarkRemoved !== true);
            if (idx === -1) { hasPending = false; break; }

            const img = gallery[idx];
            // REMOVED: the risky pre-write. No write happens until the image is actually processed.

            try {
                const viewableUrl = `https://static.wixstatic.com/media/${img.slug}`;
                const cleanedUrl = await removeWatermark(viewableUrl, HARD_DEADLINE - 2000);

                let updatedImg;
                let stage;

                if (!cleanedUrl) {
                    updatedImg = { ...img, hasWatermark: true, isWatermarkRemoved: false };
                    stage = 'remove_failed_no_output';
                } else {
                    const importResult = await elevatedImport(/** @type {any} */ ([{ url: cleanedUrl, mediaType: 'IMAGE' }]));
                    const imported = importResult.results[0];

                    if (!imported.itemMetadata?.success) {
                        updatedImg = { ...img, hasWatermark: true, isWatermarkRemoved: false };
                        stage = 'import_failed';
                    } else {
                        const newFileId = imported.item._id;
                        const w = img.settings?.width || 1920;
                        const h = img.settings?.height || 1080;
                        updatedImg = {
                            ...img,
                            src: `wix:image://v1/${newFileId}/_.jpg#originWidth=${w}&originHeight=${h}`,
                            slug: newFileId,
                            hasWatermark: true,
                            isWatermarkRemoved: true
                        };
                        stage = 'completed';
                    }
                }

                // ONLY write point in the whole loop — fresh fetch, immediately before write
                const freshProp = await wixData.get('Properties', PROPERTY_ID, { suppressAuth: true, consistentRead: true });
                const freshGallery = freshProp.gallery || [];
                const freshIdx = freshGallery.findIndex(g => g.slug === img.slug);
                if (freshIdx !== -1) freshGallery[freshIdx] = updatedImg;

                const doneCount = freshGallery.filter(g => g.isWatermarkRemoved === true).length;

                await wixData.update('Properties', {
                    ...freshProp,
                    gallery: freshGallery,
                    watermarkRunStatus: {
                        lastRunAt: new Date().toISOString(),
                        lastProcessedIndex: idx,
                        lastProcessedSlug: updatedImg.slug,
                        stage,
                        totalFixed: doneCount,
                        totalImages: freshGallery.length
                    }
                }, { suppressAuth: true });

            } catch (err) {
                const freshProp = await wixData.get('Properties', PROPERTY_ID, { suppressAuth: true, consistentRead: true });
                const freshGallery = freshProp.gallery || [];
                const freshIdx = freshGallery.findIndex(g => g.slug === img.slug);
                if (freshIdx !== -1) freshGallery[freshIdx] = { ...img, isWatermarkRemoved: false, lastError: err.message };

                await wixData.update('Properties', {
                    ...freshProp,
                    gallery: freshGallery,
                    watermarkRunStatus: {
                        lastRunAt: new Date().toISOString(),
                        lastProcessedIndex: idx,
                        stage: 'error',
                        errorMessage: err.message
                    }
                }, { suppressAuth: true });
            }
        }

        const finalProp = await wixData.get('Properties', PROPERTY_ID, { suppressAuth: true, consistentRead: true });
        const finalGallery = finalProp.gallery || [];

        return {
            success: true,
            kwRef: finalProp.kwRef,
            totalImages: finalGallery.length,
            processed: finalGallery.filter(g => g.isWatermarkRemoved === true).length,
            remaining: finalGallery.filter(g => g.isWatermarkRemoved !== true).length,
            watermarkRunStatus: finalProp.watermarkRunStatus
        };
    }
);

export const checkWatermarkProgress = webMethod(
    Permissions.Anyone,
    async () => {
        const ids = [
            '684b3714-184b-4146-bb90-64ef6f5b837a',
            '18af4213-7a3a-47fc-ba6c-a5b86435214f'
        ];

        const results = [];
        for (const id of ids) {
            const prop = await wixData.get('Properties', id, { suppressAuth: true });
            const gallery = prop.gallery || [];

            results.push({
                propertyId: id,
                kwRef: prop.kwRef,
                totalImages: gallery.length,
                completed: gallery.filter(g => g.isWatermarkRemoved === true).length,
                failed: gallery.filter(g => g.lastError).length,
                pending: gallery.filter(g => !g.isWatermarkRemoved && !g.lastError).length
            });
        }

        return { success: true, results };
    }
);

export const inspectGalleryDetail = webMethod(
    Permissions.Anyone,
    async () => {
        const prop = await wixData.get('Properties', '18af4213-7a3a-47fc-ba6c-a5b86435214f', { suppressAuth: true, consistentRead: true });
        const gallery = prop.gallery || [];
        const fixed = gallery.filter(img => img.isWatermarkRemoved === true).length;

        return {
            kwRef: prop.kwRef,
            totalImages: gallery.length,
            fixed,
            pending: gallery.length - fixed,
            watermarkRunStatus: prop.watermarkRunStatus || null
        };
    }
);