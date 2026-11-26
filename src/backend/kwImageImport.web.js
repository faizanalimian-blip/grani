import wixData from 'wix-data';
import { files } from 'wix-media.v2';
import { elevate } from 'wix-auth';
import { Permissions, webMethod } from 'wix-web-module';

const KW7_SOURCE = 'kw7';

function log(cat, msg, data = null) {
    const t = new Date().toISOString().split('T')[1].slice(0, 8);
    data
        ?
        console.log(`[${t}] [KW7-${cat}] ${msg}:`, data) :
        console.log(`[${t}] [KW7-${cat}] ${msg}`);
}

export const importKw7ImagesCron = webMethod(
    Permissions.Anyone,
    async () => {
        const MAX_MS = 45 * 1000;
        const elevatedImport = elevate(files.bulkImportFile);
        const startTime = Date.now();
        let totalProcessed = 0;

        while (Date.now() - startTime < MAX_MS) {
            const page = await wixData.query('Properties')
                .eq('kwSource', KW7_SOURCE)
                .ne('galleryImported', true)
                .limit(1)
                .find({ suppressAuth: true });

            if (page.items.length === 0) {
                log('IMPORT_CRON', 'All done — remove this job');
                break;
            }

            const property = page.items[0];

            const importRequests = (property.gallery || [])
                .map(item => item.src)
                .filter(src => src && src.startsWith('https://'))
                .map(src => ({ url: src, mediaType: 'IMAGE' }));

            if (importRequests.length === 0) {
                await wixData.update('Properties', {
                    ...property,
                    galleryImported: true,
                    galleryFormatFixed: true,
                    galleryDimensionsFixed: true
                }, { suppressAuth: true });
                totalProcessed++;
                continue;
            }

            try {
                const result = await elevatedImport(importRequests);

                const newGallery = result.results
                    .map(res => {
                        if (!res.itemMetadata?.success) return null;
                        const file = res.item;
                        const slug = file._id || '';
                        return {
                            type: 'image',
                            slug,
                            src: `wix:image://v1/${slug}/_.jpg#originWidth=1920&originHeight=1080`,
                            title: '',
                            alt: '',
                            description: '',
                            settings: { focalPoint: [0.5, 0.5], width: 1920, height: 1080 }
                        };
                    })
                    .filter(Boolean);

                await wixData.update('Properties', {
                    ...property,
                    gallery: newGallery,
                    galleryImported: true,
                    galleryFormatFixed: true,
                    galleryDimensionsFixed: true
                }, { suppressAuth: true });

                totalProcessed++;
                log('IMPORT_CRON', `Done: ${property.kwRef} — ${newGallery.length} images`);

            } catch (err) {
                log('IMPORT_CRON_ERR', `${property.kwRef}: ${err.message}`);
            }
        }

        const remaining = await wixData.query('Properties')
            .eq('kwSource', KW7_SOURCE)
            .ne('galleryImported', true)
            .count({ suppressAuth: true });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log('IMPORT_CRON', `Done — processed: ${totalProcessed}, remaining: ${remaining}, elapsed: ${elapsed}s`);

        return { success: true, totalProcessed, remaining, elapsed };
    }
);
export const fixTranslationsAscending = webMethod(
    Permissions.Anyone,
    async () => {
        const MAX_MS = 40 * 1000;
        const startTime = Date.now();
        let totalUpdated = 0;

        while (Date.now() - startTime < MAX_MS) {
            const page = await wixData.query('Properties')
                .eq('kwSource', KW7_SOURCE)
                .eq('galleryDimensionsFixed', true)
                .ne('translationsGalleryFixed', true)
                .ascending('_createdDate')
                .limit(1)
                .find({ suppressAuth: true });

            if (page.items.length === 0) { log('TRANS_ASC', 'All done'); break; }

            const prop = page.items[0];
            try {
                const transResult = await wixData.query('PropertyTranslations')
                    .eq('propertyId', prop._id)
                    .find({ suppressAuth: true });

                if (transResult.items.length > 0) {
                    const toUpdate = transResult.items.map(t => ({
                        ...t,
                        gallery: prop.gallery,
                        kwRef: prop.kwRef || null,
                        kwSource: prop.kwSource || null,
                        bathrooms: prop.bathrooms || 0,
                        wc: prop.wc || 0,
                        yearBuilt: prop.yearBuilt || 0,
                        floor: prop.floor || '',
                        parkings: prop.parkings || 0,
                        sizeSqm: prop.sizeSqm || 0,
                        latitude: prop.latitude || 0,
                        longitude: prop.longitude || 0,
                    }));
                    const result = await wixData.bulkUpdate('PropertyTranslations', toUpdate, { suppressAuth: true });
                    totalUpdated += result.updated || 0;
                }

                await wixData.update('Properties', {
                    ...prop,
                    translationsGalleryFixed: true
                }, { suppressAuth: true });

                log('TRANS_ASC', `Fixed: ${prop.kwRef}`);
            } catch (err) {
                log('TRANS_ASC_ERR', `${prop.kwRef}: ${err.message}`);
            }
        }

        const remaining = await wixData.query('Properties')
            .eq('kwSource', KW7_SOURCE)
            .eq('galleryDimensionsFixed', true)
            .ne('translationsGalleryFixed', true)
            .count({ suppressAuth: true });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log('TRANS_ASC', `Done — updated: ${totalUpdated}, remaining: ${remaining}, elapsed: ${elapsed}s`);
        return { success: true, totalUpdated, remaining, elapsed };
    }
);

