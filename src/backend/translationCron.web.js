import wixData from 'wix-data';
import { fetch } from 'wix-fetch';
import { Permissions, webMethod } from 'wix-web-module';

// ============================================
// GOOGLE CLOUD TRANSLATE API CONFIGURATION
// ============================================
const GOOGLE_TRANSLATE_API_KEY = 'AIzaSyCuFzK4mPaP0JFlCJyw-uFK7h-w55MS1hw'; // Replace with your actual API key
const GOOGLE_TRANSLATE_API_URL = 'https://translation.googleapis.com/language/translate/v2';

// Only these fields will be translated
const TRANSLATABLE_FIELDS = ['title', 'description', 'shortDescription'];
const ALL_LANGUAGES = ['en', 'he', 'de'];

async function processProperty(property) {
    const propertyId = property._id;

    log('PROCESS_START', `Processing property ${propertyId}`);

    try {
        // 1) Translate to all target languages, collect detectedLanguage from first hit
        let detectedSourceLanguage = null;
        const translationResults = [];

        for (const targetLang of ALL_LANGUAGES) {
            const result = await translateFieldsToLanguage(property, targetLang);

            // Store detected language from first successful detection (normalize iw → he)
            if (!detectedSourceLanguage && result.detectedLanguage) {
                detectedSourceLanguage = result.detectedLanguage === 'iw' ? 'he' : result.detectedLanguage;
                log('DETECTED_LANG', `Detected source language: ${detectedSourceLanguage}`, { propertyId });
            }

            // FIX: push isSource as false for now — corrected after loop once
            //      detectedSourceLanguage is fully resolved (was evaluated mid-loop before,
            //      causing wrong isSource on all non-English source properties)
            translationResults.push({
                language: targetLang,
                translations: result.translatedData,
                isSource: false
            });
        }

        // 2) Validate / fallback BEFORE fixing isSource so the fallback feeds into it
        if (!ALL_LANGUAGES.includes(detectedSourceLanguage)) {
            log('UNSUPPORTED_LANG', `Unsupported language '${detectedSourceLanguage}' detected, defaulting to English`, { propertyId });
            detectedSourceLanguage = 'en';
        }

        // FIX: now that detectedSourceLanguage is finalised, stamp isSource correctly
        translationResults.forEach(r => {
            r.isSource = r.language === detectedSourceLanguage;
        });

        // 3) Update property sourceLanguage if changed
        if (detectedSourceLanguage && detectedSourceLanguage !== property.sourceLanguage) {
            log('LANG_UPDATE', `Updating sourceLanguage from ${property.sourceLanguage} to ${detectedSourceLanguage}`);
            property.sourceLanguage = detectedSourceLanguage;
        }

        // 4) Build all translation documents
        const translationDocs = translationResults.map(({ language, translations, isSource }) => {
            return buildTranslationDoc(
                propertyId,
                language,
                property,
                isSource,
                translations
            );
        });

        // 5) Delete old translations first (avoid duplicates on re-translation)
        const oldTranslations = await wixData.query('PropertyTranslations')
            .eq('propertyId', propertyId)
            .find();

        if (oldTranslations.items.length > 0) {
            const idsToDelete = oldTranslations.items.map(item => item._id);
            await wixData.bulkRemove('PropertyTranslations', idsToDelete, { suppressAuth: true });
            log('OLD_TRANSLATIONS_REMOVED', `Removed ${oldTranslations.items.length} old translations for ${propertyId}`);
        }

        // 6) Save new translations — FIX: check return value; bulkInsert resolves even on
        //    partial failure, returning { inserted, skipped, errors } without throwing.
        //    The old code ignored this, so properties were stamped "done" with 0 rows saved.
        const insertResult = await wixData.bulkInsert('PropertyTranslations', translationDocs, { suppressAuth: true });

        const insertedCount = insertResult.inserted || 0;
        const insertErrors = insertResult.errors || [];

        if (insertErrors.length > 0 || insertedCount !== translationDocs.length) {
            const errDetails = insertErrors.map(e => e.message || JSON.stringify(e)).join(' | ');
            throw new Error(
                `bulkInsert partial failure: inserted ${insertedCount}/${translationDocs.length}. Errors: ${errDetails || 'none reported'}`
            );
        }

        log('PROCESS_SUCCESS', `Translations saved for property ${propertyId} (${insertedCount} docs)`);

        // 7) Mark property as translated — only reached when step 6 fully succeeded
        property.translationsCompleted = true;
        property.translationError = null;
        property.updatedAt = new Date();

        await wixData.update('Properties', property, { suppressAuth: true });

        log('MARKED_COMPLETE', `Property ${propertyId} marked as translated`);

        return { success: true, propertyId };

    } catch (error) {
        log('PROCESS_ERROR', `Failed to process property ${propertyId}`, error.message);
        // translationsCompleted stays false — cron will retry on next run
        return { success: false, propertyId, error: error.message };
    }
}

