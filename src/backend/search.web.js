import { Permissions, webMethod } from "wix-web-module";
import wixData from 'wix-data';

export const findPropertiesWithHotelInTitle = webMethod(
    Permissions.Anyone,
    async () => {
        let offset = 0;
        const results = [];

        while (true) {
            const page = await wixData.query('Properties')
                .limit(1000)
                .skip(offset)
                .find({ suppressAuth: true });

            if (page.items.length === 0) break;

            page.items.forEach(p => {
                if (p.title && /hotel/i.test(p.title)) {
                    results.push({
                        kwRef: p.kwRef || null,
                        title: p.title,
                        propertyType: p.propertyType,
                        status: p.status,
                        country: p.country,
                        stateCity: p.stateCity
                    });
                }
            });

            if (page.items.length < 1000) break;
            offset += 1000;
        }

        return { success: true, count: results.length, results };
    }
);

/**
 * Replace `gallery` on translation items with the authoritative copy from
 * the parent Properties record — removes dependency on translation cron
 * re-syncing gallery after fixes.
 */
async function overrideGalleryFromParent(items) {
    const propertyIds = [...new Set(items.map(i => i.propertyId).filter(Boolean))];
    if (propertyIds.length === 0) return items;

    const galleryMap = new Map();

    for (let i = 0; i < propertyIds.length; i += 100) {
        const chunk = propertyIds.slice(i, i + 100);
        const props = await wixData.query('Properties')
            .hasSome('_id', chunk)
            .limit(100)
            .find({ suppressAuth: true });

        props.items.forEach(p => galleryMap.set(p._id, p.gallery || []));
    }

    return items.map(item => ({
        ...item,
        gallery: galleryMap.has(item.propertyId) ? galleryMap.get(item.propertyId) : item.gallery
    }));
}
/**
 * Build a plain-text bullet list from whatever real data exists.
 * Never fabricates data — only includes a bullet if the source field is present.
 */
function buildHotelHighlights(item) {
    const lines = [];

    // Guest rooms — from bedroom count
    const rooms = item.maxBedrooms || item.minBedrooms;
    if (rooms) lines.push(`${rooms} guest rooms`);

    // Plot + built area
    if (item.plotArea && item.sizeSqm) {
        lines.push(`${item.plotArea} m² plot · ${item.sizeSqm} m² built area`);
    } else if (item.plotArea) {
        lines.push(`${item.plotArea} m² plot`);
    } else if (item.sizeSqm) {
        lines.push(`${item.sizeSqm} m² built area`);
    }

    // Location
    const city = item.neighbourhood || item.stateCity;
    if (city && item.country) {
        const countryStr = Array.isArray(item.country) ? item.country[0] : item.country;
        lines.push(`Prime location in ${city}, ${countryStr}`);
    }

    // Status
    if (item.propertyStatus) lines.push(item.propertyStatus);

    // Amenities — up to 3
    if (Array.isArray(item.investmentOpportunity) && item.investmentOpportunity.length > 0) {
        lines.push(item.investmentOpportunity.slice(0, 3).join(', '));
    }

    // Cap at 5 bullets, plain text with • prefix and line breaks
    return lines.slice(0, 5).map(l => `• ${l}`).join('\n');
}

function buildLocationLine(item) {
    const city = item.neighbourhood || item.stateCity || '';
    const countryStr = Array.isArray(item.country) ? item.country[0] : (item.country || '');
    const parts = [city, countryStr, 'Exclusive listing'].filter(Boolean);
    return parts.join(' · ');
}

/**
 * Returns up to 4 hotel-like properties for the showcase page.
 * Priority: real "Hotel" propertyType tag → title contains "hotel" → random fallback.
 */
export const getHotelShowcaseProperties = webMethod(
    Permissions.Anyone,
    async (language = 'en') => {
        try {
            language = language || 'en';

            // Fetch ALL approved translations for this language (paginated)
            let allItems = [];
            let offset = 0;
            while (true) {
                const page = await wixData.query('PropertyTranslations')
                    .eq('status', 'Approved')
                    .eq('language', language)
                    .limit(1000)
                    .skip(offset)
                    .find({ suppressAuth: true });

                allItems = allItems.concat(page.items);
                if (page.items.length < 1000) break;
                offset += 1000;
            }

            const selected = [];
            const usedIds = new Set();

            // Tier 1 — real "Hotel" propertyType tag
            const tier1 = allItems.filter(item =>
                Array.isArray(item.propertyType) && item.propertyType.includes('Hotel')
            );
            for (const item of tier1) {
                if (selected.length >= 4) break;
                if (!usedIds.has(item.propertyId)) {
                    selected.push(item);
                    usedIds.add(item.propertyId);
                }
            }

            // Tier 2 — title contains "hotel" (case-insensitive)
            if (selected.length < 4) {
                const tier2 = allItems.filter(item =>
                    item.title && /hotel/i.test(item.title) && !usedIds.has(item.propertyId)
                );
                for (const item of tier2) {
                    if (selected.length >= 4) break;
                    selected.push(item);
                    usedIds.add(item.propertyId);
                }
            }

            // Tier 3 — fallback, any random approved property
            if (selected.length < 4) {
                const remaining = allItems.filter(item => !usedIds.has(item.propertyId));
                const shuffled = remaining.sort(() => Math.random() - 0.5);
                for (const item of shuffled) {
                    if (selected.length >= 4) break;
                    selected.push(item);
                    usedIds.add(item.propertyId);
                }
            }
            const selectedWithGallery = await overrideGalleryFromParent(selected);
            const data = selectedWithGallery.map(item => ({
                propertyId: item.propertyId,
                title: item.title || 'Untitled Property',
                description: item.shortDescription || (item.description || '').slice(0, 200),
                image: item.gallery?.[0]?.src || '',
                minPrice: item.minPrice || 0,
                maxPrice: item.maxPrice || 0,
                locationText: buildLocationLine(item),
                highlights: buildHotelHighlights(item),
               url: item['link-property-translations-1-propertyId'] ||  // CHANGED
    `/property-details?propertyId=${item.propertyId}`
            }));

            console.log(`Hotel showcase (${language}): ${data.length} properties selected`);
            return { success: true, data };

        } catch (error) {
            console.error('Error getting hotel showcase properties:', error);
            return { success: false, data: [], error: error.message };
        }
    }
);
async function getAllApprovedTranslations(language) {
    let allItems = [];
    let offset = 0;
    const PAGE = 1000;

    while (true) {
        const page = await wixData.query('PropertyTranslations')
            .eq('status', 'Approved')
            .eq('language', language)
            .limit(PAGE)
            .skip(offset)
            .find({ suppressAuth: true });

        allItems = allItems.concat(page.items);
        if (page.items.length < PAGE) break;
        offset += PAGE;
    }

    return allItems;
}