export const fixTranslationsDescending = webMethod(
    Permissions.Anyone,
    async () => {
        const MAX_MS = 40 * 1000;
        const startTime = Date.now();
        let totalUpdated = 0;

        while (Date.now() - startTime < MAX_MS) {
            const page = await wixData.query('Properties')
                .eq('kwSource', KW7_SOURCE)
                .eq('galleryDimensionsFixed', true)
                .ne('translationsGalleryFixed', true)
                .descending('_createdDate')
                .limit(1)
                .find({ suppressAuth: true });

            if (page.items.length === 0) { log('TRANS_DESC', 'All done'); break; }

            const prop = page.items[0];
            try {
                const transResult = await wixData.query('PropertyTranslations')
                    .eq('propertyId', prop._id)
                    .find({ suppressAuth: true });

                if (transResult.items.length > 0) {
                    const toUpdate = transResult.items.map(t => ({
                        ...t,
                        gallery: prop.gallery,
                        kwRef: prop.kwRef || null,
                        kwSource: prop.kwSource || null,
                        bathrooms: prop.bathrooms || 0,
                        wc: prop.wc || 0,
                        yearBuilt: prop.yearBuilt || 0,
                        floor: prop.floor || '',
                        parkings: prop.parkings || 0,
                        sizeSqm: prop.sizeSqm || 0,
                        latitude: prop.latitude || 0,
                        longitude: prop.longitude || 0,
                    }));
                    const result = await wixData.bulkUpdate('PropertyTranslations', toUpdate, { suppressAuth: true });
                    totalUpdated += result.updated || 0;
                }

                await wixData.update('Properties', {
                    ...prop,
                    translationsGalleryFixed: true
                }, { suppressAuth: true });

                log('TRANS_DESC', `Fixed: ${prop.kwRef}`);
            } catch (err) {
                log('TRANS_DESC_ERR', `${prop.kwRef}: ${err.message}`);
            }
        }

        const remaining = await wixData.query('Properties')
            .eq('kwSource', KW7_SOURCE)
            .eq('galleryDimensionsFixed', true)
            .ne('translationsGalleryFixed', true)
            .count({ suppressAuth: true });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log('TRANS_DESC', `Done — updated: ${totalUpdated}, remaining: ${remaining}, elapsed: ${elapsed}s`);
        return { success: true, totalUpdated, remaining, elapsed };
    }
);
export const fixLocationMapping = webMethod(
    Permissions.Anyone,
    async () => {
        const MAX_MS = 45 * 1000;
        const startTime = Date.now();
        let totalUpdated = 0;

        while (Date.now() - startTime < MAX_MS) {
            const page = await wixData.query('Properties')
                .eq('kwSource', KW7_SOURCE)
                .ne('locationFixed', true)
                .limit(200)
                .find({ suppressAuth: true });

            if (page.items.length === 0) { log('LOC_FIX', 'All done'); break; }

            const toUpdate = page.items.map(p => ({
                ...p,
                // Current: stateCity=area, neighbourhood=district
                // Fix: swap them
                stateCity: p.neighbourhood, // was district, now correctly city
                neighbourhood: p.stateCity, // was area, now correctly neighbourhood
                location: p.neighbourhood, // district as display alias
                locationFixed: true
            }));

            const result = await wixData.bulkUpdate('Properties', toUpdate, { suppressAuth: true });
            totalUpdated += result.updated || 0;
            log('LOC_FIX', `Updated ${result.updated}, total: ${totalUpdated}`);

            if (page.items.length < 200) break;
        }

        const remaining = await wixData.query('Properties')
            .eq('kwSource', KW7_SOURCE)
            .ne('locationFixed', true)
            .count({ suppressAuth: true });

        return { success: true, totalUpdated, remaining };
    }
);

