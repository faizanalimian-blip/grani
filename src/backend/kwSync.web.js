import wixData from 'wix-data';
import { fetch } from 'wix-fetch';
import { Permissions, webMethod } from 'wix-web-module';
import { files } from 'wix-media.v2';
import { elevate } from 'wix-auth';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const KW7_FEED_URL = 'https://api.kw7cyprus.com/portals/sharon-homes/feed';
const KW7_SOURCE = 'kw7';
const BATCH_SIZE = 100;

// ─────────────────────────────────────────────────────────────────────────────
// LOGGING
// ─────────────────────────────────────────────────────────────────────────────

function log(cat, msg, data = null) {
    const t = new Date().toISOString().split('T')[1].slice(0, 8);
    data
        ?
        console.log(`[${t}] [KW7-${cat}] ${msg}:`, data) :
        console.log(`[${t}] [KW7-${cat}] ${msg}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// XML PARSING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function xmlTag(xml, tag) {
    const cd = new RegExp(`<${tag}(?:\\s[^>]*)?><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>`, 'i');
    let m = xml.match(cd);
    if (m) return m[1].trim();
    const pl = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\/${tag}>`, 'i');
    m = xml.match(pl);
    return m ? m[1].trim() : null;
}

function xmlAllTags(xml, tag) {
    const results = [];
    const cd = new RegExp(`<${tag}(?:\\s[^>]*)?><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>`, 'gi');
    let m;
    while ((m = cd.exec(xml)) !== null) {
        const v = m[1].trim();
        if (v) results.push(v);
    }
    if (results.length > 0) return results;
    const pl = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\/${tag}>`, 'gi');
    while ((m = pl.exec(xml)) !== null) {
        const v = m[1].trim();
        if (v) results.push(v);
    }
    return results;
}

function xmlNested(xml, parentTag, childTag) {
    const pr = new RegExp(`<${parentTag}>[\\s\\S]*?<\/${parentTag}>`, 'i');
    const pm = xml.match(pr);
    if (!pm) return null;
    return xmlTag(pm[0], childTag);
}

function xmlNestedAll(xml, parentTag, childTag) {
    const pr = new RegExp(`<${parentTag}>[\\s\\S]*?<\/${parentTag}>`, 'i');
    const pm = xml.match(pr);
    if (!pm) return [];
    return xmlAllTags(pm[0], childTag);
}

function splitPropertyBlocks(xml) {
    const blocks = [];
    const re = /<property>([\s\S]*?)<\/property>/gi;
    let m;
    while ((m = re.exec(xml)) !== null) {
        blocks.push(m[1]);
    }
    return blocks;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIELD MAPPING
// ─────────────────────────────────────────────────────────────────────────────

const TRANSACTION_MAP = {
    'sale': 'Sale',
    'rent': 'Rent',
    'short term': 'Short Term',
    'long term': 'Long Term',
    'short-term': 'Short Term',
    'long-term': 'Long Term',
};

function mapXmlBlock(block) {
    const kwRef = xmlTag(block, 'ref');
    if (!kwRef) return null;

    const title = xmlTag(block, 'title') || 'Untitled Property';
    const transaction = (xmlTag(block, 'transaction') || '').toLowerCase().trim();
    const type = xmlTag(block, 'type') || '';
    const kwStatus = xmlTag(block, 'status') || '';
    const dateUpdated = xmlTag(block, 'date_updated') || '';
    const description = xmlTag(block, 'description') || '';

    const price = parseFloat(xmlTag(block, 'price') || '0') || 0;
    const sizeSqm = parseFloat(xmlTag(block, 'size_sqm') || '0') || 0;
    const plotSqm = parseFloat(xmlTag(block, 'plot_sqm') || '0') || 0;
    const bedrooms = parseInt(xmlTag(block, 'bedrooms') || '0', 10) || 0;
    const bathrooms = parseInt(xmlTag(block, 'bathrooms') || '0', 10) || 0;
    const wc = parseInt(xmlTag(block, 'wc') || '0', 10) || 0;
    const floor = xmlTag(block, 'floor') || '';
    const parkings = parseInt(xmlTag(block, 'parkings') || '0', 10) || 0;
    const yearBuilt = parseInt(xmlTag(block, 'year_built') || '0', 10) || 0;

    const country = xmlNested(block, 'location', 'country') || '';
    const district = xmlNested(block, 'location', 'district') || '';
    const area = xmlNested(block, 'location', 'area') || '';
    const addrText = xmlNested(block, 'location', 'address') || '';
    const lat = parseFloat(xmlNested(block, 'location', 'latitude') || '0') || 0;
    const lng = parseFloat(xmlNested(block, 'location', 'longitude') || '0') || 0;

    const imageUrls = xmlNestedAll(block, 'images', 'image');
    const amenities = xmlNestedAll(block, 'amenities', 'amenity');
    const views = xmlNestedAll(block, 'views', 'view');

    const seaView = views.some(v => /sea[\s-]?view/i.test(v));
    const closeToSea = amenities.some(a => /close[\s-]to[\s-]sea|seafront|sea[\s-]front/i.test(a));

    const dealType = [TRANSACTION_MAP[transaction] || 'Sale'];
    const propertyType = type ? [type] : [];
    const investmentOpportunity = [...amenities, ...views].filter(Boolean);

    const status = kwStatus.toLowerCase() === 'available' ? 'Approved' : 'Pending';
    const shortDescription = description ?
        description.replace(/\s+/g, ' ').trim().slice(0, 250) :
        '';

    // ── Gallery — now stores originalKwUrl alongside src for future change detection ──
    const gallery = imageUrls.map(url => ({
        type: 'image',
        src: url,
        originalKwUrl: url, // preserved even after cleaning — used to detect real image changes
        description: '',
        title: '',
        alt: '',
        settings: { focalPoint: [0.5, 0.5] }
    }));

    return {
        kwRef,
        kwSource: KW7_SOURCE,
        kwDateUpdated: dateUpdated,
        kwLastSynced: new Date(),
        kwStatus,
        title,
        description,
        shortDescription,
        propertyType,
        dealType,
        investmentOpportunity,
        country: country ? [country] : [],
        minPrice: price,
        maxPrice: price,
        priceRange: price ? `${price}-${price}` : '',
        minBedrooms: bedrooms,
        maxBedrooms: bedrooms,
        bedroomRange: bedrooms ? `${bedrooms}BR` : '',
        plotArea: plotSqm,
        sizeSqm,
        bathrooms,
        wc,
        floor,
        parkings,
        yearBuilt,
        state: district,
        address: addrText,
        latitude: lat,
        longitude: lng,
        stateCity: district,
        neighbourhood: area,
        location: district,
        gallery,
        seaView,
        closeToSea,
        propertyStatus: null,
        status,
        featured: false,
        translationsCompleted: false,
        sourceLanguage: 'en',
        translationError: null,
        availableLanguages: ['en', 'he', 'de'],
        updatedAt: new Date(),
        developer1: 'KW7 Cyprus',
        projectName: '',
        delivery: '',
        email: 'office@sharon-homes.com',
        commission: '',
        agreement: false,
        requestId: null,
        email_sent_to_buyer: false,
        zipCode: '',
        availableDate: null,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// CMS HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function fetchExistingKw7Map() {
    const map = new Map();
    let offset = 0;

    while (true) {
        const page = await wixData.query('Properties')
            .eq('kwSource', KW7_SOURCE)
            .limit(1000)
            .skip(offset)
            .find({ suppressAuth: true });

        for (const item of page.items) {
            if (item.kwRef) {
                map.set(item.kwRef, {
                    _id: item._id,
                    kwDateUpdated: item.kwDateUpdated || '',
                    status: item.status || ''
                });
            }
        }

        if (page.items.length < 1000) break;
        offset += 1000;
    }

    return map;
}

function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE SYNC FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

async function runSync(deadline) {
    const startTime = new Date();
    const stats = {
        fetched: 0, parsed: 0, inserted: 0, updated: 0,
        skipped: 0, flagged: 0, imagesPreserved: 0, imagesChanged: 0,
        partial: false, errors: [], fieldChangeLog: []
    };

    log('FETCH', `Fetching feed from ${KW7_FEED_URL}`);
    const response = await fetch(KW7_FEED_URL, {
        method: 'GET',
        headers: { 'Accept': 'application/xml, text/xml, */*' }
    });

    if (!response.ok) {
        throw new Error(`Feed fetch failed: HTTP ${response.status}`);
    }

    const xml = await response.text();
    log('FETCH', `Feed received, length: ${xml.length} chars`);

    const blocks = splitPropertyBlocks(xml);
    stats.fetched = blocks.length;
    log('PARSE', `Split into ${blocks.length} property blocks`);

    if (blocks.length === 0) {
        throw new Error('Zero property blocks found — feed may be empty or malformed');
    }

    const parsed = blocks.map(block => mapXmlBlock(block)).filter(Boolean);
    stats.parsed = parsed.length;
    log('PARSE', `Mapped ${parsed.length} valid properties`);

    const feedRefs = new Set(parsed.map(p => p.kwRef));

    log('CMS', 'Fetching existing KW7 properties from CMS...');
    const existingMap = await fetchExistingKw7Map();
    log('CMS', `Found ${existingMap.size} existing KW7 properties in CMS`);

    const toInsert = [];
    const toUpdate = [];

    for (const prop of parsed) {
        const existing = existingMap.get(prop.kwRef);
        if (!existing) {
            toInsert.push(prop);
        } else if (existing.kwDateUpdated !== prop.kwDateUpdated) {
            toUpdate.push({ propFresh: prop, existingId: existing._id });
        } else {
            stats.skipped++;
        }
    }

    log('CLASSIFY', `New: ${toInsert.length} | Changed: ${toUpdate.length} | Unchanged: ${stats.skipped}`);

    // ── STEP 5: Bulk insert new properties ────────────────────────────────────
    if (toInsert.length > 0) {
        const batches = chunk(toInsert, BATCH_SIZE);
        log('INSERT', `Inserting ${toInsert.length} properties in ${batches.length} batches`);

        for (let i = 0; i < batches.length; i++) {
            if (Date.now() > deadline) { stats.partial = true; log('INSERT', 'Deadline hit mid-insert, stopping'); break; }

            const batch = batches[i];
            try {
                const result = await wixData.bulkInsert('Properties', batch, { suppressAuth: true });
                const insertedCount = result.inserted || 0;
                const insertErrors = result.errors || [];
                stats.inserted += insertedCount;

                if (insertErrors.length > 0) {
                    const msg = `Batch ${i + 1}: partial insert — ${insertedCount}/${batch.length} inserted`;
                    stats.errors.push(msg);
                    log('INSERT_WARN', msg, insertErrors.map(e => e.message || e).join(' | '));
                } else {
                    log('INSERT', `Batch ${i + 1}/${batches.length} — inserted ${insertedCount}`);
                }
            } catch (err) {
                const msg = `Batch ${i + 1} insert threw: ${err.message}`;
                stats.errors.push(msg);
                log('INSERT_ERROR', msg);
            }
        }

        log('INSERT', `Total inserted: ${stats.inserted}/${toInsert.length}`);
    }

    // ── STEP 6: Update changed properties — merge-safe, deadline-aware, diff-logged ──
    if (toUpdate.length > 0) {
        log('UPDATE', `Updating ${toUpdate.length} changed properties`);

        const fieldsToCompare = ['title', 'minPrice', 'maxPrice', 'status', 'description',
            'minBedrooms', 'maxBedrooms', 'plotArea', 'sizeSqm', 'bathrooms', 'kwStatus'];

        for (const { propFresh, existingId } of toUpdate) {
            if (Date.now() > deadline) { stats.partial = true; log('UPDATE', 'Deadline hit mid-update, stopping — remaining will retry next run'); break; }

            try {
                const existingFull = await wixData.get('Properties', existingId, { suppressAuth: true });

                const freshUrls = (propFresh.gallery || []).map(g => g.originalKwUrl).sort();
                const existingUrls = (existingFull.gallery || [])
                    .map(g => g.originalKwUrl)
                    .filter(Boolean)
                    .sort();

                const canCompare = existingUrls.length === (existingFull.gallery || []).length;
                const imagesUnchanged = canCompare &&
                    freshUrls.length === existingUrls.length &&
                    freshUrls.every((u, i) => u === existingUrls[i]);

                // Detect which actual fields changed, for real logging instead of assuming
                const changedFields = [];
                fieldsToCompare.forEach(field => {
                    const oldVal = existingFull[field];
                    const newVal = propFresh[field];
                    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                        changedFields.push({ field, from: oldVal, to: newVal });
                    }
                });
                if (!imagesUnchanged && canCompare) {
                    changedFields.push({ field: 'gallery', from: `${existingUrls.length} images`, to: `${freshUrls.length} images` });
                }
                if (changedFields.length > 0) {
                    stats.fieldChangeLog.push({ kwRef: propFresh.kwRef, changes: changedFields });
                }

                let merged;
                if (imagesUnchanged || !canCompare) {
                    merged = {
                        ...existingFull, ...propFresh, _id: existingId,
                        gallery: existingFull.gallery,
                        galleryImported: existingFull.galleryImported,
                        galleryFormatFixed: existingFull.galleryFormatFixed,
                        galleryDimensionsFixed: existingFull.galleryDimensionsFixed,
                        locationFixed: existingFull.locationFixed,
                        fieldsPatchDone: existingFull.fieldsPatchDone,
                        descriptionCleaned: existingFull.descriptionCleaned,
                        descriptionCleanedV2: existingFull.descriptionCleanedV2,
                        featured: existingFull.featured
                    };
                    stats.imagesPreserved++;
                } else {
                    merged = {
                        ...existingFull, ...propFresh, _id: existingId,
                        galleryImported: false, galleryFormatFixed: false, galleryDimensionsFixed: false,
                        featured: existingFull.featured
                    };
                    stats.imagesChanged++;
                }

                await wixData.update('Properties', merged, { suppressAuth: true });
                stats.updated++;
            } catch (err) {
                const msg = `Update failed for kwRef=${propFresh.kwRef}: ${err.message}`;
                stats.errors.push(msg);
                log('UPDATE_ERROR', msg);
            }
        }

        log('UPDATE', `Updated ${stats.updated}/${toUpdate.length} (preserved: ${stats.imagesPreserved}, re-queued: ${stats.imagesChanged})`);
    }

    // ── STEP 7: Flag removed properties — deadline-aware ──────────────────────
    if (Date.now() <= deadline) {
        const removedRefs = [...existingMap.keys()].filter(ref => !feedRefs.has(ref));

        if (removedRefs.length > 0) {
            log('FLAG', `${removedRefs.length} properties no longer in feed — flagging to Pending`);

            for (const ref of removedRefs) {
                if (Date.now() > deadline) { stats.partial = true; break; }

                const { _id, status: currentStatus } = existingMap.get(ref);
                if (currentStatus !== 'Approved') { stats.flagged++; continue; }

                try {
                    const existing = await wixData.get('Properties', _id, { suppressAuth: true });
                    await wixData.update('Properties', {
                        ...existing, status: 'Pending', kwStatus: 'removed_from_feed',
                        kwLastSynced: new Date(), updatedAt: new Date()
                    }, { suppressAuth: true });
                    stats.flagged++;
                } catch (err) {
                    const msg = `Flag failed for kwRef=${ref}: ${err.message}`;
                    stats.errors.push(msg);
                    log('FLAG_ERROR', msg);
                }
            }

            log('FLAG', `Flagged ${stats.flagged} removed properties`);
        }
    } else {
        stats.partial = true;
    }

    const duration = ((new Date().getTime() - startTime.getTime()) / 1000).toFixed(1);
    log('DONE', `Sync ${stats.partial ? 'PARTIAL' : 'complete'} in ${duration}s`, stats);

    return { ...stats, duration: parseFloat(duration), timestamp: startTime.toISOString() };
}

export const syncKw7Feed = webMethod(
    Permissions.Anyone,
    async () => {
        const startedAt = new Date();
        const DEADLINE = Date.now() + 40 * 1000; // safe under the 59s ceiling
        let status = 'success';
        let errorMessage = '';
        let stats = {};

        try {
            log('START', '=== KW7 FEED SYNC STARTED ===');
            stats = await runSync(DEADLINE);
            if (stats.partial) status = 'partial';
        } catch (err) {
            status = 'error';
            errorMessage = err.message;
            log('ERROR', 'Sync failed', err.message);
        }

        try {
            await wixData.insert('CronRunLogs', {
                jobName: 'syncKw7Feed',
                trigger: 'unknown',
                startedAt,
                finishedAt: new Date(),
                status,
                processedCount: (stats.inserted || 0) + (stats.updated || 0),
                mode: stats.partial ? 'partial-will-resume' : '',
                summaryText: `Inserted: ${stats.inserted || 0}, Updated: ${stats.updated || 0}, Preserved: ${stats.imagesPreserved || 0}, Re-queued: ${stats.imagesChanged || 0}, Flagged: ${stats.flagged || 0}, Skipped: ${stats.skipped || 0}`,
                errorMessage,
                fieldChangeLog: JSON.stringify((stats.fieldChangeLog || []).slice(0, 20)) // cap to keep log entry size sane
            }, { suppressAuth: true });
        } catch (logErr) {
            log('LOG_WRITE_FAIL', logErr.message);
        }

        return { success: status !== 'error', ...stats, error: errorMessage || undefined };
    }
);

export const getKw7SyncStatus = webMethod(
    Permissions.Anyone,
    async () => {
        try {
            let total = 0,
                approved = 0,
                pending = 0,
                notTranslated = 0;
            let lastSynced = null;
            let offset = 0;

            while (true) {
                const page = await wixData.query('Properties')
                    .eq('kwSource', KW7_SOURCE)
                    .limit(1000)
                    .skip(offset)
                    .find({ suppressAuth: true });

                for (const item of page.items) {
                    total++;
                    if (item.status === 'Approved') approved++;
                    if (item.status === 'Pending') pending++;
                    if (!item.translationsCompleted) notTranslated++;

                    if (item.kwLastSynced) {
                        const d = new Date(item.kwLastSynced);
                        if (!lastSynced || d > new Date(lastSynced)) lastSynced = item.kwLastSynced;
                    }
                }

                if (page.items.length < 1000) break;
                offset += 1000;
            }

            return { success: true, total, approved, pending, notTranslated, lastSynced: lastSynced || 'Never synced' };
        } catch (err) {
            log('STATUS_ERROR', err.message);
            return { success: false, error: err.message };
        }
    }
);

export const previewKw7Feed = webMethod(
    Permissions.Anyone,
    async () => {
        try {
            log('PREVIEW', 'Fetching feed for preview (no CMS writes)');

            const response = await fetch(KW7_FEED_URL, {
                method: 'GET',
                headers: { 'Accept': 'application/xml, text/xml, */*' }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const xml = await response.text();
            const blocks = splitPropertyBlocks(xml);
            const parsed = blocks.map(b => mapXmlBlock(b)).filter(Boolean);

            const countryCounts = {};
            const statusCounts = {};

            for (const p of parsed) {
                const c = (p.country || [])[0] || 'Unknown';
                countryCounts[c] = (countryCounts[c] || 0) + 1;
                statusCounts[p.kwStatus] = (statusCounts[p.kwStatus] || 0) + 1;
            }

            const sample = parsed[0] ? {
                kwRef: parsed[0].kwRef,
                title: parsed[0].title,
                country: parsed[0].country,
                stateCity: parsed[0].stateCity,
                state: parsed[0].state,
                propertyType: parsed[0].propertyType,
                dealType: parsed[0].dealType,
                minPrice: parsed[0].minPrice,
                bedrooms: parsed[0].minBedrooms,
                bathrooms: parsed[0].bathrooms,
                status: parsed[0].status,
                imageCount: parsed[0].gallery.length,
                amenities: parsed[0].investmentOpportunity,
                seaView: parsed[0].seaView,
                closeToSea: parsed[0].closeToSea,
                kwDateUpdated: parsed[0].kwDateUpdated,
                descriptionSnippet: (parsed[0].description || '').slice(0, 100)
            } : null;

            return { success: true, totalInFeed: blocks.length, validParsed: parsed.length, countryCounts, statusCounts, sample };
        } catch (err) {
            log('PREVIEW_ERROR', err.message);
            return { success: false, error: err.message };
        }
    }
);

export const getRawKw7Sample = webMethod(
    Permissions.Anyone,
    async () => {
        const response = await fetch(KW7_FEED_URL, { method: 'GET', headers: { 'Accept': 'application/xml, text/xml, */*' } });
        if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
        const xml = await response.text();
        const match = xml.match(/<property>[\s\S]*?<\/property>/);
        return {
            success: true,
            totalFeedLength: xml.length,
            firstPropertyRaw: match ? match[0] : 'No property block found',
            rootElementSnippet: xml.slice(0, 300)
        };
    }
);

export const getRandomSampleImages = webMethod(
    Permissions.Anyone,
    async () => {
        const SAMPLE_SIZE = 15;
        const page = await wixData.query('Properties').eq('kwSource', KW7_SOURCE).limit(200).find({ suppressAuth: true });
        const withGallery = page.items.filter(p => Array.isArray(p.gallery) && p.gallery.length > 0);
        const shuffled = withGallery.sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, SAMPLE_SIZE);

        const samples = selected.map(p => {
            const gallery = p.gallery;
            const randomImg = gallery[Math.floor(Math.random() * gallery.length)];
            const slug = randomImg.slug || '';
            const viewableUrl = slug ? `https://static.wixstatic.com/media/${slug}` : randomImg.src;
            return { kwRef: p.kwRef, title: p.title, imageUrl: viewableUrl };
        });

        return { success: true, count: samples.length, samples };
    }
);