// ============================================

async function processBuyRequest(request) {
    const buyRequestId = request._id;

    log('BUYREQUEST_START', `Processing buy request ${buyRequestId}`);

    try {
        // No comments at all — mark done without creating translation rows
        if (!request.comments || request.comments.trim() === '') {
            log('BUYREQUEST_SKIP', `No comments for ${buyRequestId} - marking as completed`);

            request.translationsCompleted = true;
            request.sourceLanguage = 'none';
            request.translationError = null;
            await wixData.update('BuyRequests', request, { suppressAuth: true });

            return { success: true, buyRequestId };
        }

        // Comments are purely numeric / punctuation — same text for all languages
        const hasTextContent = /[a-zA-Z\u0590-\u05FF\u0600-\u06FF\u0400-\u04FF]/.test(request.comments);

        if (!hasTextContent) {
            log('BUYREQUEST_NEUTRAL', `Buy request ${buyRequestId} - no translation needed`);

            const translationDocs = ALL_LANGUAGES.map(language =>
                buildBuyRequestTranslationDoc(buyRequestId, language, request, true, request.comments)
            );

            // FIX: check bulkInsert result (same issue as processProperty)
            const insertResult = await wixData.bulkInsert('BuyRequestTranslations', translationDocs, { suppressAuth: true });

            const insertedCount = insertResult.inserted || 0;
            const insertErrors = insertResult.errors || [];

            if (insertErrors.length > 0 || insertedCount !== translationDocs.length) {
                const errDetails = insertErrors.map(e => e.message || JSON.stringify(e)).join(' | ');
                throw new Error(
                    `bulkInsert (neutral) partial failure: inserted ${insertedCount}/${translationDocs.length}. Errors: ${errDetails || 'none reported'}`
                );
            }

            request.translationsCompleted = true;
            request.sourceLanguage = 'neutral';
            request.translationError = null;
            await wixData.update('BuyRequests', request, { suppressAuth: true });

            log('BUYREQUEST_SUCCESS', `Buy request ${buyRequestId} - neutral translations saved`);
            return { success: true, buyRequestId };
        }

        // Translate comments to all languages
        let detectedSourceLanguage = null;
        const translationResults = [];

        for (const targetLang of ALL_LANGUAGES) {
            const result = await translateWithGoogle(request.comments, targetLang);

            if (!detectedSourceLanguage && result.detectedLanguage) {
                detectedSourceLanguage = result.detectedLanguage === 'iw' ? 'he' : result.detectedLanguage;
                log('BUYREQUEST_DETECT', `Detected source: ${detectedSourceLanguage} for request ${buyRequestId}`);
            }

            // FIX: isSource false for now — corrected after loop
            translationResults.push({
                language: targetLang,
                translatedComments: result.translatedText,
                isSource: false
            });
        }

        // Validate / fallback BEFORE fixing isSource
        if (!ALL_LANGUAGES.includes(detectedSourceLanguage)) {
            log('BUYREQUEST_UNSUPPORTED', `Unsupported language '${detectedSourceLanguage}' detected, defaulting to English`, { buyRequestId });
            detectedSourceLanguage = 'en';
        }

        // FIX: stamp isSource correctly now that detection is finalised
        translationResults.forEach(r => {
            r.isSource = r.language === detectedSourceLanguage;
        });

        // Update request with detected language if changed
        if (detectedSourceLanguage && detectedSourceLanguage !== request.sourceLanguage) {
            log('BUYREQUEST_LANG_UPDATE', `Updating sourceLanguage from ${request.sourceLanguage} to ${detectedSourceLanguage}`);
            request.sourceLanguage = detectedSourceLanguage;
        }

        // Build translation documents
        const translationDocs = translationResults.map(({ language, translatedComments, isSource }) =>
            buildBuyRequestTranslationDoc(buyRequestId, language, request, isSource, translatedComments)
        );

        // Delete old translations (avoid duplicates)
        const oldTranslations = await wixData.query('BuyRequestTranslations')
            .eq('buyRequestId', buyRequestId)
            .find();

        if (oldTranslations.items.length > 0) {
            const idsToDelete = oldTranslations.items.map(item => item._id);
            await wixData.bulkRemove('BuyRequestTranslations', idsToDelete, { suppressAuth: true });
            log('BUYREQUEST_OLD_REMOVED', `Removed ${oldTranslations.items.length} old translations for ${buyRequestId}`);
        }

        // FIX: check bulkInsert result before marking complete
        const insertResult = await wixData.bulkInsert('BuyRequestTranslations', translationDocs, { suppressAuth: true });

        const insertedCount = insertResult.inserted || 0;
        const insertErrors = insertResult.errors || [];

        if (insertErrors.length > 0 || insertedCount !== translationDocs.length) {
            const errDetails = insertErrors.map(e => e.message || JSON.stringify(e)).join(' | ');
            throw new Error(
                `bulkInsert partial failure: inserted ${insertedCount}/${translationDocs.length}. Errors: ${errDetails || 'none reported'}`
            );
        }

        log('BUYREQUEST_SUCCESS', `Translations saved for buy request ${buyRequestId} (${insertedCount} docs)`);

        // Mark as completed — only reached when all inserts succeeded
        request.translationsCompleted = true;
        request.translationError = null;
        request.updatedAt = new Date();
        await wixData.update('BuyRequests', request, { suppressAuth: true });

        log('BUYREQUEST_MARKED_COMPLETE', `Buy request ${buyRequestId} marked as translated`);

        return { success: true, buyRequestId };

    } catch (error) {
        log('BUYREQUEST_ERROR', `Failed to process buy request ${buyRequestId}`, error.message);
        return { success: false, buyRequestId, error: error.message };
    }
}

