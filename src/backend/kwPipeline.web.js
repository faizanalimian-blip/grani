import wixData from 'wix-data';
import { fetch } from 'wix-fetch';
import { Permissions, webMethod } from 'wix-web-module';
import { files } from 'wix-media.v2';
import { elevate } from 'wix-auth';

const KW7_SOURCE = 'kw7';
const PIXELBIN_API_TOKEN = "3d1ee755-e8ed-48e5-82f7-e806572da33e";
const AUTH_HEADER = `Bearer ${Buffer.from(PIXELBIN_API_TOKEN).toString('base64')}`;
const REMOVE_URL = 'https://api.pixelbin.io/service/platform/transformation/v1.0/predictions/wm/remove';
const DETECT_URL = 'https://api.pixelbin.io/service/platform/transformation/v1.0/predictions/wmc/detect';

function log(cat, msg, data = null) {
    const t = new Date().toISOString().split('T')[1].slice(0, 8);
    data ? console.log(`[${t}] [PIPE-${cat}] ${msg}:`, data) : console.log(`[${t}] [PIPE-${cat}] ${msg}`);
}

// Stable hash — same image always lands in the same batch, regardless of concurrent runs
function stableHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

function buildMultipartBody(fields, boundary) {
    let body = '';
    for (const [key, value] of Object.entries(fields)) {
        body += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`;
    }
    body += `--${boundary}--\r\n`;
    return body;
}

async function submitJob(url, fields) {
    const boundary = '----PixelbinBoundary' + Date.now();
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Authorization': AUTH_HEADER, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body: buildMultipartBody(fields, boundary)
    });
    if (!response.ok) throw new Error(`Submit failed: HTTP ${response.status} - ${await response.text()}`);
    return await response.json();
}

async function pollForResult(getUrl, deadline, intervalMs = 2000) {
    while (Date.now() < deadline) {
        const response = await fetch(getUrl, { method: 'GET', headers: { 'Accept': 'application/json', 'Authorization': AUTH_HEADER } });
        if (!response.ok) throw new Error(`Poll failed: HTTP ${response.status} - ${await response.text()}`);
        const data = await response.json();
        if (data.status === 'SUCCESS' || data.status === 'FAILURE') return data;
        const remaining = deadline - Date.now();
        if (remaining <= intervalMs) break;
        await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error('Polling budget exhausted');
}

async function detectWatermark(imageUrl, deadline) {
    const submit = await submitJob(DETECT_URL, { 'input.image': imageUrl, 'input.detect_text': 'false' });
    const final = await pollForResult(submit.urls.get, deadline);
    return final.output?.watermark === true;
}

async function removeWatermark(imageUrl, deadline) {
    const submit = await submitJob(REMOVE_URL, {
        'input.image': imageUrl, 'input.mask': '', 'input.rem_text': 'true', 'input.rem_logo': 'true',
        'input.box1': '0_0_100_100', 'input.box2': '0_0_0_0', 'input.box3': '0_0_0_0', 'input.box4': '0_0_0_0', 'input.box5': '0_0_0_0'
    });
    const final = await pollForResult(submit.urls.get, deadline);
    return final.output?.[0] || null;
}

export const processKw7PipelineCron = webMethod(
    Permissions.Anyone,
    async (batchNumber, totalBatches) => {
        // Normalize inputs — Wix's cron scheduler and manual calls can both pass
        // explicit `undefined`/`null`, which overrides default parameter values entirely.
        batchNumber = Number.isInteger(batchNumber) ? batchNumber : 0;
        totalBatches = Number.isInteger(totalBatches) && totalBatches > 0 ? totalBatches : 1;

        const startedAt = new Date();
        const HARD_DEADLINE = Date.now() + 40 * 1000;
        const elevatedImport = elevate(files.bulkImportFile);
        let processedCount = 0;
        let mode = null;
        let status = 'success';
        let errorMessage = '';

        try {
            // ── PHASE 1: FAST — format-fix raw properties, owned by property hash ──
            // Pure Wix-to-Wix file import, no Pixelbin involved — clears many properties per run.
            while (Date.now() < HARD_DEADLINE - 10000) {
                const rawPage = await wixData.query('Properties')
                    .eq('kwSource', KW7_SOURCE)
                    .ne('galleryImported', true)
                    .limit(200)
                    .find({ suppressAuth: true });

                if (rawPage.items.length === 0) break;

                const target = rawPage.items.find(p => stableHash(p._id) % totalBatches === batchNumber);
                if (!target) break; // nothing left owned by this batch

                mode = `fast-format (batch ${batchNumber}/${totalBatches})`;

                const importRequests = (target.gallery || [])
                    .map(item => item.originalKwUrl || item.src)
                    .filter(url => url && url.startsWith('https://'))
                    .map(url => ({ url, mediaType: 'IMAGE' }));

                if (importRequests.length === 0) {
                    await wixData.update('Properties', {
                        ...target, galleryImported: true, galleryFormatFixed: true, galleryDimensionsFixed: true
                    }, { suppressAuth: true });
                    processedCount++;
                    continue;
                }

                try {
                    const result = await elevatedImport(/** @type {any} */ (importRequests));

                    const newGallery = result.results.map((res, i) => {
                        if (!res.itemMetadata?.success) return target.gallery[i]; // keep raw, retry next run
                        const file = res.item;
                        const newFileId = file._id;
                        return {
                            type: 'image', slug: newFileId,
                            src: `wix:image://v1/${newFileId}/_.jpg#originWidth=1920&originHeight=1080`,
                            title: '', alt: '', description: '',
                            originalKwUrl: target.gallery[i]?.originalKwUrl || target.gallery[i]?.src,
                            settings: { focalPoint: [0.5, 0.5], width: 1920, height: 1080 },
                            hasWatermark: null,          // not yet checked
                            isWatermarkRemoved: false    // pending — Phase 2 will catch this
                        };
                    });

                    // Only mark fully done if EVERY image actually got a real slug —
                    // otherwise this property incorrectly disappears from Phase 1's queue
                    // while still containing unformatted images.
                    const allFormatted = newGallery.every(img => img.slug && img.src?.startsWith('wix:image://'));

                    await wixData.update('Properties', {
                        ...target, gallery: newGallery,
                        galleryImported: allFormatted,
                        galleryFormatFixed: allFormatted,
                        galleryDimensionsFixed: allFormatted
                    }, { suppressAuth: true });

                    processedCount++;
                    log('PHASE1_DONE', `batch ${batchNumber}: ${target.kwRef} — ${newGallery.length} images, allFormatted: ${allFormatted}`);

                } catch (err) {
                    log('PHASE1_ERR', `${target.kwRef}: ${err.message}`);
                    break; // stop phase 1, retry this property next run
                }
            }

            // ── PHASE 2: SLOW — watermark detect/clean, owned by image hash ──
            // Only selects images that already have a real Wix slug + correct src
            // format. Unformatted images (slug missing, raw KW7 URL still in src)
            // are left for Phase 1 to catch instead of being blindly attempted here.
            while (Date.now() < HARD_DEADLINE - 8000) {
                const backlogPage = await wixData.query('Properties')
                    .eq('kwSource', KW7_SOURCE)
                    .eq('galleryImported', true)
                    .limit(50)
                    .find({ suppressAuth: true, consistentRead: true });

                let target = null;
                let targetIdx = -1;

                for (const prop of backlogPage.items) {
                    const gallery = prop.gallery || [];
                    const idx = gallery.findIndex(img =>
                        img.isWatermarkRemoved !== true &&
                        img.slug &&
                        img.src?.startsWith('wix:image://') &&
                        (img.failCount || 0) < 3 && // skip permanently-stuck images
                        stableHash(`${prop._id}:${img.slug}`) % totalBatches === batchNumber
                    );
                    if (idx !== -1) { target = prop; targetIdx = idx; break; }
                }

                if (!target) { log('IDLE', `batch ${batchNumber}: nothing owned pending`); break; }

                mode = `watermark-clean (batch ${batchNumber}/${totalBatches})`;
                const img = target.gallery[targetIdx];

                try {
                    const viewableUrl = `https://static.wixstatic.com/media/${img.slug}`;
                    const hasWM = await detectWatermark(viewableUrl, HARD_DEADLINE - 4000);

                    let updatedImg;
                    if (!hasWM) {
                        updatedImg = { ...img, hasWatermark: false, isWatermarkRemoved: true };
                    } else {
                        const cleanedUrl = await removeWatermark(viewableUrl, HARD_DEADLINE - 3000);
                        if (cleanedUrl) {
                            const importResult = await elevatedImport(/** @type {any} */ ([{ url: cleanedUrl, mediaType: 'IMAGE' }]));
                            const imported = importResult.results[0];
                            if (imported.itemMetadata?.success) {
                                const newFileId = imported.item._id;
                                updatedImg = {
                                    ...img, slug: newFileId,
                                    src: `wix:image://v1/${newFileId}/_.jpg#originWidth=1920&originHeight=1080`,
                                    hasWatermark: true, isWatermarkRemoved: true
                                };
                            } else {
                                updatedImg = { ...img, hasWatermark: true, isWatermarkRemoved: false };
                            }
                        } else {
                            updatedImg = { ...img, hasWatermark: true, isWatermarkRemoved: false };
                        }
                    }

                    const freshProp = await wixData.get('Properties', target._id, { suppressAuth: true, consistentRead: true });
                    const freshGallery = freshProp.gallery || [];
                    const freshIdx = freshGallery.findIndex(g => g.slug === img.slug);
                    if (freshIdx !== -1) freshGallery[freshIdx] = updatedImg;
                    await wixData.update('Properties', { ...freshProp, gallery: freshGallery }, { suppressAuth: true });
                    processedCount++;

                } catch (err) {
                    log('PHASE2_ERR', `${target.kwRef} [${img.slug}]: ${err.message}`);
                    const freshProp = await wixData.get('Properties', target._id, { suppressAuth: true, consistentRead: true });
                    const freshGallery = freshProp.gallery || [];
                    const freshIdx = freshGallery.findIndex(g => g.slug === img.slug);
                    if (freshIdx !== -1) {
                        const failCount = (freshGallery[freshIdx].failCount || 0) + 1;
                        freshGallery[freshIdx] = {
                            ...img,
                            failCount,
                            lastError: err.message,
                            // After 3 failed attempts, stop retrying — mark done to unblock the queue
                            isWatermarkRemoved: failCount >= 3 ? true : false
                        };
                    }
                    await wixData.update('Properties', { ...freshProp, gallery: freshGallery }, { suppressAuth: true });
                    // NO break here — loop continues to next image instead of freezing the whole run
                }
            }
        } catch (err) {
            status = 'error';
            errorMessage = err.message;
        }

        try {
            await wixData.insert('CronRunLogs', {
                jobName: 'processKw7PipelineCron', trigger: `batch ${batchNumber}/${totalBatches}`,
                startedAt, finishedAt: new Date(), status, processedCount, mode: mode || 'idle',
                summaryText: `Processed ${processedCount} items in mode: ${mode || 'idle'}`, errorMessage
            }, { suppressAuth: true });
        } catch (logErr) {
            log('LOG_WRITE_FAIL', logErr.message);
        }

        log('DONE', `batch ${batchNumber}/${totalBatches} — processed ${processedCount} items, mode: ${mode || 'idle'}`);
        return { success: true, processedCount, mode, batchNumber, totalBatches };
    }
);