export const verifyLocationMapping = webMethod(
    Permissions.Anyone,
    async () => {
        const result = await wixData.query('Properties')
            .eq('kwSource', KW7_SOURCE)
            .limit(10)
            .find({ suppressAuth: true });

        return result.items.map(p => ({
            kwRef: p.kwRef,
            title: p.title,
            state: p.state, // should be district e.g. "Paphos"
            stateCity: p.stateCity, // should be city e.g. "Paphos" or "Limassol"
            neighbourhood: p.neighbourhood, // should be area e.g. "Universal", "Chloraka"
            location: p.location
        }));
    }
);

export const checkOneProperty = webMethod(
    Permissions.Anyone,
    async () => {
        const result = await wixData.query('Properties')
            .eq('kwRef', 'EK-0005-S')
            .find({ suppressAuth: true });
        const p = result.items[0];
        return {
            stateCity: p.stateCity,
            neighbourhood: p.neighbourhood,
            location: p.location,
            locationFixed: p.locationFixed
        };
    }
);

export const comparePropertyVsTranslation = webMethod(
    Permissions.Anyone,
    async () => {
        // Get one KW7 property that has all new fields
        const propResult = await wixData.query('Properties')
            .eq('kwSource', KW7_SOURCE)
            .eq('translationsCompleted', true)
            .limit(1)
            .find({ suppressAuth: true });

        if (propResult.items.length === 0) {
            return { success: false, error: 'No translated KW7 properties found' };
        }

        const prop = propResult.items[0];

        // Get its EN translation
        const transResult = await wixData.query('PropertyTranslations')
            .eq('propertyId', prop._id)
            .eq('language', 'en')
            .limit(1)
            .find({ suppressAuth: true });

        if (transResult.items.length === 0) {
            return { success: false, error: 'No translation found for this property' };
        }

        const trans = transResult.items[0];

        const propFields = Object.keys(prop);
        const transFields = Object.keys(trans);

        // Fields in Properties but missing from Translation
        const missingInTranslation = propFields.filter(f =>
            !transFields.includes(f) &&
            !['_id', '_owner', '_createdDate', '_updatedDate', 'translationsCompleted',
                'translationError', 'sourceLanguage', 'availableLanguages', 'updatedAt',
                'featured', 'locationFixed', 'galleryImported', 'galleryFormatFixed',
                'galleryDimensionsFixed', 'translationsGalleryFixed', 'kwDateUpdated',
                'kwLastSynced', 'kwStatus'
            ].includes(f)
        );

        // Fields in Translation but missing from Properties (unexpected)
        const extraInTranslation = transFields.filter(f =>
            !propFields.includes(f) &&
            !['_id', '_owner', '_createdDate', '_updatedDate', 'propertyId', 'language',
                'isSource', 'autoTranslated', 'originalLanguage', 'lastTranslated',
                'locationFixed', 'link-property-translations-title'
            ].includes(f)
        );

        // For missing fields — show current value in Properties so we know what's lost
        const missingWithValues = {};
        missingInTranslation.forEach(f => {
            missingWithValues[f] = prop[f];
        });

        return {
            success: true,
            propertyId: prop._id,
            kwRef: prop.kwRef,
            title: prop.title,
            missingInTranslation: {
                count: missingInTranslation.length,
                fields: missingWithValues
            },
            extraInTranslation: {
                count: extraInTranslation.length,
                fields: extraInTranslation
            },
            allPropertyFields: propFields.sort(),
            allTranslationFields: transFields.sort()
        };
    }
);

export const countMissingFields = webMethod(
    Permissions.Anyone,
    async () => {
        const missing = await wixData.query('PropertyTranslations')
            .eq('language', 'en')
            .ne('locationFixed', true)
            .count({ suppressAuth: true });

        const total = await wixData.query('PropertyTranslations')
            .eq('language', 'en')
            .count({ suppressAuth: true });

        return { total, missingFields: missing };
    }
);