// ============================================
// ONE-TIME RECOVERY UTILITY
// Call once from the Wix dev console to unblock all currently stuck properties.
// Safe to call multiple times — only resets items that genuinely have no translations.
// ============================================

export const resetStuckProperties = webMethod(
    Permissions.Anyone,
    async () => {
        try {
            log('RESET', 'Starting resetStuckProperties scan');

            // 1) Collect all propertyIds that have at least one translation row
            //    Query in pages to handle large collections safely
            let allTranslatedIds = new Set();
            let transOffset = 0;
            const PAGE = 1000;

            while (true) {
                const page = await wixData.query('PropertyTranslations')
                    .limit(PAGE)
                    .skip(transOffset)
                    .find({ suppressAuth: true });

                page.items.forEach(t => { if (t.propertyId) allTranslatedIds.add(t.propertyId); });

                if (page.items.length < PAGE) break;
                transOffset += PAGE;
            }

            log('RESET', `Found ${allTranslatedIds.size} unique propertyIds with translations`);

            // 2) Fetch all properties currently marked as translationsCompleted: true
            let stuckProperties = [];
            let propOffset = 0;

            while (true) {
                const page = await wixData.query('Properties')
                    .eq('translationsCompleted', true)
                    .limit(1000)
                    .skip(propOffset)
                    .find({ suppressAuth: true });

                const stuck = page.items.filter(p => !allTranslatedIds.has(p._id));
                stuckProperties = stuckProperties.concat(stuck);

                if (page.items.length < 1000) break;
                propOffset += 1000;
            }

            if (stuckProperties.length === 0) {
                log('RESET', 'No stuck properties found — nothing to reset');
                return { success: true, message: 'No stuck properties found.', resetCount: 0 };
            }

            log('RESET', `Found ${stuckProperties.length} stuck properties — resetting`);

            // 3) Reset each one back to translationsCompleted: false so the cron picks them up
            const results = [];

            for (const prop of stuckProperties) {
                try {
                    await wixData.update('Properties', {
                        ...prop,
                        translationsCompleted: false,
                        translationError: 'Reset by resetStuckProperties — no translation rows found',
                        updatedAt: new Date()
                    }, { suppressAuth: true });

                    results.push({ id: prop._id, title: prop.title || '(no title)', ok: true });
                    log('RESET_ITEM', `Reset ${prop._id} (${prop.title || 'no title'})`);
                } catch (e) {
                    results.push({ id: prop._id, title: prop.title || '(no title)', ok: false, error: e.message });
                    log('RESET_ITEM_ERROR', `Failed to reset ${prop._id}`, e.message);
                }
            }

            const succeeded = results.filter(r => r.ok).length;
            const failed = results.filter(r => !r.ok);

            log('RESET_DONE', `Reset ${succeeded}/${stuckProperties.length} properties. Cron will process them on next run.`);

            return {
                success: true,
                resetCount: succeeded,
                failedCount: failed.length,
                failed,
                resetIds: results.filter(r => r.ok).map(r => r.id)
            };

        } catch (err) {
            log('RESET_ERROR', 'resetStuckProperties failed', err.message);
            return { success: false, error: err.message };
        }
    }
);

// ============================================
// LOGGING HELPER
// ============================================
function log(category, message, data = null) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    if (data) {
        console.log(`[${timestamp}] [CRON-${category}] ${message}:`, data);
    } else {
        console.log(`[${timestamp}] [CRON-${category}] ${message}`);
    }
}

// ============================================
// TRANSLATION FUNCTIONS
// ============================================

/**
 * Translate text using Google Cloud Translate API with AUTO-DETECTION
 */