export const getAllCountries = webMethod(
    Permissions.Anyone,
    async (language = 'en') => {
        try {
            const items = await getAllApprovedTranslations(language);

            const allCountries = [];
            items.forEach(item => {
                if (item.country) {
                    if (Array.isArray(item.country)) {
                        item.country.forEach(c => { if (c?.trim()) allCountries.push(c.trim()); });
                    } else {
                        allCountries.push(item.country.trim());
                    }
                }
            });

            const uniqueCountries = [...new Set(allCountries)].filter(Boolean).sort();
            console.log(`Countries (${language}): ${uniqueCountries.length} from ${items.length} properties`);
            return uniqueCountries.map(c => ({ label: c, value: c }));
        } catch (error) {
            console.error('Error getting countries:', error);
            return [];
        }
    }
);

export const getAllPropertyTypes = webMethod(
    Permissions.Anyone,
    async (language = 'en') => {
        try {
            const items = await getAllApprovedTranslations(language);

            const allTypes = [];
            items.forEach(item => {
                if (item.propertyType) {
                    if (Array.isArray(item.propertyType)) {
                        item.propertyType.forEach(t => { if (t?.trim()) allTypes.push(t.trim()); });
                    } else {
                        allTypes.push(item.propertyType.trim());
                    }
                }
            });

            const uniqueTypes = [...new Set(allTypes)].filter(Boolean).sort();
            console.log(`Property types (${language}): ${uniqueTypes.length} from ${items.length} properties`);
            return uniqueTypes.map(t => ({ label: t, value: t }));
        } catch (error) {
            console.error('Error getting property types:', error);
            return [];
        }
    }
);

export const getAllDealTypes = webMethod(
    Permissions.Anyone,
    async (language = 'en') => {
        try {
            const items = await getAllApprovedTranslations(language);

            const allDealTypes = [];
            items.forEach(item => {
                if (item.dealType) {
                    if (Array.isArray(item.dealType)) {
                        item.dealType.forEach(d => { if (d?.trim()) allDealTypes.push(d.trim()); });
                    } else {
                        allDealTypes.push(item.dealType.trim());
                    }
                }
            });

            const uniqueDealTypes = [...new Set(allDealTypes)].filter(Boolean).sort();
            console.log(`Deal types (${language}): ${uniqueDealTypes.length} from ${items.length} properties`);
            return uniqueDealTypes.map(d => ({ label: d, value: d }));
        } catch (error) {
            console.error('Error getting deal types:', error);
            return [];
        }
    }
);

export const getAllCities = webMethod(
    Permissions.Anyone,
    async (language = 'en') => {
        try {
            const items = await getAllApprovedTranslations(language);

            const uniqueCities = [...new Set(
                items.map(item => item.stateCity).filter(c => c?.trim()).map(c => c.trim())
            )].sort();

            console.log(`Cities (${language}): ${uniqueCities.length} from ${items.length} properties`);
            return uniqueCities.map(c => ({ label: c, value: c }));
        } catch (error) {
            console.error('Error getting cities:', error);
            return [];
        }
    }
);

export const getAllCitiesByCountry = webMethod(
    Permissions.Anyone,
    async (country, language = 'en') => {
        try {
            let allItems = [];
            let offset = 0;
            const PAGE = 1000;

            while (true) {
                const page = await wixData.query('PropertyTranslations')
                    .eq('status', 'Approved')
                    .eq('language', language)
                    .hasSome('country', [country])
                    .limit(PAGE)
                    .skip(offset)
                    .find({ suppressAuth: true });

                allItems = allItems.concat(page.items);
                if (page.items.length < PAGE) break;
                offset += PAGE;
            }

            const uniqueCities = [...new Set(
                allItems.map(item => item.stateCity).filter(c => c?.trim()).map(c => c.trim())
            )].sort();

            console.log(`Cities in ${country} (${language}): ${uniqueCities.length} from ${allItems.length} properties`);
            return uniqueCities.map(c => ({ label: c, value: c }));
        } catch (error) {
            console.error('Error getting cities by country:', error);
            return [];
        }
    }
);

export const getAllNeighbourhoodsByCity = webMethod(
    Permissions.Anyone,
    async (city, language = 'en') => {
        try {
            let allItems = [];
            let offset = 0;
            const PAGE = 1000;

            while (true) {
                const page = await wixData.query('PropertyTranslations')
                    .eq('status', 'Approved')
                    .eq('language', language)
                    .hasSome('stateCity', [city])
                    .limit(PAGE)
                    .skip(offset)
                    .find({ suppressAuth: true });

                allItems = allItems.concat(page.items);
                if (page.items.length < PAGE) break;
                offset += PAGE;
            }

            const uniqueNeighbourhoods = [...new Set(
                allItems.map(item => item.neighbourhood).filter(n => n?.trim()).map(n => n.trim())
            )].sort();

            console.log(`Neighbourhoods in ${city} (${language}): ${uniqueNeighbourhoods.length} from ${allItems.length} properties`);
            return uniqueNeighbourhoods.map(n => ({ label: n, value: n }));
        } catch (error) {
            console.error('Error getting neighbourhoods:', error);
            return [];
        }
    }
);