export const patchTranslationsAscending = webMethod(
    Permissions.Anyone,
    async () => {
        const MAX_MS = 45 * 1000;
        const startTime = Date.now();
        let totalUpdated = 0;

        while (Date.now() - startTime < MAX_MS) {
            const propPage = await wixData.query('Properties')
                .eq('kwSource', KW7_SOURCE)
                .ne('fieldsPatchDone', true)
                .ascending('_createdDate')
                .limit(1)
                .find({ suppressAuth: true });

            if (propPage.items.length === 0) { log('PATCH_ASC', 'All done'); break; }

            const prop = propPage.items[0];
            try {
                const transResult = await wixData.query('PropertyTranslations')
                    .eq('propertyId', prop._id)
                    .find({ suppressAuth: true });

                if (transResult.items.length > 0) {
                    const toUpdate = transResult.items.map(t => ({
                        ...t,
                        location: prop.location || '',
                        bedroomRange: prop.bedroomRange || '',
                        priceRange: prop.priceRange || '',
                        kwRef: prop.kwRef || null,
                        kwSource: prop.kwSource || null,
                        bathrooms: prop.bathrooms || 0,
                        wc: prop.wc || 0,
                        yearBuilt: prop.yearBuilt || 0,
                        floor: prop.floor || '',
                        parkings: prop.parkings || 0,
                        sizeSqm: prop.sizeSqm || 0,
                        latitude: prop.latitude || 0,
                        longitude: prop.longitude || 0,
                        propertyStatus: prop.propertyStatus || null,
                        closeToSea: !!prop.closeToSea,
                        seaView: !!prop.seaView,
                        stateCity: prop.stateCity || '',
                        neighbourhood: prop.neighbourhood || '',
                        state: prop.state || '',
                    }));
                    const result = await wixData.bulkUpdate('PropertyTranslations', toUpdate, { suppressAuth: true });
                    totalUpdated += result.updated || 0;
                }

                await wixData.update('Properties', { ...prop, fieldsPatchDone: true }, { suppressAuth: true });
                log('PATCH_ASC', `Patched: ${prop.kwRef}`);

            } catch (err) {
                log('PATCH_ASC_ERR', `${prop.kwRef}: ${err.message}`);
            }
        }

        const remaining = await wixData.query('Properties')
            .eq('kwSource', KW7_SOURCE)
            .ne('fieldsPatchDone', true)
            .count({ suppressAuth: true });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log('PATCH_ASC', `Done — updated: ${totalUpdated}, remaining: ${remaining}, elapsed: ${elapsed}s`);
        return { success: true, totalUpdated, remaining, elapsed };
    }
);

export const patchTranslationsDescending = webMethod(
    Permissions.Anyone,
    async () => {
        const MAX_MS = 45 * 1000;
        const startTime = Date.now();
        let totalUpdated = 0;

        while (Date.now() - startTime < MAX_MS) {
            const propPage = await wixData.query('Properties')
                .eq('kwSource', KW7_SOURCE)
                .ne('fieldsPatchDone', true)
                .descending('_createdDate')
                .limit(1)
                .find({ suppressAuth: true });

            if (propPage.items.length === 0) { log('PATCH_DESC', 'All done'); break; }

            const prop = propPage.items[0];
            try {
                const transResult = await wixData.query('PropertyTranslations')
                    .eq('propertyId', prop._id)
                    .find({ suppressAuth: true });

                if (transResult.items.length > 0) {
                    const toUpdate = transResult.items.map(t => ({
                        ...t,
                        location: prop.location || '',
                        bedroomRange: prop.bedroomRange || '',
                        priceRange: prop.priceRange || '',
                        kwRef: prop.kwRef || null,
                        kwSource: prop.kwSource || null,
                        bathrooms: prop.bathrooms || 0,
                        wc: prop.wc || 0,
                        yearBuilt: prop.yearBuilt || 0,
                        floor: prop.floor || '',
                        parkings: prop.parkings || 0,
                        sizeSqm: prop.sizeSqm || 0,
                        latitude: prop.latitude || 0,
                        longitude: prop.longitude || 0,
                        propertyStatus: prop.propertyStatus || null,
                        closeToSea: !!prop.closeToSea,
                        seaView: !!prop.seaView,
                        stateCity: prop.stateCity || '',
                        neighbourhood: prop.neighbourhood || '',
                        state: prop.state || '',
                    }));
                    const result = await wixData.bulkUpdate('PropertyTranslations', toUpdate, { suppressAuth: true });
                    totalUpdated += result.updated || 0;
                }

                await wixData.update('Properties', { ...prop, fieldsPatchDone: true }, { suppressAuth: true });
                log('PATCH_DESC', `Patched: ${prop.kwRef}`);

            } catch (err) {
                log('PATCH_DESC_ERR', `${prop.kwRef}: ${err.message}`);
            }
        }

        const remaining = await wixData.query('Properties')
            .eq('kwSource', KW7_SOURCE)
            .ne('fieldsPatchDone', true)
            .count({ suppressAuth: true });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log('PATCH_DESC', `Done — updated: ${totalUpdated}, remaining: ${remaining}, elapsed: ${elapsed}s`);
        return { success: true, totalUpdated, remaining, elapsed };
    }
);