async function translateWithGoogle(text, targetLang) {
    if (!text || text.trim() === '') {
        return { translatedText: text, detectedLanguage: null };
    }

    try {
        const url = `${GOOGLE_TRANSLATE_API_URL}?key=${GOOGLE_TRANSLATE_API_KEY}`;

        const requestBody = {
            q: text,
            target: targetLang,
            format: 'text'
            // NO source parameter = auto-detect
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            log('TRANSLATE_ERROR', `API error ${response.status}`, errorText);
            throw new Error(`Translation API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.data && data.data.translations && data.data.translations.length > 0) {
            const translation = data.data.translations[0];
            return {
                translatedText: translation.translatedText,
                detectedLanguage: translation.detectedSourceLanguage || null
            };
        }

        return { translatedText: text, detectedLanguage: null };

    } catch (error) {
        log('TRANSLATE_ERROR', `Failed for ${targetLang}`, error.message);
        throw error;
    }
}

/**
 * Translate all fields for a property to a target language
 */
async function translateFieldsToLanguage(propertyData, targetLang) {
    const translatedData = {};
    let detectedLanguage = null;

    for (const field of TRANSLATABLE_FIELDS) {
        const value = propertyData[field];

        if (value === undefined || value === null || value === '') {
            continue;
        }

        const textToTranslate = String(value);
        const result = await translateWithGoogle(textToTranslate, targetLang);

        translatedData[field] = result.translatedText;

        // Store the detected language from the first field
        if (!detectedLanguage && result.detectedLanguage) {
            detectedLanguage = result.detectedLanguage;
        }
    }

    return { translatedData, detectedLanguage };
}

// ============================================
// DOCUMENT BUILDING
// ============================================

/**
 * Build translation document
 */
function buildTranslationDoc(propertyId, language, propertyData, isSource, translatedOverrides = {}) {
    const base = {
        propertyId,
        language,
        isSource,
        autoTranslated: !isSource,
        originalLanguage: propertyData.sourceLanguage,
        availableLanguages: propertyData.availableLanguages,
        lastTranslated: new Date(),

        // Non-translatable fields
        minBedrooms: propertyData.minBedrooms,
        maxBedrooms: propertyData.maxBedrooms,
        neighbourhood: propertyData.neighbourhood,
        minPrice: propertyData.minPrice,
        maxPrice: propertyData.maxPrice,
        gallery: propertyData.gallery,
        status: propertyData.status,
        availableDate: propertyData.availableDate,
        agreement: propertyData.agreement,
        zipCode: propertyData.zipCode,
        requestId: propertyData.requestId,
        plotArea: propertyData.plotArea,
        commission: propertyData.commission,
        email_sent_to_buyer: propertyData.email_sent_to_buyer,
        email: propertyData.email,
        country: propertyData.country,
        stateCity: propertyData.stateCity,
        address: propertyData.address,
        state: propertyData.state,
        propertyType: propertyData.propertyType,
        dealType: propertyData.dealType,
        investmentOpportunity: propertyData.investmentOpportunity,
        developer1: propertyData.developer1,
        delivery: propertyData.delivery,
        projectName: propertyData.projectName,

        // New fields — not translatable, copied as-is
        propertyStatus: propertyData.propertyStatus || null,
        closeToSea: !!propertyData.closeToSea,
        seaView: !!propertyData.seaView,
        // KW7 fields
        kwRef: propertyData.kwRef || null,
        kwSource: propertyData.kwSource || null,
        bathrooms: propertyData.bathrooms || 0,
        wc: propertyData.wc || 0,
        yearBuilt: propertyData.yearBuilt || 0,
        floor: propertyData.floor || '',
        parkings: propertyData.parkings || 0,
        sizeSqm: propertyData.sizeSqm || 0,
        latitude: propertyData.latitude || 0,
        longitude: propertyData.longitude || 0,
         // Missing fields — added
        location    : propertyData.location     || '',
        bedroomRange: propertyData.bedroomRange || '',
        priceRange  : propertyData.priceRange   || '',
    };

    // Translatable fields
    const translatableFields = {
        title: propertyData.title,
        description: propertyData.description,
        shortDescription: propertyData.shortDescription
    };

    // Apply translations for non-source documents
    if (!isSource && Object.keys(translatedOverrides).length > 0) {
        for (const field of TRANSLATABLE_FIELDS) {
            if (field in translatedOverrides) {
                translatableFields[field] = translatedOverrides[field];
            }
        }
    }

    return { ...base, ...translatableFields };
}

// ============================================
// PROCESSING FUNCTIONS
// ============================================

// async function processProperty(property) {
//     const propertyId = property._id;

//     log('PROCESS_START', `Processing property ${propertyId}`);

//     try {
//         // 1) Detect language and translate to all target languages
//         let detectedSourceLanguage = null;
//         const translationResults = [];

//         for (const targetLang of ALL_LANGUAGES) {
//             const result = await translateFieldsToLanguage(property, targetLang);

//             // Store detected language from first translation (normalize iw → he)
//             if (!detectedSourceLanguage && result.detectedLanguage) {
//                 detectedSourceLanguage = result.detectedLanguage === 'iw' ? 'he' : result.detectedLanguage;
//                 log('DETECTED_LANG', `Detected source language: ${detectedSourceLanguage}`, { propertyId });
//             }

//             translationResults.push({
//                 language: targetLang,
//                 translations: result.translatedData,
//                 isSource: targetLang === detectedSourceLanguage
//             });
//         }

//         // 2) Validate language is supported
//         // if (!ALL_LANGUAGES.includes(detectedSourceLanguage)) {
//         //     const errorMsg = `Unsupported language detected: ${detectedSourceLanguage}. Only English, Hebrew, and German are supported.`;
//         //     log('UNSUPPORTED_LANG', errorMsg, { propertyId });

//         //     property.translationError = errorMsg;
//         //     property.translationsCompleted = false;
//         //     await wixData.update('Properties', property, { suppressAuth: true });

//         //     throw new Error(errorMsg);
//         // }
//         if (!ALL_LANGUAGES.includes(detectedSourceLanguage)) {
//             log('UNSUPPORTED_LANG', `Unsupported language '${detectedSourceLanguage}' detected, defaulting to English`, { propertyId });
//             detectedSourceLanguage = 'en'; // FALLBACK TO ENGLISH
//         }

//         // 3) Update property with detected language if different from stored
//         if (detectedSourceLanguage && detectedSourceLanguage !== property.sourceLanguage) {
//             log('LANG_UPDATE', `Updating sourceLanguage from ${property.sourceLanguage} to ${detectedSourceLanguage}`);
//             property.sourceLanguage = detectedSourceLanguage;
//         }

//         // 4) Build all translation documents
//         const translationDocs = translationResults.map(({ language, translations, isSource }) => {
//             return buildTranslationDoc(
//                 propertyId,
//                 language,
//                 property,
//                 isSource,
//                 translations
//             );
//         });

//         // 5) Delete old translations first (to avoid duplicates on re-translation)
//         const oldTranslations = await wixData.query('PropertyTranslations')
//             .eq('propertyId', propertyId)
//             .find();

//         if (oldTranslations.items.length > 0) {
//             const idsToDelete = oldTranslations.items.map(item => item._id);
//             await wixData.bulkRemove('PropertyTranslations', idsToDelete, { suppressAuth: true });
//             log('OLD_TRANSLATIONS_REMOVED', `Removed ${oldTranslations.items.length} old translations for ${propertyId}`);
//         }

//         // 6) Save new translations
//         await wixData.bulkInsert('PropertyTranslations', translationDocs, { suppressAuth: true });

//         log('PROCESS_SUCCESS', `Translations saved for property ${propertyId}`);

//         // 7) Mark property as translated (using existing property object)
//         property.translationsCompleted = true;
//         property.translationError = null; // Clear any previous errors
//         property.updatedAt = new Date();

//         await wixData.update('Properties', property, { suppressAuth: true });

//         log('MARKED_COMPLETE', `Property ${propertyId} marked as translated`);

//         return { success: true, propertyId };

//     } catch (error) {
//         log('PROCESS_ERROR', `Failed to process property ${propertyId}`, error.message);

//         // Property stays with translationsCompleted: false
//         // Will be retried on next cron run

//         return { success: false, propertyId, error: error.message };
//     }
// }

export const processTranslationQueue = webMethod(
    Permissions.Anyone,
    async () => {
        const startTime = new Date();
        const cronSchedule = detectCronSchedule();

        log('CRON_START', `=== TRANSLATION CRON JOB STARTED === Schedule: ${cronSchedule} at ${startTime.toISOString()}`);

        let totalProcessed = 0;
        let totalSuccess = 0;
        let totalFailed = 0;

        try {
            // ===== PROCESS PROPERTIES =====
            const pendingProperties = await wixData.query('Properties')
                .ne('translationsCompleted', true) // Changed from .eq(false) to handle Wix boolean issue
                .limit(50)
                .find();

            const propertyCount = pendingProperties.items.length;

            if (propertyCount > 0) {
                logC('PROPERTIES_FOUND', `Found ${propertyCount} properties to process`);

                const propertyResults = [];
                for (const property of pendingProperties.items) {
                    const result = await processProperty(property);
                    propertyResults.push(result);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                const propSuccess = propertyResults.filter(r => r.success).length;
                const propFail = propertyResults.filter(r => !r.success).length;

                totalProcessed += propertyCount;
                totalSuccess += propSuccess;
                totalFailed += propFail;

                logC('PROPERTIES_COMPLETE', `Processed ${propertyCount} properties: ${propSuccess} success, ${propFail} failed`);
            } else {
                logC('PROPERTIES_IDLE', 'No pending property translations');
            }

            // ===== PROCESS BUY REQUESTS =====
            const pendingRequests = await wixData.query('BuyRequests')
                .ne('translationsCompleted', true) // Changed from .eq(false) to handle Wix boolean issue
                .limit(50)
                .find();

            const requestCount = pendingRequests.items.length;

            if (requestCount > 0) {
                logC('BUYREQUESTS_FOUND', `Found ${requestCount} buy requests to process`);

                const requestResults = [];
                for (const request of pendingRequests.items) {
                    const result = await processBuyRequest(request);
                    requestResults.push(result);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                const reqSuccess = requestResults.filter(r => r.success).length;
                const reqFail = requestResults.filter(r => !r.success).length;

                totalProcessed += requestCount;
                totalSuccess += reqSuccess;
                totalFailed += reqFail;

                logC('BUYREQUESTS_COMPLETE', `Processed ${requestCount} buy requests: ${reqSuccess} success, ${reqFail} failed`);
            } else {
                logC('BUYREQUESTS_IDLE', 'No pending buy request translations');
            }

            // ===== LOG RESULTS =====
            const endTime = new Date();
            const executionDuration = (endTime.getTime() - startTime.getTime()) / 1000;

            await logCronExecution({
                cronSchedule,
                startTime,
                status: totalProcessed === 0 ? 'idle' : 'success',
                itemsProcessed: totalProcessed,
                successCount: totalSuccess,
                failCount: totalFailed,
                errorMessage: '',
                executionDuration
            });

            logC('CRON_COMPLETE', `Total: ${totalProcessed} items (${totalSuccess} success, ${totalFailed} failed)`);

            return {
                success: true,
                totalProcessed,
                totalSuccess,
                totalFailed,
                properties: { processed: propertyCount },
                buyRequests: { processed: requestCount },
                duration: executionDuration,
                schedule: cronSchedule
            };

        } catch (error) {
            logC('CRON_ERROR', 'Cron job failed', error.message);
            console.error('Full error:', error);

            const endTime = new Date();
            const executionDuration = (endTime.getTime() - startTime.getTime()) / 1000;

            try {
                await logCronExecution({
                    cronSchedule,
                    startTime,
                    status: 'error',
                    itemsProcessed: totalProcessed,
                    successCount: totalSuccess,
                    failCount: totalFailed,
                    errorMessage: error.message,
                    executionDuration
                });
            } catch (logError) {
                console.error('Failed to log error to database:', logError);
            }

            return {
                success: false,
                error: error.message,
                schedule: cronSchedule
            };
        }
    }
);
export const verifyTranslationCoverage = webMethod(
    Permissions.Anyone,
    async () => {
        try {
            // 1) Pull all translation rows (page through if needed)
            let allItems = [];
            let offset = 0;
            const PAGE = 1000;

            while (true) {
                const page = await wixData.query('PropertyTranslations')
                    .limit(PAGE)
                    .skip(offset)
                    .find({ suppressAuth: true });

                allItems = allItems.concat(page.items);
                if (page.items.length < PAGE) break;
                offset += PAGE;
            }

            // 2) Group by propertyId
            const map = {};
            for (const item of allItems) {
                const id = item.propertyId;
                if (!id) continue;
                if (!map[id]) map[id] = [];
                map[id].push(item.language);
            }

            const EXPECTED = ['en', 'de', 'he'];

            const perfect = []; // exactly 3 correct languages
            const missing = []; // has rows but missing one or more languages
            const extra = []; // has more than 3 rows
            const wrongLang = []; // has 3 rows but wrong language codes

            for (const [propId, langs] of Object.entries(map)) {
                const sorted = [...langs].sort();
                const hasAll = EXPECTED.every(l => langs.includes(l));
                const count = langs.length;

                if (count === 3 && hasAll) {
                    perfect.push(propId);
                } else if (count > 3) {
                    extra.push({ propertyId: propId, languages: sorted, count });
                } else if (!hasAll) {
                    const missingLangs = EXPECTED.filter(l => !langs.includes(l));
                    missing.push({ propertyId: propId, languages: sorted, missing: missingLangs });
                } else {
                    wrongLang.push({ propertyId: propId, languages: sorted });
                }
            }

            // 3) Also find properties in Properties that have zero translation rows
            const allProps = await wixData.query('Properties')
                .limit(1000)
                .find({ suppressAuth: true });

            const translatedIds = new Set(Object.keys(map));
            const noTranslations = allProps.items
                .filter(p => !translatedIds.has(p._id))
                .map(p => ({ propertyId: p._id, title: p.title || '(no title)' }));

            return {
                success: true,
                summary: {
                    totalProperties: allProps.items.length,
                    perfect: perfect.length,
                    missingLanguage: missing.length,
                    extraRows: extra.length,
                    zeroTranslations: noTranslations.length,
                },
                issues: {
                    missingLanguage: missing,
                    extraRows: extra,
                    zeroTranslations: noTranslations,
                }
            };

        } catch (err) {
            return { success: false, error: err.message };
        }
    }
);
// Helper function to log cron execution to database
async function logCronExecution(logData) {
    try {
        // await wixData.insert("CronLogs", {
        //     cronSchedule: logData.cronSchedule,
        //     executionTime: logData.startTime,
        //     status: logData.status,
        //     itemsProcessed: logData.itemsProcessed || 0,
        //     successCount: logData.successCount || 0,
        //     failCount: logData.failCount || 0,
        //     errorMessage: logData.errorMessage || '',
        //     executionDuration: logData.executionDuration,
        //     failedPropertyIds: logData.failedPropertyIds || []
        // }, { suppressAuth: true });

        console.log(`✅ Logged cron execution to database - Schedule: ${logData.cronSchedule}, Duration: ${logData.executionDuration}s`);
    } catch (error) {
        console.error('❌ Failed to log to CronLogs collection:', error);
        // Don't throw - we don't want logging failures to break the cron job
    }
}

// Helper function to detect which cron schedule triggered
function detectCronSchedule() {
    const now = new Date();
    const minutes = now.getMinutes();
    const hours = now.getHours();

    // Check from most specific to least specific
    if (minutes === 0) {
        return `Every 1 hour (${hours}:00)`;
    } else if (minutes === 30) {
        return `Every 30 minutes (${hours}:30)`;
    } else if (minutes % 15 === 0) {
        return `Every 15 minutes (${hours}:${minutes})`;
    } else if (minutes % 10 === 0) {
        return `Every 10 minutes (${hours}:${minutes})`;
    } else if (minutes % 5 === 0) {
        return `Every 5 minutes (${hours}:${minutes})`;
    } else {
        return `Unknown schedule (${hours}:${minutes})`;
    }
}

// Keep your existing log function
function logC(type, message, details = '') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type}] ${message}`, details);
}

/**
 * Process a single specific property by ID
 * Useful for manual retries
 */
export const translateSingleProperty = webMethod(
    Permissions.Anyone,
    async (propertyId) => {
        try {
            if (!propertyId) {
                throw new Error('Property ID is required');
            }

            log('MANUAL_START', `Manual translation requested for ${propertyId}`);

            // Fetch the property
            const property = await wixData.get('Properties', propertyId, { suppressAuth: true });

            if (!property) {
                throw new Error(`Property ${propertyId} not found`);
            }

            // Process it
            const result = await processProperty(property);

            if (result.success) {
                return {
                    success: true,
                    propertyId,
                    message: `Property ${propertyId} translated successfully`
                };
            } else {
                return {
                    success: false,
                    propertyId,
                    error: result.error
                };
            }

        } catch (error) {
            log('MANUAL_ERROR', 'Manual translation failed', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
);

/**
 * Get translation queue status - how many properties are pending
 */
export const getTranslationQueueStatus = webMethod(
    Permissions.Anyone,
    async () => {
        try {
            const pending = await wixData.query('Properties')
                .ne('translationsCompleted', true)
                .count();

            const completed = await wixData.query('Properties')
                .eq('translationsCompleted', true)
                .count();

            return {
                success: true,
                pendingCount: pending,
                completedCount: completed,
                message: `${pending} properties pending translation, ${completed} completed`
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
);

export const findMissingTranslations = webMethod(
    Permissions.Anyone,
    async () => {
        try {
            // 1) Get all property IDs from Properties collection
            const allProperties = await wixData.query('Properties')
                .limit(1000)
                .find({ suppressAuth: true });

            const propertyIds = allProperties.items.map(p => p._id);
            console.log(`Total properties: ${propertyIds.length}`);

            // 2) Get all unique propertyIds from PropertyTranslations
            const allTranslations = await wixData.query('PropertyTranslations')
                .limit(1000)
                .find({ suppressAuth: true });

            const translatedPropertyIds = new Set(
                allTranslations.items.map(t => t.propertyId)
            );
            console.log(`Properties with translations: ${translatedPropertyIds.size}`);

            // 3) Find missing ones
            const missingIds = propertyIds.filter(id => !translatedPropertyIds.has(id));

            console.log(`Missing translations: ${missingIds.length}`);
            console.log('Missing property IDs:', missingIds);

            // 4) Get details of missing properties
            if (missingIds.length > 0) {
                const missingProperties = await wixData.query('Properties')
                    .hasSome('_id', missingIds)
                    .find({ suppressAuth: true });

                const details = missingProperties.items.map(p => ({
                    id: p._id,
                    title: p.title,
                    translationsCompleted: p.translationsCompleted,
                    translationError: p.translationError
                }));

                return {
                    success: true,
                    totalProperties: propertyIds.length,
                    translatedCount: translatedPropertyIds.size,
                    missingCount: missingIds.length,
                    missingIds: missingIds,
                    missingDetails: details
                };
            }

            return {
                success: true,
                totalProperties: propertyIds.length,
                translatedCount: translatedPropertyIds.size,
                missingCount: 0,
                message: 'All properties have translations!'
            };

        } catch (error) {
            console.error('Error finding missing translations:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
);

// ============================================
// BUY REQUEST PROCESSING FUNCTIONS
// ============================================

/**
 * Build buy request translation document
 */
function buildBuyRequestTranslationDoc(buyRequestId, language, requestData, isSource, translatedComments) {
    return {
        // Translation-specific fields
        buyRequestId: buyRequestId,
        language: language,
        autoTranslated: !isSource,
        lastTranslated: new Date(),

        // Translated field
        comments: translatedComments,

        // Copy all non-translatable fields from parent
        title: requestData.title || '', // This field exists in translations but not in parent
        name: requestData.name,
        email: requestData.email,
        phone: requestData.phone,
        zip_code: requestData.zip_code,
        agreement_to_contact: requestData.agreement_to_contact,
        property_type: requestData.property_type,
        min_rooms: requestData.min_rooms,
        max_rooms: requestData.max_rooms,
        min_price: requestData.min_price,
        max_price: requestData.max_price,
        min_area: requestData.min_area,
        cities: requestData.cities,
        country: requestData.country,
        neighbourhood: requestData.neighbourhood,
        status: requestData.status
    };
}

export const initKw7Schema = webMethod(
    Permissions.Anyone,
    async () => {
        try {
            log('SCHEMA', 'Inserting dummy record into Properties to create KW7 fields...');

            // ── Step 1: Insert dummy into Properties ─────────────────────────
            // Value types matter — Wix infers the field type from the inserted value.
            // Strings → Text, numbers → Number, Date → Date & Time, boolean → Boolean.
            const dummyProperty = await wixData.insert('Properties', {
                // Existing required fields (minimal to satisfy any CMS validation)
                title: 'SCHEMA-INIT-DELETE-ME',
                status: 'Pending',
                translationsCompleted: false,

                // ── NEW KW7 fields ────────────────────────────────────────────
                // Insert with correct types so Wix creates the right field type.
                kwRef: 'SCHEMA-INIT-DELETE-ME', // Text
                kwSource: 'kw7', // Text
                kwDateUpdated: '2024-01-01', // Text (stored as "YYYY-MM-DD")
                kwLastSynced: new Date(), // Date & Time
                bathrooms: 0, // Number
                wc: 0, // Number
                yearBuilt: 0, // Number
                floor: '0', // Text
                parkings: 0, // Number
                sizeSqm: 0.0, // Number
                latitude: 0.0, // Number
                longitude: 0.0, // Number
            }, { suppressAuth: true });

            const propId = dummyProperty._id;
            log('SCHEMA', `Properties dummy created: ${propId}`);

            // ── Step 2: Insert dummy into PropertyTranslations ───────────────
            // Uses the Properties dummy _id as propertyId so the reference is valid.
            // This creates the same new fields in PropertyTranslations.
            const dummyTranslation = await wixData.insert('PropertyTranslations', {
                // Existing required fields
                propertyId: propId,
                language: 'en',
                title: 'SCHEMA-INIT-DELETE-ME',
                status: 'Pending',
                isSource: true,
                autoTranslated: false,

                // ── NEW KW7 fields (same set, minus sync metadata) ────────────
                kwRef: 'SCHEMA-INIT-DELETE-ME', // Text
                kwSource: 'kw7', // Text
                bathrooms: 0, // Number
                wc: 0, // Number
                yearBuilt: 0, // Number
                floor: '0', // Text
                parkings: 0, // Number
                sizeSqm: 0.0, // Number
                latitude: 0.0, // Number
                longitude: 0.0, // Number
            }, { suppressAuth: true });

            const transId = dummyTranslation._id;
            log('SCHEMA', `PropertyTranslations dummy created: ${transId}`);

            return {
                success: true,
                message: 'Schema fields created in both collections. Find and delete the "SCHEMA-INIT-DELETE-ME" record in Properties CMS — the PropertyTranslations one will be orphaned and can be deleted too.',
                propertiesDummyId: propId,
                propertyTranslationsDummyId: transId,
                fieldsCreatedInProperties: ['kwRef', 'kwSource', 'kwDateUpdated', 'kwLastSynced', 'bathrooms', 'wc', 'yearBuilt', 'floor', 'parkings', 'sizeSqm', 'latitude', 'longitude'],
                fieldsCreatedInTranslations: ['kwRef', 'kwSource', 'bathrooms', 'wc', 'yearBuilt', 'floor', 'parkings', 'sizeSqm', 'latitude', 'longitude'],
            };

        } catch (err) {
            log('SCHEMA_ERROR', 'Schema init failed', err.message);
            return { success: false, error: err.message };
        }
    }
);