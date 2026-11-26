import wixData from 'wix-data';
import { Permissions, webMethod } from 'wix-web-module';
 

// ============================================
// LOGGING HELPER
// ============================================
function log(category, message, data = null) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    if (data) {
        console.log(`[${timestamp}] [${category}] ${message}:`, data);
    } else {
        console.log(`[${timestamp}] [${category}] ${message}`);
    }
}
 
// ============================================
// DATA NORMALIZATION FUNCTIONS
// ============================================

/**
 * Parse incoming patch data
 */
function parseIncomingPatch(offerPatch) {
    if (!offerPatch) return {};
    if (typeof offerPatch === 'string') {
        try {
            return JSON.parse(offerPatch);
        } catch {
            throw new Error('Invalid JSON in offerPatch');
        }
    }
    if (Array.isArray(offerPatch)) {
        throw new Error('offerPatch must be an object, not an array');
    }
    return offerPatch;
}

/**
 * Normalize patch data
 */
function normalizePatchData(patch) {
    const normalized = {};

    // Text fields
    if ('title' in patch) normalized.title = patch.title;
    if ('stateCity' in patch) normalized.stateCity = patch.stateCity;
    if ('state' in patch) normalized.state = patch.state;
    if ('description' in patch) normalized.description = patch.description;
    if ('shortDescription' in patch) normalized.shortDescription = patch.shortDescription;
    if ('developer1' in patch) normalized.developer1 = patch.developer1;
    if ('delivery' in patch) normalized.delivery = patch.delivery;
    if ('projectName' in patch) normalized.projectName = patch.projectName;
    if ('status' in patch) normalized.status = patch.status;
    if ('email' in patch) normalized.email = patch.email;
    if ('requestId' in patch) normalized.requestId = patch.requestId;
    if ('commission' in patch) normalized.commission = patch.commission;
if ('neighbourhood' in patch) normalized.neighbourhood = patch.neighbourhood;
    // Tag arrays
    if ('country' in patch) {
        normalized.country = Array.isArray(patch.country) ? patch.country :
            (patch.country ? [patch.country] : []);
    }
    if ('propertyType' in patch) {
        normalized.propertyType = Array.isArray(patch.propertyType) ? patch.propertyType :
            (patch.propertyType ? [patch.propertyType] : []);
    }
    if ('dealType' in patch) {
        normalized.dealType = Array.isArray(patch.dealType) ? patch.dealType :
            (patch.dealType ? [patch.dealType] : []);
    }
    if ('investmentOpportunity' in patch) {
        normalized.investmentOpportunity = Array.isArray(patch.investmentOpportunity) ?
            patch.investmentOpportunity :
            (patch.investmentOpportunity ? [patch.investmentOpportunity] : []);
    }

    // Numbers
    if ('minBedrooms' in patch) normalized.minBedrooms = Number(patch.minBedrooms);
    if ('maxBedrooms' in patch) normalized.maxBedrooms = Number(patch.maxBedrooms);
    if ('minPrice' in patch) normalized.minPrice = Number(patch.minPrice);
    if ('maxPrice' in patch) normalized.maxPrice = Number(patch.maxPrice);
    if ('zipCode' in patch) normalized.zipCode = patch.zipCode;
    if ('plotArea' in patch) normalized.plotArea = Number(patch.plotArea);

    // Complex fields
    if ('address' in patch) normalized.address = patch.address;
    if ('gallery' in patch) normalized.gallery = Array.isArray(patch.gallery) ? patch.gallery : [];
    if ('availableDate' in patch) normalized.availableDate = patch.availableDate;

    // Booleans
    if ('agreement' in patch) normalized.agreement = !!patch.agreement;
    if ('email_sent_to_buyer' in patch) normalized.email_sent_to_buyer = !!patch.email_sent_to_buyer;
    if ('closeToSea' in patch) normalized.closeToSea = !!patch.closeToSea;
    if ('seaView' in patch) normalized.seaView = !!patch.seaView;

    // Property status
    if ('propertyStatus' in patch) normalized.propertyStatus = patch.propertyStatus || null;

    return normalized;
}

 
// ============================================
// DATABASE FUNCTIONS
// ============================================

/**
 * Find property by ID
 */
async function findPropertyById(propertyId) {
    const id = String(propertyId || '').trim();

    if (!id) {
        throw new Error('Property ID is required');
    }

    log('FIND', `Looking for property: ${id}`);

    try {
        const property = await wixData.get('Properties', id, { suppressAuth: true });
        if (property) {
            log('FIND', 'Property found');
            return { propertyId: id, property };
        }
    } catch (err) {
        log('FIND', `Property not found: ${err.message}`);
    }

    throw new Error(`Property not found with ID: ${id}`);
}

 

// ============================================
// MAIN UPDATE FUNCTION
// ============================================

export const updatePropertyWithTranslations = webMethod(
    Permissions.Anyone,
    async (propertyId, offerPatch, editedLanguage) => {
        log('START', '=== UPDATE PROPERTY WITH TRANSLATIONS ===');
        log('INPUT', 'Parameters', {
            propertyId,
            editedLanguage,
            patchKeys: Object.keys(offerPatch || {})
        });
        
        try {
            // Step 1: Find the property
            const { propertyId: resolvedId, property: currentProperty } = await findPropertyById(propertyId);
            
            // // Step 2: Check language permissions
            // const sourceLanguage = currentProperty.sourceLanguage || 'en';
            // if (editedLanguage !== sourceLanguage) {
            //     log('ERROR', `Can only edit in source language (${sourceLanguage})`);
            //     return {
            //         success: false,
            //         error: `Please switch to the source language (${sourceLanguage}) to edit this listing.`
            //     };
            // }
            
            // Step 3: Parse and normalize the patch
            const parsedPatch = parseIncomingPatch(offerPatch);
            const normalizedPatch = normalizePatchData(parsedPatch);
            
            log('PATCH', 'Normalized patch fields', Object.keys(normalizedPatch));
            
            if (Object.keys(normalizedPatch).length === 0) {
                log('INFO', 'No changes to apply');
                return {
                    success: true,
                    propertyId: resolvedId,
                    message: 'No changes detected'
                };
            }
            
            // Step 4: Create updated property
            const updatedProperty = {
                ...currentProperty,
                ...normalizedPatch,
                translationsCompleted: false, // Mark for retranslation
                updatedAt: new Date()
            };
            
            // Step 5: Update Properties table
            log('UPDATE', 'Updating Properties table and marking for retranslation');
            const savedProperty = await wixData.update('Properties', updatedProperty, { suppressAuth: true });
            
            // Step 6: Return success - cron will handle translations
            log('SUCCESS', '=== UPDATE COMPLETED - Marked for retranslation ===');
            
            return {
                success: true,
                propertyId: resolvedId,
                message: 'Property updated successfully. Translations will be updated shortly.'
            };
            
        } catch (error) {
            log('ERROR', 'Update failed', error.stack || error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
);