export const checkTranslationCoverage = webMethod(
    Permissions.Anyone,
    async () => {
        try {
            const ALL_LANGUAGES = ['en', 'de', 'he'];

            // ── 1. Get all approved properties (paginated) ──
            let approvedProps = [];
            let page = 0;
            let hasMore = true;

            while (hasMore) {
                const res = await wixData.query('Properties')
                    .eq('status', 'Approved')
                    .skip(page * 1000)
                    .limit(1000)
                    .find({ suppressAuth: true });

                approvedProps = [...approvedProps, ...res.items];
                hasMore = res.items.length === 1000;
                page++;
            }

            const approvedIds = new Set(approvedProps.map(p => p._id));
            console.log(`📊 Total approved Properties: ${approvedIds.size}`);

            // ── 2. Get all PropertyTranslations (paginated) ──
            let allTranslations = [];
            page = 0;
            hasMore = true;

            while (hasMore) {
                const res = await wixData.query('PropertyTranslations')
                    .skip(page * 1000)
                    .limit(1000)
                    .find({ suppressAuth: true });

                allTranslations = [...allTranslations, ...res.items];
                hasMore = res.items.length === 1000;
                page++;
            }

            console.log(`📊 Total PropertyTranslations rows: ${allTranslations.length}`);

            // ── 3. Group translations by propertyId + language ──
            const coverage = {};
            allTranslations.forEach(t => {
                if (!coverage[t.propertyId]) coverage[t.propertyId] = [];
                coverage[t.propertyId].push(t.language);
            });

            // ── 4. Analyse each approved property ──
            const missingByLang = { en: [], de: [], he: [] };
            const fullyTranslated = [];
            const noTranslations = [];

            approvedIds.forEach(id => {
                const langs = coverage[id] || [];

                if (langs.length === 0) {
                    noTranslations.push(id);
                    ALL_LANGUAGES.forEach(l => missingByLang[l].push(id));
                    return;
                }

                let missing = false;
                ALL_LANGUAGES.forEach(l => {
                    if (!langs.includes(l)) {
                        missingByLang[l].push(id);
                        missing = true;
                    }
                });

                if (!missing) fullyTranslated.push(id);
            });

            const result = {
                success: true,
                summary: {
                    totalApprovedProperties: approvedIds.size,
                    totalTranslationRows: allTranslations.length,
                    fullyTranslated: fullyTranslated.length,
                    noTranslationsAtAll: noTranslations.length,
                },
                perLanguage: {
                    en: { available: approvedIds.size - missingByLang.en.length, missing: missingByLang.en.length },
                    de: { available: approvedIds.size - missingByLang.de.length, missing: missingByLang.de.length },
                    he: { available: approvedIds.size - missingByLang.he.length, missing: missingByLang.he.length },
                },
                missingIds: {
                    en: missingByLang.en,
                    de: missingByLang.de,
                    he: missingByLang.he,
                }
            };

            console.log('✅ Coverage report:', JSON.stringify(result.summary));
            console.log('Per language:', JSON.stringify(result.perLanguage));
            return result;

        } catch (error) {
            console.error('❌ checkTranslationCoverage error:', error);
            return { success: false, error: error.message };
        }
    }
);

export const checkTranslationStatuses = webMethod(
    Permissions.Anyone,
    async () => {
        const res = await wixData.query("PropertyTranslations")
            .eq('language', 'en')
            .limit(1000)
            .find({ suppressAuth: true });

        const statusCounts = {};
        res.items.forEach(item => {
            const s = item.status || 'null/empty';
            statusCounts[s] = (statusCounts[s] || 0) + 1;
        });

        return { totalEnRecords: res.items.length, statusCounts };
    }
);
/**
 * Get up to 6 featured approved properties for the home page.
 * Falls back to 3 latest approved if no featured exist.
 */
export const getFeaturedProperties = webMethod(
    Permissions.Anyone,
    async (language = 'en') => {
        try {
            language = language || 'en';
            // Step 1: get featured property IDs
            const featuredResult = await wixData.query('Properties')
                .eq('status', 'Approved')
                .eq('featured', true)
                .descending('_createdDate')
                .limit(6)
                .find({ suppressAuth: true });

            let propertyIds = featuredResult.items.map(p => p._id);
            let isFeatured = true;

            // Fallback — no featured found, grab 6 latest
            if (propertyIds.length === 0) {
                isFeatured = false;
                const fallbackResult = await wixData.query('Properties')
                    .eq('status', 'Approved')
                    .descending('_createdDate')
                    .limit(6)
                    .find({ suppressAuth: true });
                propertyIds = fallbackResult.items.map(p => p._id);
            }

            if (propertyIds.length === 0) {
                return { success: true, data: [], isFeatured: false };
            }

            // Step 2: fetch translation for each propertyId directly
            // hasSome doesn't work on reference fields — fetch individually instead
            const translationPromises = propertyIds.map(id =>
                wixData.query('PropertyTranslations')
                .eq('propertyId', id)
                .eq('language', language)
                .limit(1)
                .find({ suppressAuth: true })
                .then(r => r.items[0] || null)
            );

            const translations = (await Promise.all(translationPromises)).filter(Boolean);
            const finalData = await overrideGalleryFromParent(translations);
            console.log(`Featured properties (${language}): ${translations.length} | isFeatured: ${isFeatured}`);

            return {
                success: true,
                data: finalData,
                isFeatured
            };

        } catch (error) {
            console.error('Error getting featured properties:', error);
            return { success: false, error: error.message };
        }
    }
);

export const checkTranslationStatus = webMethod(
    Permissions.Anyone,
    async () => {
        const result = await wixData.query('PropertyTranslations')
            .eq('language', 'en')
            .limit(5)
            .find({ suppressAuth: true });

        return result.items.map(i => ({
            title: i.title,
            status: i.status,
            kwRef: i.kwRef
        }));
    }
);

/**
 * Returns property counts for Cyprus and Greece efficiently (totalCount only, no bulk fetch).
 */
export const getCountryPropertyCounts = webMethod(
    Permissions.Anyone,
    async (language = 'en') => {
        try {
            language = language || 'en';
            const [cyprusResult, greeceResult] = await Promise.all([
                wixData.query("PropertyTranslations")
                .eq('status', 'Approved')
                .eq('language', language)
                .hasSome('country', ['Cyprus'])
                .limit(1)
                .find({ suppressAuth: true }),
                wixData.query("PropertyTranslations")
                .eq('status', 'Approved')
                .eq('language', language)
                .hasSome('country', ['Greece'])
                .limit(1)
                .find({ suppressAuth: true })
            ]);

            console.log(`Country counts — Cyprus: ${cyprusResult.totalCount}, Greece: ${greeceResult.totalCount}`);

            return {
                success: true,
                cyprus: cyprusResult.totalCount,
                greece: greeceResult.totalCount
            };

        } catch (error) {
            console.error("Error getting country counts:", error);
            return { success: false, cyprus: 0, greece: 0 };
        }
    }
);
/**
 * Search properties with pagination and filters
 * @param {Object} params - Search parameters
 * @returns {Promise} Paginated results with properties
 */
