import wixData from 'wix-data';
import { Permissions, webMethod } from 'wix-web-module';

// ============================================
// CONFIGURATION
// ============================================
const ALL_LANGUAGES = ['en', 'he', 'de'];

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
// HELPER FUNCTIONS
// ============================================

function toTagArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.includes(',')) {
        return value.split(',').map(t => t.trim()).filter(Boolean);
    }
    return [value];
}

function formatGalleryImages(imageUrls) {
    if (!Array.isArray(imageUrls)) return [];
    return imageUrls.map((url, index) => ({
        type: 'image',
        src: url,
        title: `Property Image ${index + 1}`,
        description: '',
        image: { imageInfo: url }
    }));
}

function preparePropertyData(offerData) {
    return {
        // Text fields
        title: offerData.property_title,
        stateCity: offerData.city,
        state: offerData.state,
        description: offerData.description,
        shortDescription: offerData.short_description,
        developer1: offerData.developer_name,
        delivery: offerData.delivery_time,
        projectName: offerData.project_name,
        status: offerData.status || 'Pending',
        neighbourhood: offerData.neighbourhood,
        email: offerData.email,
        requestId: offerData.request_id,
        commission: `${offerData.commission}%`,

        // Tag fields (arrays)
        country: toTagArray(offerData.country),
        propertyType: toTagArray(offerData.property_type),
        dealType: toTagArray(offerData.deal_type),
        investmentOpportunity: toTagArray(offerData.investment_opportunity),

        // Number fields
        minBedrooms: offerData.min_bedrooms,
        maxBedrooms: offerData.max_bedrooms,
        minPrice: offerData.min_price || 0,
        maxPrice: offerData.max_price || 0,
        zipCode: offerData.zip_code,
        plotArea: offerData.plot_area,

        // Object/Complex fields
        address: offerData.address,
        gallery: formatGalleryImages(offerData.gallery),

        // Date field
        availableDate: offerData.available_date,

        // Boolean fields
        agreement: offerData.agreement,
        email_sent_to_buyer: false,
        closeToSea: !!offerData.close_to_sea,
        seaView: !!offerData.sea_view,

        // Property status (Off-plan / In Construction / New & Ready / Resale)
        propertyStatus: offerData.property_status || null,

        // Metadata
        createdAt: new Date(),
        updatedAt: new Date(),
        translationsCompleted: false
    };
}

 

// ============================================
// PUBLIC WEB METHOD - SAVE PROPERTY
// ============================================

/**
 * Save new property with async translations
 */
export const savePropertyWithTranslations = webMethod(
    Permissions.Anyone,
    async (offerData, sourceLanguage) => {
        try {
            // Validate language (we'll auto-detect later, but validate the input exists)
            if (!sourceLanguage || !ALL_LANGUAGES.includes(sourceLanguage)) {
                throw new Error(`Invalid sourceLanguage. Must be one of: ${ALL_LANGUAGES.join(', ')}`);
            }

            log('SAVE_START', 'Starting property save', { sourceLanguage });

            // 1) Prepare property data
            const propertyData = preparePropertyData(offerData);

            // NOTE: We store the USER-SELECTED language here
            // The ACTUAL language will be auto-detected by the cron job
            propertyData.sourceLanguage = sourceLanguage;
            propertyData.availableLanguages = ALL_LANGUAGES;
            propertyData.translationsCompleted = false;
            propertyData.translationError = null;

            // 2) Save to Properties table (INSTANT)
            const propertyResult = await wixData.insert('Properties', propertyData, { suppressAuth: true });
            log('SAVE_SUCCESS', 'Property saved', { propertyId: propertyResult._id });

            // 3) Queue for translation (async - cron will handle it)
           log('SAVE_COMPLETE', 'Property saved and ready for translation');
 
            return {
                success: true,
                propertyId: propertyResult._id,
                message: 'Property saved successfully. Translations will be ready shortly.'
            };

        } catch (e) {
            log('SAVE_ERROR', 'Save property failed', e.message);
            console.error('Full error:', e);
            return {
                success: false,
                error: e.message || 'Failed to save property. Please try again.'
            };
        }
    }
);

export const translateExistingProperty = webMethod(
    Permissions.Anyone,
    async (propertyId, sourceLanguage) => {
        try {
            if (!propertyId) {
                throw new Error('Property ID is required.');
            }

            log('TRANSLATE_EXISTING_START', 'Marking property for translation', { propertyId });

            // Just mark the property as needing translation
            await wixData.update('Properties', {
                _id: propertyId,
                translationsCompleted: false
            }, { suppressAuth: true });

            return {
                success: true,
                propertyId: propertyId,
                message: 'Property marked for translation. Translations will be ready shortly.'
            };
            
        } catch (e) {
            log('TRANSLATE_EXISTING_ERROR', 'Failed to mark property', e.message);
            console.error('Full error:', e);
            return { 
                success: false, 
                error: e.message || 'Failed to mark property for translation.'
            };
        }
    }
);

export const checkTranslationStatus = webMethod(
    Permissions.Anyone,
    async (propertyId) => {
        try {
            const property = await wixData.get('Properties', propertyId, { suppressAuth: true });
            
            if (!property) {
                return {
                    success: false,
                    error: 'Property not found'
                };
            }

            return {
                success: true,
                status: property.translationsCompleted ? 'completed' : 'pending',
                message: property.translationsCompleted ? 
                    'Translations completed' : 
                    'Translations pending'
            };
            
        } catch (e) {
            return {
                success: false,
                error: e.message
            };
        }
    }
);

//  {
//     "offerData": {
//         "property_title": "Luxury Seafront Villa in Tel Aviv",
//         "city": "Tel Aviv",
//         "state": "Tel Aviv District",
//         "country": "Israel",
//         "address": {
//             "formatted": "123 HaYarkon Street, Tel Aviv, 63432, Israel",
//             "location": {
//                 "latitude": 32.0853,
//                 "longitude": 34.7818
//             },
//             "streetAddress": {
//                 "number": "123",
//                 "name": "HaYarkon Street"
//             },
//             "city": "Tel Aviv",
//             "subdivision": "Tel Aviv District",
//             "country": "Israel",
//             "postalCode": "63432"
//         },
//         "zip_code": 63432,
//         "property_type": "Villa",
//         "deal_type": "Sale",
//         "investment_opportunity": "High ROI,Beachfront,Prime Location",
//         "min_price": 2500000,
//         "max_price": 3200000,
//         "commission": 3,
//         "min_bedrooms": 4,
//         "max_bedrooms": 6,
//         "plot_area": 500,
//         "gallery": [
//             "https://static.wixstatic.com/media/villa1.jpg",
//             "https://static.wixstatic.com/media/villa2.jpg",
//             "https://static.wixstatic.com/media/villa3.jpg"
//         ],
//         "short_description": "Stunning modern villa with panoramic sea views",
//         "description": "This exceptional villa offers luxury living at its finest. Located on Tel Aviv's prestigious beachfront, this property features modern architecture, high-end finishes, private pool, and direct beach access. Perfect for families or as an investment opportunity.",
//         "developer_name": "Coastal Properties Ltd",
//         "project_name": "Marina Residences",
//         "available_date": "2025-10-22T19:00:00.000Z",
//         "delivery_time": "Q2 2025",
//         "email": "contact@coastalproperties.il",
//         "agreement": true,
//         "status": "Active",
//         "request_id": "REQ-2025-001"
//     },
//     "sourceLanguage": "en"
// }