export const debugTranslationVsProperty = webMethod(
    Permissions.Anyone,
    async () => {
        const PROPERTY_ID = '3f3e6217-7c5d-4185-8be2-5fdf79614503';

        // Get the parent Properties record
        const prop = await wixData.get('Properties', PROPERTY_ID, { suppressAuth: true });

        // Get all translation rows for this property
        const transResult = await wixData.query('PropertyTranslations')
            .eq('propertyId', PROPERTY_ID)
            .find({ suppressAuth: true });

        const trans = transResult.items.find(t => t.language === 'en') || transResult.items[0];

        // Compare the fields we care about
        const fieldsToCheck = [
            'location', 'bedroomRange', 'priceRange',
            'kwRef', 'kwSource', 'bathrooms', 'wc', 'yearBuilt',
            'floor', 'parkings', 'sizeSqm', 'latitude', 'longitude',
            'propertyStatus', 'closeToSea', 'seaView',
            'stateCity', 'neighbourhood', 'state',
            'fieldsPatchDone'
        ];

        const comparison = {};
        fieldsToCheck.forEach(f => {
            comparison[f] = {
                inProperties       : prop?.[f] ?? 'MISSING',
                inTranslation      : trans?.[f] ?? 'MISSING',
                match              : prop?.[f] === trans?.[f]
            };
        });

        return {
            success           : true,
            propertyId        : PROPERTY_ID,
            fieldsPatchDone   : prop?.fieldsPatchDone,
            translationCount  : transResult.items.length,
            translationLanguages: transResult.items.map(t => t.language),
            comparison
        };
    }
);


export const patchNonKw7Translations = webMethod(
    Permissions.Anyone,
    async () => {
        const MAX_MS = 45 * 1000;
        const startTime = Date.now();
        let totalUpdated = 0;

        while (Date.now() - startTime < MAX_MS) {
            const propPage = await wixData.query('Properties')
                .ne('kwSource', KW7_SOURCE)
                .ne('fieldsPatchDone', true)
                .ascending('_createdDate')
                .limit(1)
                .find({ suppressAuth: true });

            if (propPage.items.length === 0) { log('PATCH_NON_KW7', 'All done'); break; }

            const prop = propPage.items[0];
            try {
                const transResult = await wixData.query('PropertyTranslations')
                    .eq('propertyId', prop._id)
                    .find({ suppressAuth: true });

                if (transResult.items.length > 0) {
                    const toUpdate = transResult.items.map(t => ({
                        ...t,
                        location    : prop.location     || '',
                        bedroomRange: prop.bedroomRange || '',
                        priceRange  : prop.priceRange   || '',
                    }));
                    const result = await wixData.bulkUpdate('PropertyTranslations', toUpdate, { suppressAuth: true });
                    totalUpdated += result.updated || 0;
                }

                await wixData.update('Properties', { ...prop, fieldsPatchDone: true }, { suppressAuth: true });
                log('PATCH_NON_KW7', `Patched: ${prop._id}`);

            } catch (err) {
                log('PATCH_NON_KW7_ERR', `${prop._id}: ${err.message}`);
            }
        }

        const remaining = await wixData.query('Properties')
            .ne('kwSource', KW7_SOURCE)
            .ne('fieldsPatchDone', true)
            .count({ suppressAuth: true });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log('PATCH_NON_KW7', `Done — updated: ${totalUpdated}, remaining: ${remaining}, elapsed: ${elapsed}s`);
        return { success: true, totalUpdated, remaining, elapsed };
    }
);


export const countKwContactInDescriptions = webMethod(
    Permissions.Anyone,
    async () => {
        let offset = 0;
        let totalChecked = 0;
        let propertiesWithKw = 0;
        let translationsWithKw = 0;

        // KW contact patterns to detect
        const hasKwContact = (text) => {
            if (!text) return false;
            return /kw(cyprus|seven|paphos|limassol|nicosia|larnaca|famagusta)/i.test(text) ||
                   /@kw[a-z]+\./i.test(text) ||
                   /keller\s*williams/i.test(text) ||
                   /kwcyprus\.com/i.test(text);
        };

        // ── Check Properties ─────────────────────────────────
        offset = 0;
        while (true) {
            const page = await wixData.query('Properties')
                .eq('kwSource', KW7_SOURCE)
                .limit(200)
                .skip(offset)
                .find({ suppressAuth: true });

            if (page.items.length === 0) break;

            page.items.forEach(p => {
                totalChecked++;
                if (hasKwContact(p.description) || hasKwContact(p.shortDescription)) {
                    propertiesWithKw++;
                }
            });

            if (page.items.length < 200) break;
            offset += 200;
        }

        // ── Check PropertyTranslations (EN only — same content) ──
        offset = 0;
        while (true) {
            const page = await wixData.query('PropertyTranslations')
                .eq('kwSource', KW7_SOURCE)
                .eq('language', 'en')
                .limit(200)
                .skip(offset)
                .find({ suppressAuth: true });

            if (page.items.length === 0) break;

            page.items.forEach(t => {
                if (hasKwContact(t.description) || hasKwContact(t.shortDescription)) {
                    translationsWithKw++;
                }
            });

            if (page.items.length < 200) break;
            offset += 200;
        }

        // Sample one affected description so we can see what needs stripping
        const sample = await wixData.query('Properties')
            .eq('kwSource', KW7_SOURCE)
            .limit(200)
            .find({ suppressAuth: true });

        const affected = sample.items.find(p =>
            hasKwContact(p.description) || hasKwContact(p.shortDescription)
        );

        return {
            success: true,
            totalKw7PropertiesChecked: totalChecked,
            propertiesNeedingFix     : propertiesWithKw,
            translationsNeedingFix   : translationsWithKw,
            sampleDescription        : affected?.description?.slice(0, 500) || 'none found in sample'
        };
    }
);