export const checkAllImageDomains = webMethod(
    Permissions.Anyone,
    async () => {
        const response = await fetch(KW7_FEED_URL, { method: 'GET' });
        const xml = await response.text();
        const blocks = splitPropertyBlocks(xml);
        const domainCounts = {};
        let totalImages = 0;

        for (const block of blocks) {
            const imageUrls = xmlNestedAll(block, 'images', 'image');
            imageUrls.forEach(url => {
                totalImages++;
                try {
                    const domain = new URL(url).hostname;
                    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
                } catch (e) {
                    domainCounts['INVALID_URL'] = (domainCounts['INVALID_URL'] || 0) + 1;
                }
            });
        }

        return { success: true, totalProperties: blocks.length, totalImages, domainBreakdown: domainCounts };
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// ONE-TIME DIAGNOSTIC / REPAIR TOOLS — kept for reference, not scheduled
// ─────────────────────────────────────────────────────────────────────────────

export const resetBrokenImports = webMethod(
    Permissions.Anyone,
    async () => {
        const MAX_MS = 45 * 1000;
        const startTime = Date.now();
        let totalReset = 0;

        while (Date.now() - startTime < MAX_MS) {
            const page = await wixData.query('Properties')
                .eq('kwSource', KW7_SOURCE).eq('galleryImported', true).limit(200)
                .find({ suppressAuth: true });

            if (page.items.length === 0) break;

            const broken = page.items.filter(p =>
                (p.gallery || []).some(item => !item.slug || item.src?.includes('//_.jpg'))
            );

            if (broken.length === 0) break;

            const toReset = broken.map(p => ({
                ...p,
                galleryImported: false,
                galleryFormatFixed: false,
                galleryDimensionsFixed: false
            }));

            const result = await wixData.bulkUpdate('Properties', toReset, { suppressAuth: true });
            totalReset += result.updated || 0;
            log('RESET_BROKEN', `Reset ${result.updated}, total: ${totalReset}`);

            if (page.items.length < 200) break;
        }

        const remaining = await wixData.query('Properties')
            .eq('kwSource', KW7_SOURCE).eq('galleryImported', false)
            .count({ suppressAuth: true });

        return { success: true, totalReset, pendingReimport: remaining };
    }
);

export const checkKw7Gallery = webMethod(
    Permissions.Anyone,
    async () => {
        const result = await wixData.query('Properties')
            .eq('kwSource', KW7_SOURCE).eq('galleryImported', true).limit(1)
            .find({ suppressAuth: true });

        if (result.items.length === 0) return { success: false, error: 'No imported properties found' };

        const property = result.items[0];
        return { success: true, kwRef: property.kwRef, gallery: property.gallery };
    }
);

export const countKwContactInDescriptions = webMethod(
    Permissions.Anyone,
    async () => {
        let offset = 0,
            totalChecked = 0,
            propertiesWithKw = 0,
            translationsWithKw = 0;

        const hasKwContact = (text) => {
            if (!text) return false;
            return /kw(cyprus|seven|paphos|limassol|nicosia|larnaca|famagusta)/i.test(text) ||
                /@kw[a-z]+\./i.test(text) || /keller\s*williams/i.test(text) || /kwcyprus\.com/i.test(text);
        };

        offset = 0;
        while (true) {
            const page = await wixData.query('Properties').eq('kwSource', KW7_SOURCE).limit(200).skip(offset).find({ suppressAuth: true });
            if (page.items.length === 0) break;
            page.items.forEach(p => {
                totalChecked++;
                if (hasKwContact(p.description) || hasKwContact(p.shortDescription)) propertiesWithKw++;
            });
            if (page.items.length < 200) break;
            offset += 200;
        }

        offset = 0;
        while (true) {
            const page = await wixData.query('PropertyTranslations').eq('kwSource', KW7_SOURCE).eq('language', 'en').limit(200).skip(offset).find({ suppressAuth: true });
            if (page.items.length === 0) break;
            page.items.forEach(t => {
                if (hasKwContact(t.description) || hasKwContact(t.shortDescription)) translationsWithKw++;
            });
            if (page.items.length < 200) break;
            offset += 200;
        }

        const sample = await wixData.query('Properties').eq('kwSource', KW7_SOURCE).limit(200).find({ suppressAuth: true });
        const affected = sample.items.find(p => hasKwContact(p.description) || hasKwContact(p.shortDescription));

        return {
            success: true,
            totalKw7PropertiesChecked: totalChecked,
            propertiesNeedingFix: propertiesWithKw,
            translationsNeedingFix: translationsWithKw,
            sampleDescription: affected?.description?.slice(0, 500) || 'none found in sample'
        };
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// XML PARSING HELPERS
// These work without DOMParser — Wix Velo backend is not a browser environment.
// All helpers handle both <tag>text</tag> and <tag><![CDATA[text]]></tag> forms.
// ─────────────────────────────────────────────────────────────────────────────

export const repairBrokenGalleries = webMethod(
    Permissions.Anyone,
    async () => {
        const MAX_MS = 45 * 1000;
        const startTime = Date.now();
        let resetCount = 0,
            formatCount = 0,
            dimensionsCount = 0;

        // ── STEP 1: Reset broken records (empty slug / double-slash src) ──────
        log('REPAIR', 'Step 1: Resetting broken galleries...'); {
            let offset = 0;
            while (Date.now() - startTime < MAX_MS) {
                const page = await wixData.query('Properties')
                    .eq('kwSource', KW7_SOURCE)
                    .eq('galleryImported', true)
                    .limit(200)
                    .skip(offset)
                    .find({ suppressAuth: true });

                if (page.items.length === 0) break;

                const broken = page.items.filter(p =>
                    (p.gallery || []).some(item => !item.slug || item.src?.includes('//_.jpg'))
                );

                if (broken.length > 0) {
                    const toReset = broken.map(p => ({
                        ...p,
                        galleryFormatFixed: false,
                        galleryDimensionsFixed: false
                    }));
                    const result = await wixData.bulkUpdate('Properties', toReset, { suppressAuth: true });
                    resetCount += result.updated || 0;
                    log('REPAIR', `Step 1: Reset ${result.updated} broken records at offset ${offset}`);
                }

                if (page.items.length < 200) break;
                offset += 200;
            }
        }

        log('REPAIR', `Step 1 done — reset ${resetCount} records`);

        // ── STEP 2: Fix format (slug → correct wix:image:// src) ─────────────
        log('REPAIR', 'Step 2: Fixing gallery format...');
        while (Date.now() - startTime < MAX_MS) {
            const page = await wixData.query('Properties')
                .eq('kwSource', KW7_SOURCE)
                .eq('galleryImported', true)
                .ne('galleryFormatFixed', true)
                .limit(200)
                .find({ suppressAuth: true });

            if (page.items.length === 0) break;

            const toUpdate = page.items.map(property => ({
                ...property,
                gallery: (property.gallery || []).map(item => {
                    const slug = item.slug || item.src?.split('/media/')?.[1] || '';
                    return {
                        ...item,
                        slug,
                        src: slug ? `wix:image://v1/${slug}/_.jpg` : item.src
                    };
                }),
                galleryFormatFixed: true
            }));

            const result = await wixData.bulkUpdate('Properties', toUpdate, { suppressAuth: true });
            formatCount += result.updated || 0;
            log('REPAIR', `Step 2: Format-fixed ${result.updated}`);
        }

        log('REPAIR', `Step 2 done — format-fixed ${formatCount} records`);

        // ── STEP 3: Add dimensions ────────────────────────────────────────────
        log('REPAIR', 'Step 3: Fixing gallery dimensions...');
        while (Date.now() - startTime < MAX_MS) {
            const page = await wixData.query('Properties')
                .eq('kwSource', KW7_SOURCE)
                .eq('galleryImported', true)
                .eq('galleryFormatFixed', true)
                .ne('galleryDimensionsFixed', true)
                .limit(200)
                .find({ suppressAuth: true });

            if (page.items.length === 0) break;

            const toUpdate = page.items.map(property => ({
                ...property,
                gallery: (property.gallery || []).map(item => {
                    const slug = item.slug || '';
                    return {
                        type: 'image',
                        slug,
                        title: '',
                        alt: '',
                        description: '',
                        src: `wix:image://v1/${slug}/_.jpg#originWidth=1920&originHeight=1080`,
                        settings: { focalPoint: [0.5, 0.5], width: 1920, height: 1080 }
                    };
                }),
                galleryDimensionsFixed: true
            }));

            const result = await wixData.bulkUpdate('Properties', toUpdate, { suppressAuth: true });
            dimensionsCount += result.updated || 0;
            log('REPAIR', `Step 3: Dimension-fixed ${result.updated}`);
        }

        log('REPAIR', `Step 3 done — dimension-fixed ${dimensionsCount} records`);

        const remaining = await wixData.query('Properties')
            .eq('kwSource', KW7_SOURCE)
            .ne('galleryDimensionsFixed', true)
            .count({ suppressAuth: true });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log('REPAIR', `All steps complete in ${elapsed}s — remaining: ${remaining}`);

        return { success: true, resetCount, formatCount, dimensionsCount, remaining, elapsed };
    }
);
export const fixMissingSrcDimensions = webMethod(
    Permissions.Anyone,
    async () => {
        const MAX_MS = 45 * 1000;
        const startTime = Date.now();
        let totalUpdated = 0;

        while (Date.now() - startTime < MAX_MS) {
            const page = await wixData.query('Properties')
                .eq('kwSource', KW7_SOURCE)
                .limit(200)
                .find({ suppressAuth: true });

            if (page.items.length === 0) { log('FIX_DIMS', 'All done'); break; }

            const toUpdate = page.items
                .filter(p => (p.gallery || []).some(item =>
                    item.src?.startsWith('wix:image://') && !item.src?.includes('#originWidth')
                ))
                .map(p => ({
                    ...p,
                    gallery: (p.gallery || []).map(item => ({
                        ...item,
                        src: item.src?.startsWith('wix:image://') && !item.src?.includes('#originWidth') ?
                            `${item.src}#originWidth=1920&originHeight=1080` : item.src
                    })),
                    galleryDimensionsFixed: true
                }));

            if (toUpdate.length > 0) {
                const result = await wixData.bulkUpdate('Properties', toUpdate, { suppressAuth: true });
                totalUpdated += result.updated || 0;
                log('FIX_DIMS', `Updated ${result.updated}, total: ${totalUpdated}`);
            }

            if (page.items.length < 200) break;
        }

        return { success: true, totalUpdated };
    }
);

export const importKw7Images = webMethod(
    Permissions.Anyone,
    async (offset) => {
        offset = Number(offset) || 0;
        const CHUNK = 50;
        const elevatedImport = elevate(files.bulkImportFile);
        const updatedProperties = [];

        const page = await wixData.query('Properties')
            .eq('kwSource', KW7_SOURCE)
            .limit(CHUNK)
            .skip(offset)
            .find({ suppressAuth: true });

        if (page.items.length === 0) {
            return { success: true, done: true, message: 'All done' };
        }

        for (const property of page.items) {
            if (!Array.isArray(property.gallery) || property.gallery.length === 0) continue;

            const importRequests = property.gallery
                .map(item => item.src)
                .filter(src => src && src.startsWith('https://'))
                .map(src => ({ url: src, mediaType: 'IMAGE' }));

            if (importRequests.length === 0) continue;

            try {
                const result = await elevatedImport(importRequests);
                const newGallery = result.results
                    .map(res => {
                        if (!res.itemMetadata?.success) return null;
                        const file = res.item;
                        return {
                            type: 'image',
                            src: file.url,
                            slug: file._id,
                            title: '',
                            alt: '',
                            description: '',
                            settings: {
                                focalPoint: [0.5, 0.5],
                                width: parseInt(file.url?.match(/originWidth=(\d+)/)?.[1] || '0'),
                                height: parseInt(file.url?.match(/originHeight=(\d+)/)?.[1] || '0')
                            }
                        };
                    })
                    .filter(Boolean);

                property.gallery = newGallery;
                updatedProperties.push(property);

            } catch (imgErr) {
                log('IMPORT_ERR', `${property.kwRef}: ${imgErr.message}`);
            }
        }

        if (updatedProperties.length > 0) {
            const updateResult = await wixData.bulkUpdate('Properties', updatedProperties, { suppressAuth: true });
            log('IMPORT', `offset=${offset} — updated: ${updateResult.updated}`);
        }

        const done = page.items.length < CHUNK;
        log('IMPORT', `offset=${offset}, done=${done}, next call: importKw7Images(${offset + CHUNK})`);

        return { success: true, done, processed: updatedProperties.length, nextOffset: offset + CHUNK };
    }
);

export const restoreKw7UrlsFixed = webMethod(
    Permissions.Anyone,
    async () => {
        log('RESTORE', 'Fetching KW7 feed...');
        const response = await fetch(KW7_FEED_URL, { method: 'GET' });
        const xml = await response.text();
        const blocks = splitPropertyBlocks(xml);

        const feedMap = new Map();
        for (const block of blocks) {
            const kwRef = xmlTag(block, 'ref');
            const imageUrls = xmlNestedAll(block, 'images', 'image');
            if (kwRef && imageUrls.length > 0) feedMap.set(kwRef, imageUrls);
        }
        log('RESTORE', `Feed map built — ${feedMap.size} properties`);

        const MAX_MS = 45 * 1000;
        const startTime = Date.now();
        let totalRestored = 0;
        let offset = 0; // ← was missing before

        while (Date.now() - startTime < MAX_MS) {
            const page = await wixData.query('Properties')
                .eq('kwSource', KW7_SOURCE)
                .ne('galleryImported', true)
                .limit(200)
                .skip(offset) // ← was missing before — caused infinite loop
                .find({ suppressAuth: true });

            if (page.items.length === 0) {
                log('RESTORE', 'All done');
                break;
            }

            // Only restore truly broken ones (broken slug / double slash src)
            const broken = page.items.filter(p =>
                (p.gallery || []).some(item =>
                    !item.slug || item.src?.includes('//_.jpg')
                )
            );

            if (broken.length > 0) {
                const toUpdate = broken
                    .filter(p => feedMap.has(p.kwRef))
                    .map(p => ({
                        ...p,
                        gallery: feedMap.get(p.kwRef).map(url => ({
                            type: 'image',
                            src: url,
                            slug: '',
                            title: '',
                            alt: '',
                            description: '',
                            settings: { focalPoint: [0.5, 0.5], width: 0, height: 0 }
                        }))
                    }));

                if (toUpdate.length > 0) {
                    const result = await wixData.bulkUpdate('Properties', toUpdate, { suppressAuth: true });
                    totalRestored += result.updated || 0;
                    log('RESTORE', `offset=${offset} — restored ${result.updated}`);
                }
            }

            if (page.items.length < 200) break;
            offset += 200;
        }

        const remaining = await wixData.query('Properties')
            .eq('kwSource', KW7_SOURCE)
            .ne('galleryImported', true)
            .count({ suppressAuth: true });

        return { success: true, totalRestored, remaining };
    }
);

// export const importKw7ImagesCron = webMethod(
//     Permissions.Anyone,
//     async () => {
//         const MAX_MS = 45 * 1000;
//         const elevatedImport = elevate(files.bulkImportFile);
//         const startTime = Date.now();
//         let totalProcessed = 0;

//         while (Date.now() - startTime < MAX_MS) {
//             const page = await wixData.query('Properties')
//                 .eq('kwSource', KW7_SOURCE)
//                 .ne('galleryImported', true)
//                 .limit(1)
//                 .find({ suppressAuth: true });

//             if (page.items.length === 0) {
//                 log('IMPORT_CRON', 'All done — remove this job');
//                 break;
//             }

//             const property = page.items[0];

//             const importRequests = (property.gallery || [])
//                 .map(item => item.src)
//                 .filter(src => src && src.startsWith('https://'))
//                 .map(src => ({ url: src, mediaType: 'IMAGE' }));

//             if (importRequests.length === 0) {
//                 await wixData.update('Properties', {
//                     ...property,
//                     galleryImported: true,
//                     galleryFormatFixed: true,
//                     galleryDimensionsFixed: true
//                 }, { suppressAuth: true });
//                 totalProcessed++;
//                 continue;
//             }

//             try {
//                 const result = await elevatedImport(importRequests);

//                 const newGallery = result.results
//                     .map(res => {
//                         if (!res.itemMetadata?.success) return null;
//                         const file = res.item;
//                         const slug = file._id || '';
//                         return {
//                             type: 'image',
//                             slug,
//                             src: `wix:image://v1/${slug}/_.jpg#originWidth=1920&originHeight=1080`,
//                             title: '',
//                             alt: '',
//                             description: '',
//                             settings: { focalPoint: [0.5, 0.5], width: 1920, height: 1080 }
//                         };
//                     })
//                     .filter(Boolean);

//                 await wixData.update('Properties', {
//                     ...property,
//                     gallery: newGallery,
//                     galleryImported: true,
//                     galleryFormatFixed: true,
//                     galleryDimensionsFixed: true
//                 }, { suppressAuth: true });

//                 totalProcessed++;
//                 log('IMPORT_CRON', `Done: ${property.kwRef} — ${newGallery.length} images`);

//             } catch (err) {
//                 log('IMPORT_CRON_ERR', `${property.kwRef}: ${err.message}`);
//             }
//         }

//         const remaining = await wixData.query('Properties')
//             .eq('kwSource', KW7_SOURCE)
//             .ne('galleryImported', true)
//             .count({ suppressAuth: true });

//         const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
//         log('IMPORT_CRON', `Done — processed: ${totalProcessed}, remaining: ${remaining}, elapsed: ${elapsed}s`);

//         return { success: true, totalProcessed, remaining, elapsed };
//     }
// );
// ─────────────────────────────────────────────────────────────────────────────
// CMS HELPERS
// ─────────────────────────────────────────────────────────────────────────────