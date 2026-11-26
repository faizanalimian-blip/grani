import wixSecretsBackend from 'wix-secrets-backend';
import wixData from 'wix-data';
import { ok, badRequest, notFound, response, serverError } from 'wix-http-functions';
import { processTranslationQueue } from './translationCron.web.js';

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY CACHE for propertyLink lookups
// Module-level Map persists across requests while the function instance stays
// "warm" (not guaranteed on every request — Wix may spin up a fresh cold
// instance at any time). Reduces DB load during hot-loop chatbot calls.
// TTL kept short (5 min) since delisting/translation updates can happen daily.
// ─────────────────────────────────────────────────────────────────────────────
const propertyLinkCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
    "Access-Control-Max-Age": "86400"
};

function getCached(key) {
    const entry = propertyLinkCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
        propertyLinkCache.delete(key);
        return null;
    }
    return entry.data;
}

function setCached(key, data) {
    propertyLinkCache.set(key, { data, cachedAt: Date.now() });
}

 

export async function post_processTranslations(request) {
    try {
        // Log for debugging
        console.log("Function called");
        console.log("Headers:", request.headers);

        // Check secret
        const secret = await wixSecretsBackend.getSecret("CRON_SECRET");
        const providedSecret = request.headers['x-cron-secret'];

        console.log("Expected secret:", secret);
        console.log("Provided secret:", providedSecret);

        if (providedSecret !== secret) {
            return {
                status: 401,
                body: { error: "Unauthorized", provided: providedSecret, expected: secret }
            };
        }

        await processTranslationQueue();

        return {
            status: 200,
            body: { success: true, message: "Translation queue processed" }
        };

    } catch (error) {
        console.error("Error:", error);
        return {
            status: 500,
            body: {
                error: error.message,
                stack: error.stack,
                type: error.constructor.name
            }
        };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPERTY LINK LOOKUP API
// GET /_functions/propertyLink?kwRef=ISL-0025&lang=he
// GET /_functions/propertyLink?propertyId=477fe416-...&lang=en
//
// For external chatbot integration. Requires API key via x-api-key header.
// Secret name in Wix Secrets Manager: PROPERTY_LINK_API_KEY
//
// Uses the officially documented wix-http-functions response builders
// (ok/badRequest/notFound/response/serverError) rather than plain objects,
// per https://dev.wix.com/docs/api-reference/assets/http-functions/rest/sample-flow
// ─────────────────────────────────────────────────────────────────────────────

// Handle browser CORS preflight
export function options_propertyLink(request) {
    return response({
        status: 204,
        headers: CORS_HEADERS
    });
}

export async function get_propertyLink(request) {
    try {
        // ── 1. API key check — first, before any DB work ─────────────────────
        const expectedKey = await wixSecretsBackend.getSecret("PROPERTY_LINK_API_KEY");
        const providedKey = request.headers['x-api-key'];

        if (!providedKey || providedKey !== expectedKey) {
            // 401 has no dedicated helper — use response() with an explicit status
            return response({
                status: 401,
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                body: { success: false, errorCode: "UNAUTHORIZED", error: "Unauthorized — missing or invalid API key" }
            });
        }

        // ── 2. Parse and validate query params ────────────────────────────────
        const query = request.query || {};
        const kwRef = query.kwRef ? query.kwRef.trim() : null;
        const propertyId = query.propertyId ? query.propertyId.trim() : null;
        const lang = query.lang ? query.lang.trim().toLowerCase() : null;

        if (!kwRef && !propertyId) {
            return badRequest({
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                body: { success: false, errorCode: "MISSING_LOOKUP_KEY", error: "Missing required parameter: provide either 'kwRef' or 'propertyId'" }
            });
        }

        if (!lang) {
            return badRequest({
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                body: { success: false, errorCode: "MISSING_LANGUAGE", error: "Missing required parameter: 'lang'" }
            });
        }

        // ── 2b. Cache check — skip all DB work on a warm-instance cache hit ────
        const cacheKey = `${kwRef || propertyId}:${lang}`;
        const cachedResult = getCached(cacheKey);
        if (cachedResult) {
            return ok({
                headers: { ...CORS_HEADERS, "Content-Type": "application/json", "X-Cache": "HIT" },
                body: cachedResult
            });
        }

        // ── 3. Find the base property record (Properties collection) ─────────
        // Checked here first — this is the authoritative source for kwStatus,
        // since PropertyTranslations.status can lag behind on delisted properties.
        let propertyQuery = wixData.query('Properties');
        propertyQuery = kwRef
            ? propertyQuery.eq('kwRef', kwRef)
            : propertyQuery.eq('_id', propertyId);

        const propResult = await propertyQuery.limit(1).find({ suppressAuth: true });

        if (propResult.items.length === 0) {
            return notFound({
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                body: {
                    success: false,
                    errorCode: "PROPERTY_NOT_FOUND",
                    error: kwRef
                        ? `No property found with kwRef '${kwRef}'`
                        : `No property found with propertyId '${propertyId}'`
                }
            });
        }

        const property = propResult.items[0];

        // ── 4. Delisted check — graceful error, do not return the URL ────────
        if (property.kwStatus === 'removed_from_feed') {
            // 410 Gone has no dedicated helper — use response() with an explicit status
            return response({
                status: 410,
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                body: {
                    success: false,
                    errorCode: "PROPERTY_DELISTED",
                    error: "This property has been delisted and is no longer available",
                    kwRef: property.kwRef || null,
                    propertyId: property._id
                }
            });
        }

        // ── 5. Language validation — dynamic against this property's own list ──
        const availableLanguages = Array.isArray(property.availableLanguages)
            ? property.availableLanguages.map(l => l.toLowerCase())
            : ['en'];

        if (!availableLanguages.includes(lang)) {
            return badRequest({
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                body: {
                    success: false,
                    errorCode: "UNSUPPORTED_LANGUAGE",
                    error: `Unsupported language '${lang}'. Available languages for this property: ${availableLanguages.join(', ')}`
                }
            });
        }

        // ── 6. Fetch the language-specific translation record ─────────────────
        const transResult = await wixData.query('PropertyTranslations')
            .eq('propertyId', property._id)
            .eq('language', lang)
            .limit(1)
            .find({ suppressAuth: true });

        if (transResult.items.length === 0) {
            // Check which languages actually have a translation row right now,
            // rather than just saying "not found" — this gives the chatbot
            // something actionable instead of a dead end.
            const existingTransResult = await wixData.query('PropertyTranslations')
                .eq('propertyId', property._id)
                .find({ suppressAuth: true });

            const currentlyAvailable = existingTransResult.items.map(t => t.language);

            return notFound({
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                body: {
                    success: false,
                    errorCode: "TRANSLATION_NOT_FOUND",
                    error: currentlyAvailable.length > 0
                        ? `No '${lang}' translation found yet. Currently available: ${currentlyAvailable.join(', ')}`
                        : `No translations found yet for this property. It may still be processing — try again shortly.`,
                    currentlyAvailableLanguages: currentlyAvailable
                }
            });
        }

        const translation = transResult.items[0];

        // ── 7. Build the response ──────────────────────────────────────────────
        // Wix's multilingual URL scheme uses a language-code prefix for every
        // non-default language (e.g. /de/, /he/) and no prefix for the site's
        // default language (en). The auto-generated link field doesn't include
        // this prefix, so it's added here based on the requested language —
        // this stays correct automatically for any future language (fr, nl),
        // no code change needed, since it just uses the lang param itself.
        const SITE_DEFAULT_LANGUAGE = 'en';
        const SITE_DOMAIN = 'https://www.sharon-homes.com';

        let relativeUrl = translation['link-property-translations-1-propertyId']
            || `/property-details/${property._id}`;

        // Strip any accidental existing language prefix before re-adding the correct one
        // Generic 2-letter code match — not an enumerated list, so adding a new
        // language later never requires touching this line.
        relativeUrl = relativeUrl.replace(/^\/[a-z]{2}(?=\/)/, '');
        if (!relativeUrl.startsWith('/')) relativeUrl = '/' + relativeUrl;

        if (lang !== SITE_DEFAULT_LANGUAGE) {
            relativeUrl = `/${lang}${relativeUrl}`;
        }

        const url = `${SITE_DOMAIN}${relativeUrl}`;

        const responseBody = {
            success: true,
            kwRef: property.kwRef || null,
            lang,
            url,
            propertyId: property._id,
            title: translation.title || property.title || null,
            status: property.status === 'Approved' ? 'active' : 'pending'
        };

        // Cache this successful lookup for subsequent requests in this warm instance
        setCached(cacheKey, responseBody);

        return ok({
            headers: { ...CORS_HEADERS, "Content-Type": "application/json", "X-Cache": "MISS" },
            body: responseBody
        });

    } catch (error) {
        console.error("propertyLink error:", error);
        return serverError({
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            body: {
                success: false,
                errorCode: "INTERNAL_ERROR",
                error: "Internal server error",
                message: error.message
            }
        });
    }
}