export const backupDescriptions = webMethod(
    Permissions.Anyone,
    async () => {
        const MAX_MS = 45 * 1000;
        const startTime = Date.now();
        let totalBacked = 0;

        while (Date.now() - startTime < MAX_MS) {
            const page = await wixData.query('Properties')
                .eq('kwSource', KW7_SOURCE)
                .ne('descriptionBacked', true)
                .limit(200)
                .find({ suppressAuth: true });

            if (page.items.length === 0) { log('BACKUP', 'All done'); break; }

            const toUpdate = page.items.map(p => ({
                ...p,
                descriptionOriginal     : p.description      || '',
                shortDescriptionOriginal: p.shortDescription || '',
                descriptionBacked       : true
            }));

            const result = await wixData.bulkUpdate('Properties', toUpdate, { suppressAuth: true });
            totalBacked += result.updated || 0;
            log('BACKUP', `Backed up ${result.updated}, total: ${totalBacked}`);

            if (page.items.length < 200) break;
        }

        const remaining = await wixData.query('Properties')
            .eq('kwSource', KW7_SOURCE)
            .ne('descriptionBacked', true)
            .count({ suppressAuth: true });

        return { success: true, totalBacked, remaining };
    }
);


export const sampleKwDescription = webMethod(
    Permissions.Anyone,
    async () => {
        const hasKwContact = (text) => {
            if (!text) return false;
            return /kw(cyprus|seven|paphos|limassol|nicosia|larnaca|famagusta)/i.test(text) ||
                   /@kw[a-z]+\./i.test(text) ||
                   /keller\s*williams/i.test(text) ||
                   /kwcyprus\.com/i.test(text);
        };

        const page = await wixData.query('Properties')
            .eq('kwSource', KW7_SOURCE)
            .limit(200)
            .find({ suppressAuth: true });

        const affected = page.items
            .filter(p => hasKwContact(p.description))
            .slice(0, 3)
            .map(p => ({
                kwRef      : p.kwRef,
                description: p.description
            }));

        return { success: true, samples: affected };
    }
);

export const testDescriptionCleaner = webMethod(
    Permissions.Anyone,
    async () => {
        function cleanDescription(text) {
            if (!text) return '';
            return text
                // Remove "Keller Williams [Office]\n ·\n" header at start
                .replace(/^Keller\s+Williams[^\n]*\n\s*·\s*\n/i, '')
                // Remove "Contact KW..." lines
                .replace(/contact\s+kw[^\n]*/gi, '')
                // Remove KW email addresses
                .replace(/[\w.]+@kw[a-z]+\.[a-z]+/gi, '')
                // Remove Cyprus phone numbers (+357...)
                .replace(/\+357[\s\d-]{8,}/g, '')
                // Remove lines that are ONLY "KW [something]" 
                .replace(/^kw\s+\w+[^\n]*\n?/gim, '')
                // Remove "Keller Williams" mentions mid-text
                .replace(/Keller\s+Williams[^\n]*/gi, '')
                // Clean up multiple blank lines left behind
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        }

        // Test on 3 affected properties — show before and after
        const hasKwContact = (text) => {
            if (!text) return false;
            return /kw(cyprus|seven|paphos|limassol|nicosia|larnaca|famagusta)/i.test(text) ||
                   /@kw[a-z]+\./i.test(text) ||
                   /keller\s*williams/i.test(text);
        };

        const page = await wixData.query('Properties')
            .eq('kwSource', KW7_SOURCE)
            .limit(200)
            .find({ suppressAuth: true });

        const samples = page.items
            .filter(p => hasKwContact(p.description))
            .slice(0, 3)
            .map(p => ({
                kwRef      : p.kwRef,
                before     : p.description,
                after      : cleanDescription(p.description),
                beforeShort: p.shortDescription,
                afterShort : cleanDescription(p.shortDescription)
            }));

        return { success: true, samples };
    }
);

