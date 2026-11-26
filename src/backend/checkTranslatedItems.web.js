 
import { Permissions, webMethod } from "wix-web-module";
import wixData from 'wix-data';
const ALL_LANGUAGES = ['en', 'he', 'de'];

export const getUntranslatedBuyRequests = webMethod(
    Permissions.Anyone,
    async () => {
        try {
            console.log('🔍 Checking for untranslated buy requests...');

            // 1) Get all buy requests
            const allRequests = await wixData.query('BuyRequests')
                .limit(200)
                .find();

            if (allRequests.items.length === 0) {
                return {
                    success: true,
                    untranslatedIds: [],
                    partiallyTranslatedIds: [],
                    total: 0,
                    message: 'No buy requests found'
                };
            }

            console.log(`📊 Found ${allRequests.items.length} total buy requests`);

            // 2) Get all translations
            const allTranslations = await wixData.query('BuyRequestTranslations')
                .limit(200)
                .find();

            console.log(`📊 Found ${allTranslations.items.length} total translations`);

            // 3) Group translations by buyRequestId
            const translationsByRequest = {};
            allTranslations.items.forEach(trans => {
                if (!translationsByRequest[trans.buyRequestId]) {
                    translationsByRequest[trans.buyRequestId] = [];
                }
                translationsByRequest[trans.buyRequestId].push(trans.language);
            });

            // 4) Check each request for missing translations
            const expectedLanguageCount = ALL_LANGUAGES.length;
            const untranslatedIds = [];
            const partiallyTranslatedIds = [];

            allRequests.items.forEach(request => {
                const requestId = request._id;
                const translationCount = translationsByRequest[requestId]?.length || 0;

                if (translationCount === 0) {
                    // No translations at all
                    untranslatedIds.push(requestId);
                } else if (translationCount < expectedLanguageCount) {
                    // Has some but not all languages
                    partiallyTranslatedIds.push({
                        id: requestId,
                        hasLanguages: translationsByRequest[requestId],
                        missingCount: expectedLanguageCount - translationCount
                    });
                }
            });

            console.log(`✅ Analysis complete: ${untranslatedIds.length} untranslated, ${partiallyTranslatedIds.length} partial`);

            return {
                success: true,
                untranslatedIds,
                partiallyTranslatedIds,
                totalUntranslated: untranslatedIds.length,
                totalPartial: partiallyTranslatedIds.length,
                totalRequests: allRequests.items.length,
                totalTranslations: allTranslations.items.length,
                expectedLanguagesPerRequest: expectedLanguageCount,
                supportedLanguages: ALL_LANGUAGES,
                message: `Found ${untranslatedIds.length} completely untranslated and ${partiallyTranslatedIds.length} partially translated buy requests`
            };

        } catch (error) {
            console.error('❌ Error checking untranslated buy requests:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
);

export const getUntranslatedProperties = webMethod(
    Permissions.Anyone,
    async () => {
        try {
            console.log('🔍 Checking for untranslated properties...');

            // 1) Get all properties
            const allProperties = await wixData.query('Properties')
                .limit(1000)
                .find();

            if (allProperties.items.length === 0) {
                return {
                    success: true,
                    untranslatedIds: [],
                    partiallyTranslatedIds: [],
                    total: 0,
                    message: 'No properties found'
                };
            }

            console.log(`📊 Found ${allProperties.items.length} total properties`);

            // 2) Get all translations
            const allTranslations = await wixData.query('PropertyTranslations')
                .limit(1000)
                .find();

            console.log(`📊 Found ${allTranslations.items.length} total translations`);

            // 3) Group translations by propertyId
            const translationsByProperty = {};
            allTranslations.items.forEach(trans => {
                if (!translationsByProperty[trans.propertyId]) {
                    translationsByProperty[trans.propertyId] = [];
                }
                translationsByProperty[trans.propertyId].push(trans.language);
            });

            // 4) Check each property for missing translations
            const expectedLanguageCount = ALL_LANGUAGES.length;
            const untranslatedIds = [];
            const partiallyTranslatedIds = [];

            allProperties.items.forEach(property => {
                const propertyId = property._id;
                const translationCount = translationsByProperty[propertyId]?.length || 0;

                if (translationCount === 0) {
                    // No translations at all
                    untranslatedIds.push(propertyId);
                } else if (translationCount < expectedLanguageCount) {
                    // Has some but not all languages
                    partiallyTranslatedIds.push({
                        id: propertyId,
                        hasLanguages: translationsByProperty[propertyId],
                        missingCount: expectedLanguageCount - translationCount
                    });
                }
            });

            console.log(`✅ Analysis complete: ${untranslatedIds.length} untranslated, ${partiallyTranslatedIds.length} partial`);

            return {
                success: true,
                untranslatedIds,
                partiallyTranslatedIds,
                totalUntranslated: untranslatedIds.length,
                totalPartial: partiallyTranslatedIds.length,
                totalProperties: allProperties.items.length,
                totalTranslations: allTranslations.items.length,
                expectedLanguagesPerRequest: expectedLanguageCount,
                supportedLanguages: ALL_LANGUAGES,
                message: `Found ${untranslatedIds.length} completely untranslated and ${partiallyTranslatedIds.length} partially translated properties`
            };

        } catch (error) {
            console.error('❌ Error checking untranslated properties:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
);