export const searchPropertiesPaginated = webMethod(
    Permissions.Anyone,
    async (params) => {
        try {
            const {
                language = 'en',
                    country,
                    city,
                    neighbourhood, // NEW
                    propertyType,
                    bedrooms,
                    propertyStatus,
                    closeToSea,
                    seaView,
                    dealType, // NEW — 'Sale' or 'Rent'
                    sortBy, // NEW — 'priceAsc' | 'priceDesc' | 'newest' | 'oldest'
                    kwRef, // NEW — filter by KW reference ID (admin lookup)
                    page = 1,
                    minPrice,
                    maxPrice,
                    pageSize = 6
            } = params;

            console.log('Search params:', params);

            let query = wixData.query('PropertyTranslations')
                .eq('status', 'Approved')
                .eq('language', language);

            if (country) {
                query = query.hasSome('country', [country]);
            }

            if (city) {
                query = query.hasSome('stateCity', [city]);
            }

            if (neighbourhood) {
                query = query.hasSome('neighbourhood', [neighbourhood]);
            }

            if (propertyType && propertyType.length > 0) {
                query = query.hasSome('propertyType', propertyType);
            }

            if (dealType) {
                query = query.hasSome('dealType', [dealType]);
            }

            if (kwRef) {
                query = query.contains('kwRef', kwRef.trim());
            }

            if (bedrooms) {
                const bedroomsInt = parseInt(bedrooms);
                query = query
                    .le('minBedrooms', bedroomsInt)
                    .ge('maxBedrooms', bedroomsInt);
            }

            if (propertyStatus) {
                query = query.eq('propertyStatus', propertyStatus);
            }

            if (closeToSea === true) {
                query = query.eq('closeToSea', true);
            }

            if (seaView === true) {
                query = query.eq('seaView', true);
            }

            if (minPrice && minPrice > 0) {
                query = query.ge('minPrice', minPrice);
            }
            if (maxPrice && maxPrice > 0) {
                query = query.le('minPrice', maxPrice);
            }

            // ── Sorting ──────────────────────────────────────
            switch (sortBy) {
            case 'priceAsc':
            case 'minPrice': // alias
                query = query.ascending('minPrice');
                break;
            case 'priceDesc':
            case 'maxPrice': // alias
                query = query.descending('minPrice');
                break;
            case 'oldest':
                query = query.ascending('_createdDate');
                break;
            case 'newest':
            default:
                query = query.descending('_createdDate');
                break;
            }

            const countResults = await query.find({ suppressAuth: true });
            const totalCount = countResults.totalCount;
            const totalPages = Math.ceil(totalCount / pageSize);

            const skip = (page - 1) * pageSize;
            query = query.skip(skip).limit(pageSize);

            const results = await query.find({ suppressAuth: true });
            const dataWithGallery = await overrideGalleryFromParent(results.items);
            console.log(`Page ${page}/${totalPages}: Found ${results.items.length} of ${totalCount} properties`);

            return {
                success: true,
                data: dataWithGallery,
                pagination: {
                    currentPage: page,
                    pageSize,
                    totalItems: totalCount,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            };

        } catch (error) {
            console.error('Error searching properties:', error);
            return { success: false, error: error.message };
        }
    }
);
export const inspectPriceIssues = webMethod(
    Permissions.Anyone,
    async () => {
        // The 1 record with minPrice=0, maxPrice>0
        const brokenMin = await wixData.query('Properties')
            .eq('minPrice', 0)
            .gt('maxPrice', 0)
            .find({ suppressAuth: true });

        // Sample 3 records with maxPrice=0, minPrice>0
        const brokenMax = await wixData.query('Properties')
            .eq('maxPrice', 0)
            .gt('minPrice', 0)
            .limit(3)
            .find({ suppressAuth: true });

        return {
            brokenMinPriceRecord: brokenMin.items.map(p => ({
                kwRef: p.kwRef,
                title: p.title,
                minPrice: p.minPrice,
                maxPrice: p.maxPrice
            })),
            sampleBrokenMaxPriceRecords: brokenMax.items.map(p => ({
                kwRef: p.kwRef,
                title: p.title,
                minPrice: p.minPrice,
                maxPrice: p.maxPrice
            }))
        };
    }
);
export const countBadPriceRecords = webMethod(
    Permissions.Anyone,
    async () => {
        let offset = 0;
        let total = 0;
        let zeroMinValidMax = 0; // minPrice=0 but maxPrice>0
        let zeroMaxValidMin = 0; // maxPrice=0 but minPrice>0
        let bothZero = 0;

        while (true) {
            const page = await wixData.query('PropertyTranslations')
                .eq('language', 'en')
                .eq('status', 'Approved')
                .limit(1000)
                .skip(offset)
                .find({ suppressAuth: true });

            if (page.items.length === 0) break;

            page.items.forEach(p => {
                total++;
                const min = p.minPrice || 0;
                const max = p.maxPrice || 0;
                if (min === 0 && max > 0) zeroMinValidMax++;
                if (max === 0 && min > 0) zeroMaxValidMin++;
                if (min === 0 && max === 0) bothZero++;
            });

            if (page.items.length < 1000) break;
            offset += 1000;
        }

        return { total, zeroMinValidMax, zeroMaxValidMin, bothZero };
    }
);
export const findActualBrokenRecord = webMethod(
    Permissions.Anyone,
    async () => {
        let offset = 0;
        const results = [];

        while (true) {
            const page = await wixData.query('PropertyTranslations')
                .eq('language', 'en')
                .eq('status', 'Approved')
                .limit(1000)
                .skip(offset)
                .find({ suppressAuth: true });

            if (page.items.length === 0) break;

            page.items.forEach(t => {
                const min = t.minPrice || 0;
                const max = t.maxPrice || 0;
                if (min === 0 && max > 0) {
                    results.push({
                        propertyId: t.propertyId,
                        kwRef: t.kwRef,
                        title: t.title,
                        minPriceRaw: t.minPrice, // exact stored value
                        maxPriceRaw: t.maxPrice,
                        minPriceType: typeof t.minPrice // 'undefined', 'object' (null), or 'number'
                    });
                }
            });

            if (page.items.length < 1000) break;
            offset += 1000;
        }

        return { count: results.length, results };
    }
);
export const fixMissingMinPrice = webMethod(
    Permissions.Anyone,
    async () => {
        const PROPERTY_ID = '8a76b75a-9a8d-4f3f-ab52-abcc5f926b15';

        const result = await wixData.query('PropertyTranslations')
            .eq('propertyId', PROPERTY_ID)
            .find({ suppressAuth: true });

        const updates = [];
        for (const t of result.items) {
            await wixData.update('PropertyTranslations', {
                ...t,
                minPrice: t.maxPrice
            }, { suppressAuth: true });
            updates.push({ language: t.language, fixedMinPrice: t.maxPrice });
        }

        return { success: true, updated: updates.length, details: updates };
    }
);
/**
 * Get min and max price bounds from all approved properties
 */
export const getPriceBounds = webMethod(
    Permissions.Anyone,
    async (language = 'en') => {
        try {
            const results = await wixData.query("PropertyTranslations")
                .eq('status', 'Approved')
                .eq('language', language)
                .gt('maxPrice', 0)
                .ascending('minPrice')
                .limit(1000)
                .find({ suppressAuth: true });

            if (results.items.length === 0) {
                return { success: true, min: 0, max: 10000000 };
            }

            let globalMin = Infinity;
            let globalMax = 0;

            results.items.forEach(item => {
                const low = item.minPrice || item.maxPrice || 0;
                const high = item.maxPrice || item.minPrice || 0;

                if (low > 0 && low < globalMin) globalMin = low;
                if (high > globalMax) globalMax = high;
            });

            if (globalMin === Infinity) globalMin = 0;

            console.log(`Price bounds (${language}): ${globalMin} - ${globalMax}`);
            return { success: true, min: globalMin, max: globalMax };

        } catch (error) {
            console.error("Error getting price bounds:", error);
            return { success: true, min: 0, max: 10000000 };
        }
    }
);
/**
 * Get English URL for a property by propertyId
 */
export const getPropertyEnglishUrl = webMethod(
    Permissions.Anyone,
    async (propertyId) => {
        try {
            const results = await wixData.query("PropertyTranslations")
                .eq("propertyId", propertyId)
                .eq("language", "en")
                .find({ suppressAuth: true });

            if (results.items.length > 0) {
                const url = results.items[0]['link-property-translations-1-propertyId']; // CHANGED
                return { success: true, url: url || `/property-details?propertyId=${propertyId}` };
            }

            return { success: true, url: `/property-details?propertyId=${propertyId}` };
        } catch (error) {
            console.error("Error getting English URL:", error);
            return { success: false, url: `/property-details?propertyId=${propertyId}` };
        }
    }
);

/**
 * Get properties for a specific hardcoded country with pagination
 * @param {string} language - Language code ('en', 'de', 'he')
 * @param {number} page - Page number (default: 1)
 * @param {number} pageSize - Items per page (default: 6)
 * @returns {Promise} Paginated properties for the specified country
 */
export const getPropertiesByCyprus = webMethod(
    Permissions.Anyone,
    async (language = 'en', page = 1, pageSize = 6) => {
        try {
            // ⭐ HARDCODED COUNTRY - CHANGE THIS VALUE ⭐
            const HARDCODED_COUNTRY = "Cyprus"; // 👈 Change to your desired country

            console.log(`Loading properties for country: ${HARDCODED_COUNTRY}, language: ${language}, page: ${page}`);

            // Build query with hardcoded country filter
            let query = wixData.query("PropertyTranslations")
                .eq('status', 'Approved')
                .eq('language', language)
                .hasSome('country', [HARDCODED_COUNTRY]); // Filter by hardcoded country

            // Get total count first
            const countResults = await query.find({ suppressAuth: true });
            const totalCount = countResults.totalCount;
            const totalPages = Math.ceil(totalCount / pageSize);

            // Apply pagination
            const skip = (page - 1) * pageSize;
            query = query
                .skip(skip)
                .limit(pageSize);

            // Execute query
            const results = await query.find({ suppressAuth: true });

            console.log(`Page ${page}/${totalPages}: Found ${results.items.length} of ${totalCount} properties in ${HARDCODED_COUNTRY}`);

            return {
                success: true,
                data: results.items,
                country: HARDCODED_COUNTRY,
                pagination: {
                    currentPage: page,
                    pageSize: pageSize,
                    totalItems: totalCount,
                    totalPages: totalPages,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            };

        } catch (error) {
            console.error("Error getting properties by country:", error);
            return { success: false, error: error.message };
        }
    }
);
export const getPropertiesByIsrael = webMethod(
    Permissions.Anyone,
    async (language = 'en', page = 1, pageSize = 6) => {
        try {
            // ⭐ HARDCODED COUNTRY - CHANGE THIS VALUE ⭐
            const HARDCODED_COUNTRY = "Israel"; // 👈 Change to your desired country

            console.log(`Loading properties for country: ${HARDCODED_COUNTRY}, language: ${language}, page: ${page}`);

            // Build query with hardcoded country filter
            let query = wixData.query("PropertyTranslations")
                .eq('status', 'Approved')
                .eq('language', language)
                .hasSome('country', [HARDCODED_COUNTRY]); // Filter by hardcoded country

            // Get total count first
            const countResults = await query.find({ suppressAuth: true });
            const totalCount = countResults.totalCount;
            const totalPages = Math.ceil(totalCount / pageSize);

            // Apply pagination
            const skip = (page - 1) * pageSize;
            query = query
                .skip(skip)
                .limit(pageSize);

            // Execute query
            const results = await query.find({ suppressAuth: true });

            console.log(`Page ${page}/${totalPages}: Found ${results.items.length} of ${totalCount} properties in ${HARDCODED_COUNTRY}`);

            return {
                success: true,
                data: results.items,
                country: HARDCODED_COUNTRY,
                pagination: {
                    currentPage: page,
                    pageSize: pageSize,
                    totalItems: totalCount,
                    totalPages: totalPages,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            };

        } catch (error) {
            console.error("Error getting properties by country:", error);
            return { success: false, error: error.message };
        }
    }
);
export const getPropertiesByFrance = webMethod(
    Permissions.Anyone,
    async (language = 'en', page = 1, pageSize = 6) => {
        try {
            // ⭐ HARDCODED COUNTRY - CHANGE THIS VALUE ⭐
            const HARDCODED_COUNTRY = "France"; // 👈 Change to your desired country

            console.log(`Loading properties for country: ${HARDCODED_COUNTRY}, language: ${language}, page: ${page}`);

            // Build query with hardcoded country filter
            let query = wixData.query("PropertyTranslations")
                .eq('status', 'Approved')
                .eq('language', language)
                .hasSome('country', [HARDCODED_COUNTRY]); // Filter by hardcoded country

            // Get total count first
            const countResults = await query.find({ suppressAuth: true });
            const totalCount = countResults.totalCount;
            const totalPages = Math.ceil(totalCount / pageSize);

            // Apply pagination
            const skip = (page - 1) * pageSize;
            query = query
                .skip(skip)
                .limit(pageSize);

            // Execute query
            const results = await query.find({ suppressAuth: true });

            console.log(`Page ${page}/${totalPages}: Found ${results.items.length} of ${totalCount} properties in ${HARDCODED_COUNTRY}`);

            return {
                success: true,
                data: results.items,
                country: HARDCODED_COUNTRY,
                pagination: {
                    currentPage: page,
                    pageSize: pageSize,
                    totalItems: totalCount,
                    totalPages: totalPages,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            };

        } catch (error) {
            console.error("Error getting properties by country:", error);
            return { success: false, error: error.message };
        }
    }
);

export const getPropertiesByGreece = webMethod(
    Permissions.Anyone,
    async (language = 'en', page = 1, pageSize = 6) => {
        try {
            // ⭐ HARDCODED COUNTRY - CHANGE THIS VALUE ⭐
            const HARDCODED_COUNTRY = "Greece"; // 👈 Change to your desired country

            console.log(`Loading properties for country: ${HARDCODED_COUNTRY}, language: ${language}, page: ${page}`);

            // Build query with hardcoded country filter
            let query = wixData.query("PropertyTranslations")
                .eq('status', 'Approved')
                .eq('language', language)
                .hasSome('country', [HARDCODED_COUNTRY]); // Filter by hardcoded country

            // Get total count first
            const countResults = await query.find({ suppressAuth: true });
            const totalCount = countResults.totalCount;
            const totalPages = Math.ceil(totalCount / pageSize);

            // Apply pagination
            const skip = (page - 1) * pageSize;
            query = query
                .skip(skip)
                .limit(pageSize);

            // Execute query
            const results = await query.find({ suppressAuth: true });

            console.log(`Page ${page}/${totalPages}: Found ${results.items.length} of ${totalCount} properties in ${HARDCODED_COUNTRY}`);

            return {
                success: true,
                data: results.items,
                country: HARDCODED_COUNTRY,
                pagination: {
                    currentPage: page,
                    pageSize: pageSize,
                    totalItems: totalCount,
                    totalPages: totalPages,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            };

        } catch (error) {
            console.error("Error getting properties by country:", error);
            return { success: false, error: error.message };
        }
    }
);

/**
 * ALTERNATIVE: Get properties for multiple hardcoded countries
 * Use this if you want to show properties from multiple countries
 */
export const getPropertiesByMultipleCountries = webMethod(
    Permissions.Anyone,
    async (language = 'en', page = 1, pageSize = 6) => {
        try {
            // ⭐ HARDCODED COUNTRIES - CHANGE THESE VALUES ⭐
            const HARDCODED_COUNTRIES = ["Germany", "Austria", "Switzerland"]; // 👈 Add your countries

            console.log(`Loading properties for countries: ${HARDCODED_COUNTRIES.join(', ')}`);

            // Build query with multiple countries filter
            let query = wixData.query("PropertyTranslations")
                .eq('status', 'Approved')
                .eq('language', language)
                .hasSome('country', HARDCODED_COUNTRIES); // Filter by multiple countries

            // Get total count first
            const countResults = await query.find({ suppressAuth: true });
            const totalCount = countResults.totalCount;
            const totalPages = Math.ceil(totalCount / pageSize);

            // Apply pagination
            const skip = (page - 1) * pageSize;
            query = query
                .skip(skip)
                .limit(pageSize);

            // Execute query
            const results = await query.find({ suppressAuth: true });

            console.log(`Page ${page}/${totalPages}: Found ${results.items.length} of ${totalCount} properties`);

            return {
                success: true,
                data: results.items,
                countries: HARDCODED_COUNTRIES,
                pagination: {
                    currentPage: page,
                    pageSize: pageSize,
                    totalItems: totalCount,
                    totalPages: totalPages,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            };

        } catch (error) {
            console.error("Error getting properties by countries:", error);
            return { success: false, error: error.message };
        }
    }
);

/**
 * Debug function to check gallery data for all properties
 * Returns detailed information about properties with missing/invalid gallery data
 */
export const debugPropertyGalleries = webMethod(
    Permissions.Anyone,
    async (language) => {
        try {
            let language = 'en'
            console.log("=== STARTING GALLERY DEBUG ===");

            const results = await wixData.query("PropertyTranslations")
                .eq('status', 'Approved')
                .eq('language', language)
                .limit(1000)
                .find({ suppressAuth: true });

            const report = {
                totalProperties: results.items.length,
                propertiesWithGallery: 0,
                propertiesWithoutGallery: 0,
                propertiesWithEmptyGallery: 0,
                galleryIssues: []
            };

            results.items.forEach((property, index) => {
                const galleryInfo = {
                    index: index + 1,
                    propertyId: property.propertyId,
                    title: property.title || 'No Title',
                    hasGalleryField: property.hasOwnProperty('gallery'),
                    galleryType: typeof property.gallery,
                    galleryValue: property.gallery,
                    galleryLength: Array.isArray(property.gallery) ? property.gallery.length : 'N/A',
                    issue: null
                };

                // Check various gallery states
                if (!property.gallery) {
                    report.propertiesWithoutGallery++;
                    galleryInfo.issue = 'Gallery field is null/undefined';
                    report.galleryIssues.push(galleryInfo);
                } else if (Array.isArray(property.gallery) && property.gallery.length === 0) {
                    report.propertiesWithEmptyGallery++;
                    galleryInfo.issue = 'Gallery array is empty';
                    report.galleryIssues.push(galleryInfo);
                } else if (Array.isArray(property.gallery) && property.gallery.length > 0) {
                    report.propertiesWithGallery++;

                    // Check if gallery items have valid structure
                    const invalidItems = property.gallery.filter(item =>
                        !item || !item.src || typeof item.src !== 'string'
                    );

                    if (invalidItems.length > 0) {
                        galleryInfo.issue = `Gallery has ${invalidItems.length} invalid items`;
                        galleryInfo.sampleInvalidItem = invalidItems[0];
                        report.galleryIssues.push(galleryInfo);
                    }
                } else {
                    galleryInfo.issue = 'Gallery field exists but is not an array';
                    report.galleryIssues.push(galleryInfo);
                }
            });

            console.log("=== GALLERY DEBUG REPORT ===");
            console.log(`Total Properties: ${report.totalProperties}`);
            console.log(`Properties WITH Gallery: ${report.propertiesWithGallery}`);
            console.log(`Properties WITHOUT Gallery: ${report.propertiesWithoutGallery}`);
            console.log(`Properties with EMPTY Gallery: ${report.propertiesWithEmptyGallery}`);
            console.log(`Total Issues Found: ${report.galleryIssues.length}`);

            return {
                success: true,
                report: report,
                // Return first 10 issues for quick review
                sampleIssues: report.galleryIssues.slice(0, 10)
            };

        } catch (error) {
            console.error("Error in gallery debug:", error);
            return { success: false, error: error.message };
        }
    }
);

/**
 * Get specific property details for debugging
 */
export const debugSingleProperty = webMethod(
    Permissions.Anyone,
    async (propertyId, language = 'en') => {
        try {
            const results = await wixData.query("PropertyTranslations")
                .eq("propertyId", propertyId)
                .eq("language", language)
                .find({ suppressAuth: true });

            if (results.items.length > 0) {
                const property = results.items[0];

                console.log("=== PROPERTY DEBUG ===");
                console.log("Property ID:", property.propertyId);
                console.log("Title:", property.title);
                console.log("Gallery exists:", !!property.gallery);
                console.log("Gallery type:", typeof property.gallery);
                console.log("Gallery is array:", Array.isArray(property.gallery));
                console.log("Gallery length:", property.gallery?.length);
                console.log("Gallery content:", JSON.stringify(property.gallery, null, 2));

                return {
                    success: true,
                    property: property,
                    galleryAnalysis: {
                        exists: !!property.gallery,
                        type: typeof property.gallery,
                        isArray: Array.isArray(property.gallery),
                        length: property.gallery?.length || 0,
                        content: property.gallery
                    }
                };
            }

            return { success: false, error: "Property not found" };

        } catch (error) {
            console.error("Error debugging property:", error);
            return { success: false, error: error.message };
        }
    }
);

/**
 * Deep debug - Check actual fields returned for specific properties
 */
export const debugPropertyFields = webMethod(
    Permissions.Anyone,
    async (propertyId, language = 'en') => {
        try {
            const results = await wixData.query("PropertyTranslations")
                .eq("propertyId", propertyId)
                .eq("language", language)
                .find({ suppressAuth: true });

            if (results.items.length > 0) {
                const property = results.items[0];

                // Get ALL field names
                const allFields = Object.keys(property);

                // Check for gallery-related fields
                const galleryFields = allFields.filter(field =>
                    field.toLowerCase().includes('gallery') ||
                    field.toLowerCase().includes('image') ||
                    field.toLowerCase().includes('media') ||
                    field.toLowerCase().includes('photo')
                );

                console.log("=== FIELD DEBUG ===");
                console.log("Property ID:", propertyId);
                console.log("Title:", property.title);
                console.log("All Fields:", allFields);
                console.log("Gallery-related Fields:", galleryFields);

                // Log all gallery-related field values
                galleryFields.forEach(field => {
                    console.log(`${field}:`, property[field]);
                });

                return {
                    success: true,
                    propertyId: propertyId,
                    allFields: allFields,
                    galleryFields: galleryFields,
                    galleryFieldValues: galleryFields.reduce((acc, field) => {
                        acc[field] = property[field];
                        return acc;
                    }, {}),
                    fullProperty: property
                };
            }

            return { success: false, error: "Property not found" };

        } catch (error) {
            console.error("Error debugging property fields:", error);
            return { success: false, error: error.message };
        }
    }
);

/**
 * Compare properties WITH and WITHOUT galleries
 */
export const compareGalleryProperties = webMethod(
    Permissions.Anyone,
    async (language) => {
        try {
            // Get one property WITH gallery
            const withGallery = await wixData.query("PropertyTranslations")
                .eq('status', 'Approved')
                .eq('language', language)
                .limit(1)
                .find({ suppressAuth: true });

            // Get one of the problematic properties
            const withoutGallery = await wixData.query("PropertyTranslations")
                .eq("propertyId", "e70e4c92-0f88-4808-985d-ef11d457a22e") // First problematic one
                .eq('language', language)
                .find({ suppressAuth: true });

            const comparison = {
                withGallery: withGallery.items[0] ? {
                    id: withGallery.items[0].propertyId,
                    title: withGallery.items[0].title,
                    fields: Object.keys(withGallery.items[0]),
                    hasGallery: !!withGallery.items[0].gallery,
                    galleryType: typeof withGallery.items[0].gallery,
                    galleryLength: withGallery.items[0].gallery?.length
                } : null,
                withoutGallery: withoutGallery.items[0] ? {
                    id: withoutGallery.items[0].propertyId,
                    title: withoutGallery.items[0].title,
                    fields: Object.keys(withoutGallery.items[0]),
                    hasGallery: !!withoutGallery.items[0].gallery,
                    galleryType: typeof withoutGallery.items[0].gallery
                } : null
            };

            console.log("=== PROPERTY COMPARISON ===");
            console.log("WITH Gallery Fields:", comparison.withGallery?.fields);
            console.log("WITHOUT Gallery Fields:", comparison.withoutGallery?.fields);

            // Find field differences
            if (comparison.withGallery && comparison.withoutGallery) {
                const fieldsOnlyInWith = comparison.withGallery.fields.filter(
                    f => !comparison.withoutGallery.fields.includes(f)
                );
                const fieldsOnlyInWithout = comparison.withoutGallery.fields.filter(
                    f => !comparison.withGallery.fields.includes(f)
                );

                comparison.fieldDifferences = {
                    onlyInWorking: fieldsOnlyInWith,
                    onlyInBroken: fieldsOnlyInWithout
                };
            }

            return {
                success: true,
                comparison: comparison
            };

        } catch (error) {
            console.error("Error comparing properties:", error);
            return { success: false, error: error.message };
        }
    }
);

//export const getAllDealTypes = webMethod(
//     Permissions.Anyone,
//     async (language = 'en') => {
//         try {
//             const response = await wixData.query('PropertyTranslations')
//                 .eq('status', 'Approved')
//                 .eq('language', language)
//                 .limit(1000)
//                 .find({ suppressAuth: true });

//             const allDealTypes = [];
//             response.items.forEach(item => {
//                 if (item.dealType) {
//                     if (Array.isArray(item.dealType)) {
//                         item.dealType.forEach(d => {
//                             if (d && d.trim()) allDealTypes.push(d.trim());
//                         });
//                     } else {
//                         allDealTypes.push(item.dealType.trim());
//                     }
//                 }
//             });

//             const uniqueDealTypes = [...new Set(allDealTypes)]
//                 .filter(d => d)
//                 .sort();

//             console.log(`Deal types from Approved listings (${language}):`, uniqueDealTypes.length);
//             return uniqueDealTypes.map(d => ({ label: d, value: d }));

//         } catch (error) {
//             console.error('Error getting deal types:', error);
//             return [];
//         }
//     }
// );
// /**
//  * Get neighbourhoods within a specific city (cascades from city dropdown)
//  */
// export const getAllNeighbourhoodsByCity = webMethod(
//     Permissions.Anyone,
//     async (city, language = 'en') => {
//         try {
//             const response = await wixData.query('PropertyTranslations')
//                 .eq('status', 'Approved')
//                 .eq('language', language)
//                 .hasSome('stateCity', [city])
//                 .limit(999)
//                 .find({ suppressAuth: true });

//             const uniqueNeighbourhoods = [...new Set(
//                 response.items
//                     .map(item => item.neighbourhood)
//                     .filter(n => n && n.trim())
//                     .map(n => n.trim())
//             )].sort();

//             return uniqueNeighbourhoods.map(n => ({ label: n, value: n }));
//         } catch (error) {
//             console.error('Error getting neighbourhoods:', error);
//             return [];
//         }
//     }
// );

// /**
//  * Get all unique cities from approved PropertyTranslations for a specific language
//  */
// export const getAllCities = webMethod(
//     Permissions.Anyone,
//     async (language = 'en') => {
//         try {
//             let response = await wixData.query("PropertyTranslations")
//                 .eq('status', 'Approved')
//                 .eq('language', language)
//                 .limit(1000)
//                 .find({ suppressAuth: true });

//             if (response.items && response.items.length > 0) {
//                 const uniqueCities = [...new Set(response.items
//                         .map(item => item.stateCity)
//                         .filter(city => city && city.trim())
//                         .map(city => city.trim()))]
//                     .sort();

//                 let dropdownOptions = uniqueCities.map((item) => {
//                     return {
//                         label: item,
//                         value: item
//                     }
//                 });

//                 console.log(`Cities from Approved listings (${language}):`, dropdownOptions.length);
//                 return dropdownOptions;
//             }
//             return [];
//         } catch (error) {
//             console.error("Error getting cities:", error);
//             return [];
//         }
//     }
// );

// /**
//  * Get cities by country from approved PropertyTranslations
//  */
// export const getAllCitiesByCountry = webMethod(
//     Permissions.Anyone,
//     async (country, language = 'en') => {
//         try {
//             let response = await wixData.query("PropertyTranslations")
//                 .eq('status', 'Approved')
//                 .eq('language', language)
//                 .hasSome("country", [country])
//                 .limit(999)
//                 .find({ suppressAuth: true });

//             if (response.items && response.items.length > 0) {
//                 const uniqueCities = [...new Set(response.items
//                         .map(item => item.stateCity)
//                         .filter(city => city && city.trim())
//                         .map(city => city.trim()))]
//                     .sort();

//                 let dropdownOptions = uniqueCities.map((item) => {
//                     return {
//                         label: item,
//                         value: item
//                     }
//                 });

//                 console.log(`Cities in ${country} (${language}):`, dropdownOptions.length);
//                 return dropdownOptions;
//             }
//             return [];
//         } catch (error) {
//             console.error("Error getting cities by country:", error);
//             return [];
//         }
//     }
// );

// /**
//  * Get all unique property types
//  */
// export const getAllPropertyTypes = webMethod(
//     Permissions.Anyone,
//     async (language = 'en') => {
//         try {
//             let response = await wixData.query("PropertyTranslations")
//                 .eq('status', 'Approved')
//                 .eq('language', language)
//                 .limit(1000)
//                 .find({ suppressAuth: true });

//             if (response.items && response.items.length > 0) {
//                 const allPropertyTypes = [];
//                 response.items.forEach(item => {
//                     if (item.propertyType) {
//                         if (Array.isArray(item.propertyType)) {
//                             item.propertyType.forEach(type => {
//                                 if (type && type.trim()) {
//                                     allPropertyTypes.push(type.trim());
//                                 }
//                             });
//                         } else {
//                             allPropertyTypes.push(item.propertyType.trim());
//                         }
//                     }
//                 });

//                 const uniqueTypes = [...new Set(allPropertyTypes)]
//                     .filter(type => type)
//                     .sort();

//                 let tagOptions = uniqueTypes.map((item) => {
//                     return {
//                         label: item,
//                         value: item
//                     }
//                 });

//                 console.log(`Property types from Approved listings (${language}):`, tagOptions.length);
//                 return tagOptions;
//             }
//             return [];
//         } catch (error) {
//             console.error("Error getting property types:", error);
//             return [];
//         }
//     }
// );

// /**
//  * Get all unique countries
//  */
// export const getAllCountries = webMethod(
//     Permissions.Anyone,
//     async (language = 'en') => {
//         try {
//             let response = await wixData.query("PropertyTranslations")
//                 .eq('status', 'Approved')
//                 .eq('language', language)
//                 .limit(1000)
//                 .find({ suppressAuth: true });

//             if (response.items && response.items.length > 0) {
//                 const allCountries = [];
//                 response.items.forEach(item => {
//                     if (item.country) {
//                         if (Array.isArray(item.country)) {
//                             item.country.forEach(country => {
//                                 if (country && country.trim()) {
//                                     allCountries.push(country.trim());
//                                 }
//                             });
//                         } else {
//                             allCountries.push(item.country.trim());
//                         }
//                     }
//                 });

//                 const uniqueCountries = [...new Set(allCountries)]
//                     .filter(country => country)
//                     .sort();

//                 let dropdownOptions = uniqueCountries.map((item) => {
//                     return {
//                         label: item,
//                         value: item
//                     }
//                 });

//                 console.log(`Countries from Approved listings (${language}):`, dropdownOptions.length);
//                 return dropdownOptions;
//             }
//             return [];
//         } catch (error) {
//             console.error("Error getting countries:", error);
//             return [];
//         }
//     }
// );