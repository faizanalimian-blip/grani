import wixData from 'wix-data';
import { fetch } from 'wix-fetch';
import { Permissions, webMethod } from 'wix-web-module';
import { sendEmailToAdmin } from 'backend/sendMail.web.js';
// ============================================
// GOOGLE CLOUD TRANSLATE API CONFIGURATION
// ============================================
const GOOGLE_TRANSLATE_API_KEY = 'AIzaSyCuFzK4mPaP0JFlCJyw-uFK7h-w55MS1hw';
const GOOGLE_TRANSLATE_API_URL = 'https://translation.googleapis.com/language/translate/v2';

const ALL_LANGUAGES = ['en', 'he', 'de'];

// ============================================
// APPROVE REQUEST - UPDATES BOTH COLLECTIONS
// ============================================
export const approveRequest = webMethod(
    Permissions.Anyone,
    async (requestId) => {
        try {
            console.log('🟢 Approving request:', requestId);

            // 1) Update main BuyRequests collection
            const mainRequest = await wixData.get("BuyRequests", requestId, {
                suppressAuth: true
            });

            if (!mainRequest) {
                return { success: false, error: "Request not found" };
            }

            // Update only the status field, preserve everything else
            mainRequest.status = "Approved";

            await wixData.update("BuyRequests", mainRequest, {
                suppressAuth: true
            });

            console.log('✅ Main request approved');

            // 2) Update all translations for this request
            const translations = await wixData.query('BuyRequestTranslations')
                .eq('buyRequestId', requestId)
                .find();

            if (translations.items.length > 0) {
                const updatePromises = translations.items.map(translation => {
                    translation.status = "Approved";
                    return wixData.update('BuyRequestTranslations', translation, {
                        suppressAuth: true
                    });
                });

                await Promise.all(updatePromises);
                console.log(`✅ Updated ${translations.items.length} translations`);
            }

            return {
                success: true,
                message: "Request approved successfully"
            };

        } catch (error) {
            console.error('❌ Error approving request:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
);
// Helper function to format price with K/M
function formatPriceCompact(minPrice, maxPrice) {
    const formatNumber = (price) => {
        if (!price || price <= 0) return null;
        if (price >= 1000000) {
            const millions = price / 1000000;
            return millions === Math.floor(millions) ? `${millions}M` : `${parseFloat(millions.toFixed(2))}M`;
        }
        if (price >= 1000) {
            const thousands = price / 1000;
            return thousands === Math.floor(thousands) ? `${thousands}K` : `${Math.round(thousands)}K`;
        }
        return price.toLocaleString();
    };

    const minFormatted = formatNumber(minPrice);
    const maxFormatted = formatNumber(maxPrice);

    if (!minPrice && !maxPrice) return "Contact For Price";

    if (minPrice && maxPrice) {
        return minPrice === maxPrice 
            ? `€${minFormatted}` 
            : `€${minFormatted} - €${maxFormatted}`;
    }

    if (minPrice) return `€${minFormatted}+`;
    if (maxPrice) return `Up to €${maxFormatted}`;

    return "Price on Request";
}
// ============================================
// REJECT REQUEST - UPDATES BOTH COLLECTIONS
// ============================================
export const disapproveRequest = webMethod(
    Permissions.Anyone,
    async (requestId) => {
        try {
            console.log('🔴 Rejecting request:', requestId);

            // 1) Update main BuyRequests collection
            const mainRequest = await wixData.get("BuyRequests", requestId, {
                suppressAuth: true
            });

            if (!mainRequest) {
                return { success: false, error: "Request not found" };
            }

            // Update only the status field, preserve everything else
            mainRequest.status = "Rejected";

            await wixData.update("BuyRequests", mainRequest, {
                suppressAuth: true
            });

            console.log('✅ Main request rejected');

            // 2) Update all translations for this request
            const translations = await wixData.query('BuyRequestTranslations')
                .eq('buyRequestId', requestId)
                .find();

            if (translations.items.length > 0) {
                const updatePromises = translations.items.map(translation => {
                    translation.status = "Rejected";
                    return wixData.update('BuyRequestTranslations', translation, {
                        suppressAuth: true
                    });
                });

                await Promise.all(updatePromises);
                console.log(`✅ Updated ${translations.items.length} translations`);
            }

            return {
                success: true,
                message: "Request rejected successfully"
            };

        } catch (error) {
            console.error('❌ Error rejecting request:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
);

// ============================================
// GET ALL BUY REQUESTS (keep existing)
// ============================================
export const getBuyRequests = webMethod(
    Permissions.Anyone,
    () => {
        return wixData.query("BuyRequests")
            .descending("_createdDate")
            .find({ suppressAuth: true })
            .then((results) => {
                console.log("Loaded buy requests:", results.items.length);
                return { success: true, data: results.items };
            })
            .catch((error) => {
                console.error("Error loading buy requests:", error);
                return { success: false, error: error.message };
            });
    }
);


// ============================================
// BUILD TRANSLATION DOCUMENT
// ============================================
function buildTranslationDoc(buyRequestId, language, requestData, isSource, translatedComments = null) {
    return {
        buyRequestId,
        language,
        autoTranslated: !isSource,
        lastTranslated: new Date(),

        // Translatable field (COMMENTS instead of title)
        comments: isSource ? requestData.comments : translatedComments,

        // Non-translatable fields (copy from original)
        title: requestData.title || '', // Keep original title untranslated
        name: requestData.name,
        email: requestData.email,
        zip_code: requestData.zip_code,
        agreement_to_contact: requestData.agreement_to_contact,
        property_type: requestData.property_type,
        min_rooms: requestData.min_rooms,
        max_rooms: requestData.max_rooms,
        min_area: requestData.min_area,
        min_price: requestData.min_price,
        max_price: requestData.max_price,
        neighbourhood: requestData.neighbourhood,
        phone: requestData.phone,
        cities: requestData.cities,
        country: requestData.country,
        status: requestData.status || 'Pending'
    };
}

export const saveBuyRequestWithTranslations = webMethod(
    Permissions.Anyone,
    async (requestData) => {
        try {
            console.log('🚀 Starting buy request save');

            // 1) Prepare data with translation flags
            const buyRequestData = {
                ...requestData,
                sourceLanguage: null, // Will be auto-detected by cron
                availableLanguages: ALL_LANGUAGES,
                translationsCompleted: false,
                translationError: null
            };

            // 2) Save immediately (INSTANT - no translation)
            const savedRequest = await wixData.insert("BuyRequests", buyRequestData, {
                suppressAuth: true
            });

            console.log('✅ Buy request saved:', savedRequest._id);

            // 3) Send email immediately (with original language)
            const emailData = prepareEmailData(requestData, savedRequest._id);
            await sendEmailToAdmin(emailData, 'V6mhPWC');

            console.log('📧 Email sent to admin');

            // 4) Cron will handle translations asynchronously
            return {
                success: true,
                id: savedRequest._id,
                message: 'Request saved successfully. Translations will be ready shortly.'
            };

        } catch (error) {
            console.error('❌ Error in saveBuyRequestWithTranslations:', error);
            return {
                success: false,
                error: "Failed to save request. Please try again."
            };
        }
    }
);

// Helper function to prepare email data with single body variable
function prepareEmailData(requestData, requestId) {
      const formatPrice = (price) => {
        if (!price || price <= 0) return 'N/A';
        if (price >= 1000000) {
            const millions = price / 1000000;
            return `€${millions === Math.floor(millions) ? millions : parseFloat(millions.toFixed(2))}M`;
        }
        if (price >= 1000) {
            const thousands = price / 1000;
            return `€${thousands === Math.floor(thousands) ? thousands : Math.round(thousands)}K`;
        }
        return `€${price.toLocaleString()}`;
    };
    const emailBody =`
Request ID: ${requestId}
Submitted: ${new Date().toLocaleString()}

CONTACT INFORMATION
Name: ${requestData.name || 'N/A'}
Email: ${requestData.email || 'N/A'}
Phone: ${requestData.phone || 'N/A'}

PROPERTY DETAILS
Country: ${requestData.country || 'N/A'}
Cities: ${requestData.cities || 'N/A'}
Zip Code: ${requestData.zip_code || 'N/A'}
Neighbourhood: ${requestData.neighbourhood || 'N/A'}
Property Type: ${requestData.property_type || 'N/A'}

REQUIREMENTS
Rooms: ${requestData.min_rooms || 'N/A'} - ${requestData.max_rooms || 'N/A'}
Min Area: ${requestData.min_area || 'N/A'}
Price Range: ${formatPrice(requestData.min_price)} - ${formatPrice(requestData.max_price)}

ADDITIONAL COMMENTS
${requestData.comments || 'N/A'}

Status: ${requestData.status || 'Pending'}`;

    return {
        emailBody: String(emailBody)
    };
}

// ============================================
// UPDATE WITH TRANSLATIONS               // need to update for numbers
// ============================================
export const updateBuyRequestWithTranslations = webMethod(
    Permissions.Anyone,
    async (requestId, updatedData) => {
        try {
            console.log('🔄 Starting buy request update:', requestId);

            // 1) Validate request ID
            if (!requestId) {
                return { success: false, error: "Request ID is required" };
            }

            // 2) Get existing record
            const existingItem = await wixData.get("BuyRequests", requestId, {
                suppressAuth: true
            });

            if (!existingItem) {
                return { success: false, error: "Request not found" };
            }

            // 3) Check if COMMENTS changed
            const commentsChanged = updatedData.comments && updatedData.comments !== existingItem.comments;

            // 4) Prepare update
            const itemToUpdate = {
                ...existingItem,
                ...updatedData,
                _id: requestId
            };

            // If comments changed, reset translation status
            if (commentsChanged) {
                console.log('📝 Comments changed, queueing for re-translation');
                itemToUpdate.translationsCompleted = false;
                itemToUpdate.translationError = null;
                itemToUpdate.sourceLanguage = null;
            }

            delete itemToUpdate._createdDate;
            delete itemToUpdate._updatedDate;
            delete itemToUpdate._owner;

            // 5) Update main record
            const result = await wixData.update("BuyRequests", itemToUpdate, {
                suppressAuth: true
            });

            console.log('✅ Buy request updated:', requestId);

            // 6) If comments changed, delete old translations (cron will recreate)
            if (commentsChanged) {
                const oldTranslations = await wixData.query('BuyRequestTranslations')
                    .eq('buyRequestId', requestId)
                    .find();

                if (oldTranslations.items.length > 0) {
                    const idsToDelete = oldTranslations.items.map(item => item._id);
                    await wixData.bulkRemove('BuyRequestTranslations', idsToDelete, {
                        suppressAuth: true
                    });
                    console.log(`🗑️ Removed ${oldTranslations.items.length} old translations`);
                }
            }

            return {
                success: true,
                data: result,
                id: result._id,
                message: commentsChanged 
                    ? 'Request updated. Translations will be ready shortly.' 
                    : 'Request updated successfully.'
            };

        } catch (error) {
            console.error('❌ Error in updateBuyRequestWithTranslations:', error);
            return {
                success: false,
                error: "An internal error occurred. Please try again."
            };
        }
    }
);
// ============================================
// GET REQUEST DETAILS (keep existing function)
// ============================================
export const getRequestDetails = webMethod(
    Permissions.Anyone,
    (requestId) => {
        return wixData.get("BuyRequests", requestId, { suppressAuth: true })
            .then((result) => {
                console.log("Found request details for:", requestId);
                return { success: true, data: result };
            })
            .catch((error) => {
                console.error("Error fetching request details:", error);
                return { success: false, error: error.message };
            });
    }
);