export const stripKwContactDetails = webMethod(
    Permissions.Anyone,
    async () => {
        const MAX_MS = 45 * 1000;
        const startTime = Date.now();
        let totalUpdated = 0;

        function cleanDescription(text) {
            if (!text) return '';
            return text
                .replace(/^Keller\s+Williams[^\n]*\n\s*·\s*\n/i, '')
                .replace(/contact\s+kw[^\n]*/gi, '')
                .replace(/[\w.]+@kw[a-z]+\.[a-z]+/gi, '')
                .replace(/\+357[\s\d-]{8,}/g, '')
                .replace(/^kw\s+\w+[^\n]*\n?/gim, '')
                .replace(/Keller\s+Williams[^\n]*/gi, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        }

        function buildShortDescription(cleanedDescription) {
            return cleanedDescription
                .replace(/\n/g, ' ')
                .trim()
                .slice(0, 250);
        }

        const hasKwContact = (text) => {
            if (!text) return false;
            return /kw(cyprus|seven|paphos|limassol|nicosia|larnaca|famagusta)/i.test(text) ||
                   /@kw[a-z]+\./i.test(text) ||
                   /keller\s*williams/i.test(text);
        };

        while (Date.now() - startTime < MAX_MS) {
            const page = await wixData.query('Properties')
                .eq('kwSource', KW7_SOURCE)
                .ne('descriptionCleaned', true)
                .limit(200)
                .find({ suppressAuth: true });

            if (page.items.length === 0) { log('KW_CLEAN', 'All done'); break; }

            const toUpdate = page.items.map(p => {
                const cleanedDesc  = cleanDescription(p.description);
                const cleanedShort = buildShortDescription(cleanedDesc);
                return {
                    ...p,
                    description     : cleanedDesc,
                    shortDescription: cleanedShort,
                    descriptionCleaned: true
                };
            });

            const result = await wixData.bulkUpdate('Properties', toUpdate, { suppressAuth: true });
            totalUpdated += result.updated || 0;
            log('KW_CLEAN', `Cleaned ${result.updated}, total: ${totalUpdated}`);

            if (page.items.length < 200) break;
        }

        const remaining = await wixData.query('Properties')
            .eq('kwSource', KW7_SOURCE)
            .ne('descriptionCleaned', true)
            .count({ suppressAuth: true });

        return { success: true, totalUpdated, remaining };
    }
);
function cleanDescription(text) {
    if (!text) return '';
    return text
        .replace(/^Keller\s+Williams[^\n]*\n\s*·\s*\n/i, '')
        .replace(/contact\s+kw[^\n]*/gi, '')
        .replace(/[\w.]+@kw[a-z]+\.[a-z]+/gi, '')
        .replace(/\+357[\s\d-]{8,}/g, '')
        .replace(/^kw\s+\w+[^\n]*\n?/gim, '')
        .replace(/Keller\s+Williams[^\n]*/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// shortDescription always regenerated from cleaned description
function buildShortDescription(cleanedDescription) {
    return cleanedDescription
        .replace(/\n/g, ' ')
        .trim()
        .slice(0, 250);
}

export const resetKwAffectedTranslations = webMethod(
    Permissions.Anyone,
    async () => {
        const MAX_MS = 45 * 1000;
        const startTime = Date.now();
        let totalReset = 0;
        let offset = 0;

        while (Date.now() - startTime < MAX_MS) {
            const page = await wixData.query('Properties')
                .eq('kwSource', KW7_SOURCE)
                .limit(200)
                .skip(offset)
                .find({ suppressAuth: true });

            if (page.items.length === 0) break;

            // Only reset ones where description actually changed
            const affected = page.items.filter(p =>
                p.descriptionOriginal &&
                p.description !== p.descriptionOriginal
            );

            if (affected.length > 0) {
                const toUpdate = affected.map(p => ({
                    ...p,
                    translationsCompleted: false
                }));

                const result = await wixData.bulkUpdate('Properties', toUpdate, { suppressAuth: true });
                totalReset += result.updated || 0;
                log('KW_RESET', `Reset ${result.updated} at offset ${offset}, total: ${totalReset}`);
            }

            if (page.items.length < 200) break;
            offset += 200;
        }

        return { success: true, totalReset };
    }
);

export const sampleRemainingKwIssues = webMethod(
    Permissions.Anyone,
    async () => {
        const hasKwRemaining = (text) => {
            if (!text) return false;
            return /kw\s+seven/i.test(text) ||
                   /contact\s+phone/i.test(text) ||
                   /website\s*:/i.test(text) ||
                   /keller\s*williams/i.test(text);
        };

        let offset = 0;
        const samples = [];

        while (samples.length < 3) {
            const page = await wixData.query('Properties')
                .eq('kwSource', KW7_SOURCE)
                .limit(200)
                .skip(offset)
                .find({ suppressAuth: true });

            if (page.items.length === 0) break;

            page.items.forEach(p => {
                if (samples.length < 3 && hasKwRemaining(p.description)) {
                    samples.push({
                        kwRef      : p.kwRef,
                        description: p.description
                    });
                }
            });

            if (page.items.length < 200) break;
            offset += 200;
        }

        return { success: true, count: samples.length, samples };
    }
);


export const stripKwContactDetailsV2 = webMethod(
    Permissions.Anyone,
    async () => {
        const MAX_MS = 45 * 1000;
        const startTime = Date.now();
        let totalCleaned = 0;
        let totalSkipped = 0;

        function cleanDescription(text) {
            if (!text) return text;
            return text
                .replace(/^Keller\s+Williams[^\n]*\n\s*·\s*\n/i, '')
                .replace(/KW\s+Seven[^.]*,\s*contact\s+phone:[^,]*,\s*email:[^,]*,\s*website:[^\n]*/gi, '')
                .replace(/Under\s+the\s+Authoris[^\n]*/gi, '')
                .replace(/KW\s+Seven[^\n]*/gi, '')
                .replace(/Licen[sc]e\s+No\.?[^\n]*/gi, '')
                .replace(/Reg\.?\s+No\.?[^\n]*/gi, '')
                .replace(/[\w.]+@kw[a-z]+\.[a-z]+/gi, '')
                .replace(/\+357[\s\d-]{8,}/g, '')
                .replace(/contact\s+kw[^\n]*/gi, '')
                .replace(/Keller\s+Williams[^\n]*/gi, '')
                .replace(/,\s*,/g, ',')
                .replace(/\.\s*\./g, '.')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        }

        function buildShortDescription(cleanedDescription) {
            return cleanedDescription
                .replace(/\n/g, ' ')
                .trim()
                .slice(0, 250);
        }

        while (Date.now() - startTime < MAX_MS) {
            const page = await wixData.query('Properties')
                .eq('kwSource', KW7_SOURCE)
                .ne('descriptionCleanedV2', true)
                .limit(200)
                .find({ suppressAuth: true });

            if (page.items.length === 0) { log('KW_CLEAN_V2', 'All done'); break; }

            const toUpdate = [];

            for (const p of page.items) {
                const cleanedDesc  = cleanDescription(p.description  || '');
                const cleanedShort = buildShortDescription(cleanedDesc);

                // Only flag as affected if description actually changed
                const wasAffected = cleanedDesc !== (p.description || '').trim();

                toUpdate.push({
                    ...p,
                    description           : cleanedDesc,
                    shortDescription      : cleanedShort,
                    descriptionCleanedV2  : true,   // always mark as processed
                    descriptionV2Affected : wasAffected  // true only if something changed
                });

                if (wasAffected) totalCleaned++;
                else totalSkipped++;
            }

            await wixData.bulkUpdate('Properties', toUpdate, { suppressAuth: true });
            log('KW_CLEAN_V2', `Cleaned: ${totalCleaned}, skipped: ${totalSkipped}`);

            if (page.items.length < 200) break;
        }

        const remaining = await wixData.query('Properties')
            .eq('kwSource', KW7_SOURCE)
            .ne('descriptionCleanedV2', true)
            .count({ suppressAuth: true });

        return { success: true, totalCleaned, totalSkipped, remaining };
    }
);


export const resetV2AffectedTranslations = webMethod(
    Permissions.Anyone,
    async () => {
        const MAX_MS = 45 * 1000;
        const startTime = Date.now();
        let totalReset = 0;

        while (Date.now() - startTime < MAX_MS) {
            const page = await wixData.query('Properties')
                .eq('kwSource', KW7_SOURCE)
                .eq('descriptionV2Affected', true)
                .eq('translationsCompleted', true)
                .limit(200)
                .find({ suppressAuth: true });

            if (page.items.length === 0) { log('KW_RESET_V2', 'All done'); break; }

            const toUpdate = page.items.map(p => ({
                ...p,
                translationsCompleted: false
            }));

            const result = await wixData.bulkUpdate('Properties', toUpdate, { suppressAuth: true });
            totalReset += result.updated || 0;
            log('KW_RESET_V2', `Reset ${result.updated}, total: ${totalReset}`);

            if (page.items.length < 200) break;
        }

        return { success: true, totalReset };
    }
);