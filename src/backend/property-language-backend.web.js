import wixData from 'wix-data';
import { Permissions, webMethod } from 'wix-web-module';

/**
 * Get all properties for a specific language
 * @param {string} language - Language code: 'en', 'de', or 'he'
 * @returns {Promise} Array of properties in the specified language
 */
export const getPropertiesByLanguage = webMethod(
    Permissions.Anyone,
    async (language) => {
        try {
            const results = await wixData.query("PropertyTranslations")
                .eq("language", language)
                .eq("status", "Approved") // Optional: only get approved properties
                .find({ suppressAuth: true });

            console.log(`Found ${results.items.length} properties for language: ${language}`);
            return { 
                success: true, 
                data: results.items,
                totalCount: results.totalCount
            };

        } catch (error) {
            console.error("Error fetching properties by language:", error);
            return { success: false, error: error.message };
        }
    }
);

/**
 * Get a single property by propertyId and language
 * @param {string} propertyId - The property ID
 * @param {string} language - Language code: 'en', 'de', or 'he'
 * @returns {Promise} Single property in the specified language
 */
export const getPropertyByIdAndLanguage = webMethod(
    Permissions.Anyone,
    async (propertyId, language) => {
        try {
            const results = await wixData.query("PropertyTranslations")
                .eq("propertyId", propertyId)
                .eq("language", language)
                .find({ suppressAuth: true });

            let data, fallback = false;

            if (results.items.length > 0) {
                data = results.items[0];
            } else {
                const fallbackResults = await wixData.query("PropertyTranslations")
                    .eq("propertyId", propertyId)
                    .eq("language", "en")
                    .find({ suppressAuth: true });

                if (fallbackResults.items.length > 0) {
                    console.log(`Translation not found for ${language}, using English fallback`);
                    data = fallbackResults.items[0];
                    fallback = true;
                } else {
                    return { success: false, error: "Property not found" };
                }
            }

            // ADD THIS BLOCK — override gallery from parent
            const propResult = await wixData.query('Properties')
                .eq('_id', propertyId)
                .limit(1)
                .find({ suppressAuth: true });

            if (propResult.items.length > 0) {
                data.gallery = propResult.items[0].gallery || [];
            }

            return { success: true, data, fallback };

        } catch (error) {
            console.error("Error fetching property:", error);
            return { success: false, error: error.message };
        }
    }
);

/**
 * Get properties with pagination and language filter
 * @param {string} language - Language code
 * @param {number} page - Page number (starts at 1)
 * @param {number} pageSize - Items per page
 * @returns {Promise} Paginated properties
 */
export const getPropertiesPaginated = webMethod(
    Permissions.Anyone,
    async (language, page = 1, pageSize = 10) => {
        try {
            const results = await wixData.query("PropertyTranslations")
                .eq("language", language)
                .eq("status", "Approved")
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .find({ suppressAuth: true });

            return { 
                success: true, 
                data: results.items,
                totalCount: results.totalCount,
                currentPage: page,
                totalPages: Math.ceil(results.totalCount / pageSize)
            };

        } catch (error) {
            console.error("Error fetching paginated properties:", error);
            return { success: false, error: error.message };
        }
    }
);

/**
 * Get properties by language with additional filters
 * @param {Object} filters - Filter object
 * @returns {Promise} Filtered properties
 */
export const getPropertiesWithFilters = webMethod(
    Permissions.Anyone,
    async (filters) => {
        try {
            const { 
                language, 
                propertyType, 
                minPrice, 
                maxPrice, 
                minBedrooms,
                maxBedrooms,
                stateCity,
                status = "Approved" 
            } = filters;

            let query = wixData.query("PropertyTranslations")
                .eq("language", language)
                .eq("status", status);

            // Apply optional filters
            if (propertyType) {
                query = query.hasSome("propertyType", [propertyType]);
            }

            if (minPrice) {
                query = query.ge("minPrice", minPrice);
            }

            if (maxPrice) {
                query = query.le("maxPrice", maxPrice);
            }

            if (minBedrooms) {
                query = query.ge("minBedrooms", minBedrooms);
            }

            if (maxBedrooms) {
                query = query.le("maxBedrooms", maxBedrooms);
            }

            if (stateCity) {
                query = query.contains("stateCity", stateCity);
            }

            const results = await query.find({ suppressAuth: true });

            return { 
                success: true, 
                data: results.items,
                totalCount: results.totalCount
            };

        } catch (error) {
            console.error("Error fetching filtered properties:", error);
            return { success: false, error: error.message };
        }
    }
);
 
export const getApprovedPropertiesByLanguage = webMethod(
    Permissions.Anyone,
    async (language) => {
        try {
            const results = await wixData.query("PropertyTranslations")
                .eq("language", language)
                .eq("status", "Approved")
                .find({ suppressAuth: true });

            console.log(`Found ${results.items.length} approved properties for language: ${language}`);
            return { 
                success: true, 
                data: results.items,
                totalCount: results.totalCount
            };

        } catch (error) {
            console.error("Error fetching approved properties:", error);
            return { success: false, error: error.message };
        }
    }
);

 
 
 