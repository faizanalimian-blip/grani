 import { Permissions, webMethod } from "wix-web-module";
 import wixData from 'wix-data';
 import { sendEmailToUser, sendEmailToAdmin } from 'backend/sendMail.web';

 export const approvePropertyOffer = webMethod(
     Permissions.Anyone,
     async (offerId) => {
         try {
             // Get offer data
             const offer = await wixData.get("Properties", offerId, { suppressAuth: true });
             const formatPropertyUrl = () => {
                 const baseUrl = "https://www.sharon-homes.com";
                 if (offer['link-properties-1-title']) {
                     const path = offer['link-properties-1-title'];
                     if (path.startsWith('/')) {
                         return `${baseUrl}${path}`;
                     }
                     return `${baseUrl}/${path}`;
                 }
                 // Fallback: generate from title
                 if (offer.title) {
                     const slug = offer.title.toLowerCase()
                         .replace(/[^a-z0-9]+/g, '-')
                         .replace(/^-|-$/g, '');
                     return `${baseUrl}/properties-1/${slug}`;
                 }
                 return `${baseUrl}/properties`;
             };

             // Update offer status in main Properties collection
             const updatedOffer = await wixData.update("Properties", {
                 ...offer,
                 status: "Approved",
                 updatedAt: new Date()
             }, { suppressAuth: true });

             // Update status in PropertyTranslations collection (all 3 language rows)
             try {
                 // Query all translation rows with matching propertyId
                 const translationResults = await wixData.query("PropertyTranslations")
                     .eq("propertyId", offerId)
                     .find({ suppressAuth: true });

                 console.log(`Found ${translationResults.items.length} translation rows for propertyId: ${offerId}`);

                 // Update each translation row
                 const updatePromises = translationResults.items.map(async (translationRow) => {
                     return await wixData.update("PropertyTranslations", {
                         ...translationRow,
                         status: "Approved",
                         updatedAt: new Date()
                     }, { suppressAuth: true });
                 });

                 await Promise.all(updatePromises);
                 console.log(`Updated ${translationResults.items.length} translation rows to Approved status`);

             } catch (translationError) {
                 console.error("Error updating translations:", translationError);
                 // Continue even if translation update fails
             }

             // Helper to extract text from tag arrays
             const extractFromTagArray = (tagArray) => {
                 if (!tagArray) return "Not specified";
                 if (Array.isArray(tagArray) && tagArray.length > 0) {
                     return tagArray.join(", ");
                 }
                 if (typeof tagArray === 'string') {
                     return tagArray;
                 }
                 return "Not specified";
             };

             // Helper to ensure values are strings - FIXED VERSION
             const ensureString = (value) => {
                 if (value === null || value === undefined) return "";
                 if (Array.isArray(value)) return value.join(", ");
                 if (typeof value === 'object') return ""; // Handle objects that shouldn't be strings
                 return String(value);
             };

             // Format location string for new structure - FIXED VERSION
             const formatLocation = () => {
                 const locationParts = [];

                 // Only add string values to location
                 if (offer.address && typeof offer.address === 'string') {
                     locationParts.push(offer.address);
                 }

                 if (offer.stateCity && typeof offer.stateCity === 'string') {
                     locationParts.push(offer.stateCity);
                 }

                 if (offer.state && typeof offer.state === 'string') {
                     locationParts.push(offer.state);
                 }

                 if (offer.zipCode && (typeof offer.zipCode === 'string' || typeof offer.zipCode === 'number')) {
                     locationParts.push(String(offer.zipCode));
                 }

                 // Filter and ensure all parts are strings before joining
                 return locationParts
                     .filter(p => p && typeof p === 'string' && p.trim() !== '')
                     .join(', ') || "Location not specified";
             };

             // Format bedroom range for display
             const formatBedroomRange = () => {
                 if (offer.minBedrooms && offer.maxBedrooms) {
                     if (offer.minBedrooms === offer.maxBedrooms) {
                         return `${offer.minBedrooms} Bedroom${offer.minBedrooms > 1 ? 's' : ''}`;
                     } else {
                         return `${offer.minBedrooms}-${offer.maxBedrooms} Bedrooms`;
                     }
                 } else if (offer.minBedrooms) {
                     return `${offer.minBedrooms}+ Bedrooms`;
                 } else if (offer.maxBedrooms) {
                     return `Up to ${offer.maxBedrooms} Bedrooms`;
                 }
                 return "Bedrooms not specified";
             };

             // Try to get buyer data - with error handling
             let buyer = null;
             let buyerEmailData = null;
             let sellerEmailData = null;

             try {
                 if (offer.requestId) {
                     buyer = await wixData.get("BuyRequests", offer.requestId, { suppressAuth: true });
                 }
             } catch (buyerError) {
                 console.error("Could not fetch buyer data:", buyerError);
                 // Continue without buyer data
             }

             if (buyer) {
                 // Send email to buyer about the new offer
                 buyerEmailData = {
                     name: ensureString(buyer.name),
                     email: ensureString(buyer.email),
                     phone: ensureString(buyer.phone) || "Not provided",
                     // Offer details for buyer - using new field names
                     propertyType: extractFromTagArray(offer.propertyType),
                     dealType: extractFromTagArray(offer.dealType),
                     price: formatPriceDisplay(offer.minPrice, offer.maxPrice),
                     location: formatLocation(),
                     address: ensureString(offer.address),
                     plotArea: offer.plotArea ? `${offer.plotArea.toLocaleString()} sq ft` : "Not specified",
                     bedrooms: formatBedroomRange(), // UPDATED to use min/max bedrooms
                     availableDate: offer.availableDate ? new Date(offer.availableDate).toLocaleDateString() : "Not specified",
                     description: ensureString(offer.shortDescription || offer.description) || "No description provided",
                     // Seller/Developer details
                     developerName: ensureString(offer.developer1 || offer.developerName),
                     projectName: ensureString(offer.projectName),
                     sellerEmail: ensureString(offer.email),
                     commission: ensureString(offer.commission),
                     propertyUrl: formatPropertyUrl(),
                     // Original request details for context
                     originalBudget: buyer.min_price && buyer.max_price ?
                         `€${buyer.min_price.toLocaleString()} - €${buyer.max_price.toLocaleString()}` : "Budget not specified",
                     requestedLocation: ensureString(buyer.cities)
                 };

                 // Send email to offer maker (developer/seller) about approval
                 sellerEmailData = {
                     name: ensureString(offer.developer1 || offer.developerName),
                     email: ensureString(offer.email),
                     // Property details
                     propertyTitle: ensureString(offer.title),
                     propertyType: extractFromTagArray(offer.propertyType),
                     price: formatPriceDisplay(offer.minPrice, offer.maxPrice),
                     location: formatLocation(),
                     projectName: ensureString(offer.projectName),
                     // Buyer details
                     buyerName: ensureString(buyer.name),
                     buyerEmail: ensureString(buyer.email),
                     buyerBudget: buyer.min_price && buyer.max_price ?
                         `€${buyer.min_price.toLocaleString()} - €${buyer.max_price.toLocaleString()}` : "Budget not specified",
                     buyerRequirements: ensureString(buyer.comments) || "No specific requirements"
                 };
             } else {
                 console.log("No buyer data available, skipping email notifications");
             }

             // Send emails only if we have the data
             if (buyerEmailData && sellerEmailData) {
                 // Email template IDs
                 const buyerEmailTemplateId = "UxXUE1t";
                 const sellerEmailTemplateId = "UxXUxww";

                 try {
                     console.log("Buyer email data:", JSON.stringify(buyerEmailData, null, 2));
                     console.log("Seller email data:", JSON.stringify(sellerEmailData, null, 2));

                     await sendEmailToUser(buyerEmailData, buyerEmailTemplateId);
                     console.log("Email sent to buyer successfully");

                     await sendEmailToUser(sellerEmailData, sellerEmailTemplateId);
                     console.log("Email sent to seller successfully");

                 } catch (emailError) {
                     console.error("Error sending emails:", emailError);
                     // Don't fail the approval if email fails
                 }
             }

             return { success: true, message: "Property offer approved" };

         } catch (error) {
             console.error("Error approving property offer:", error);
             return { success: false, error: error.message };
         }
     }
 );//
export const getApprovedRequestsPaginated = webMethod(
    Permissions.Anyone,
    async (page = 1, itemsPerPage = 3, language = 'en') => {
        try {
            const skipCount = (page - 1) * itemsPerPage;

            // Get total count first
            const totalResult = await wixData.query("BuyRequests")
                .eq("status", "Approved")
                .count({ suppressAuth: true });

            const totalCount = totalResult;

            // Get paginated results
            const results = await wixData.query("BuyRequests")
                .eq("status", "Approved")
                .descending("_createdDate")
                .skip(skipCount)
                .limit(itemsPerPage)
                .find({ suppressAuth: true });

            console.log(`Found ${results.items.length} approved requests (Page ${page})`);

            // Fetch translated comments for current language
            const ids = results.items.map(item => item._id);
            let translatedCommentsMap = {};

            if (ids.length > 0) {
                const translations = await wixData.query("BuyRequestTranslations")
                    .hasSome("buyRequestId", ids)
                    .eq("language", language)
                    .find({ suppressAuth: true });

                translations.items.forEach(t => {
                    translatedCommentsMap[t.buyRequestId] = t.comments;
                });
            }

            // Format data for repeater
            const formattedData = results.items.map(item => {
                let propertyDetails = item.property_type || "Property";

                if (item.min_rooms || item.max_rooms) {
                    if (item.min_rooms && item.max_rooms) {
                        propertyDetails += ` • ${item.min_rooms}-${item.max_rooms} `;
                    } else if (item.min_rooms) {
                        propertyDetails += ` • ${item.min_rooms}`;
                    } else if (item.max_rooms) {
                        propertyDetails += ` • Up to ${item.max_rooms} `;
                    }
                }

                if (item.min_area) {
                    propertyDetails += ` • ${item.min_area.toLocaleString()}+ sq ft`;
                }

                let priceRange = formatPriceForDisplay(item.min_price, item.max_price);
                let roomsText = "";
                if (item.min_rooms && item.max_rooms) {
                    roomsText = `${item.min_rooms} - ${item.max_rooms}`;
                } else if (item.min_rooms) {
                    roomsText = `${item.min_rooms}+`;
                } else if (item.max_rooms) {
                    roomsText = `Up to ${item.max_rooms}`;
                } else {
                    roomsText = "Any";
                }

                return {
                    _id: item._id,
                    name: item.name || "Unknown",
                    propertyDetails: propertyDetails,
                    city: item.cities || "Not specified",
                    priceRange: priceRange,
                    status: "Approved",
                    _createdDate: item._createdDate,
                    property_type: item.property_type || "Not specified",
                    roomsText: roomsText,
                    min_area: item.min_area ? `${item.min_area.toLocaleString()} sq ft` : "Not specified",
                    comments: translatedCommentsMap[item._id] || item.comments || "No comments",
                    neighbourhood: item.neighbourhood || "Not specified"
                };
            });

            return {
                success: true,
                data: formattedData,
                totalCount: totalCount,
                totalPages: Math.ceil(totalCount / itemsPerPage),
                currentPage: page
            };

        } catch (error) {
            console.error("Error fetching approved requests:", error);
            return { success: false, error: error.message };
        }
    }
);
// Helper function to format price with K/M for approved requests display
function formatPriceForDisplay(minPrice, maxPrice) {
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
        return minPrice === maxPrice ?
            `€${minFormatted}` :
            `€${minFormatted} - €${maxFormatted}`;
    }

    if (minPrice) return `€${minFormatted}+`;
    if (maxPrice) return `Up to €${maxFormatted}`;

    return "Price on Request";
}
 export const disapprovePropertyOffer = webMethod(
     Permissions.Anyone,
     async (offerId) => {
         try {
             const item = await wixData.get("Properties", offerId, { suppressAuth: true });

             // Update status in main Properties collection
             const updatedItem = await wixData.update("Properties", {
                 ...item,
                 status: "Rejected",
                 updatedAt: new Date()
             }, { suppressAuth: true });

             // Update status in PropertyTranslations collection (all 3 language rows)
             try {
                 // Query all translation rows with matching propertyId
                 const translationResults = await wixData.query("PropertyTranslations")
                     .eq("propertyId", offerId)
                     .find({ suppressAuth: true });

                 console.log(`Found ${translationResults.items.length} translation rows for propertyId: ${offerId}`);

                 // Update each translation row
                 const updatePromises = translationResults.items.map(async (translationRow) => {
                     return await wixData.update("PropertyTranslations", {
                         ...translationRow,
                         status: "Rejected",
                         updatedAt: new Date()
                     }, { suppressAuth: true });
                 });

                 await Promise.all(updatePromises);
                 console.log(`Updated ${translationResults.items.length} translation rows to Rejected status`);

             } catch (translationError) {
                 console.error("Error updating translations:", translationError);
                 // Continue even if translation update fails
             }

             console.log("Property offer disapproved:", offerId);
             return { success: true, message: "Property offer disapproved successfully" };

         } catch (error) {
             console.error("Error disapproving property offer:", error);
             return { success: false, error: error.message };
         }
     }
 );

 export const getPropertyOffersDashboard = webMethod(
     Permissions.Anyone,
     () => {
         return wixData.query("Properties").limit(1000) // Change this to your new collection name
             .descending("_createdDate")
             .find({ suppressAuth: true })
             .then((results) => {
                 console.log("Found property offers:", results.items.length);

                 // Format data for repeater - adapted for new structure
                 const formattedData = results.items.map(item => {
                     // Extract property type from tag array
                     let propertyTypeText = "Property";
                     if (item.propertyType && Array.isArray(item.propertyType) && item.propertyType.length > 0) {
                         propertyTypeText = item.propertyType.join(", ");
                     }

                     // Format property details with available fields
                     let propertyDetails = propertyTypeText;

                     // Add bedrooms info using min/max bedrooms fields
                     if (item.minBedrooms || item.maxBedrooms) {
                         let bedroomText = "";
                         if (item.minBedrooms && item.maxBedrooms) {
                             if (item.minBedrooms === item.maxBedrooms) {
                                 bedroomText = `${item.minBedrooms} Bed`;
                             } else {
                                 bedroomText = `${item.minBedrooms}-${item.maxBedrooms} Bedrooms`;
                             }
                         } else if (item.minBedrooms) {
                             bedroomText = `${item.minBedrooms}+ Bed`;
                         } else if (item.maxBedrooms) {
                             bedroomText = `Up to ${item.maxBedrooms} Bed`;
                         }

                         if (bedroomText) {
                             propertyDetails += ` • ${bedroomText}`;
                         }
                     }

                     // Add plot area info (field name changed from area to plotArea)
                     if (item.plotArea) {
                         propertyDetails += ` • ${item.plotArea.toLocaleString()} sq ft`;
                     }

                     // Format location: "City, State" - using new field names
                     let location = "";
                     if (item.stateCity && item.state) {
                         location = `${item.stateCity}, ${item.state}`;
                     } else if (item.stateCity) {
                         location = item.stateCity;
                     } else if (item.location) {
                         location = item.location;
                     }

                     // Format price using min/max values
                     let priceText = "";
                     if (item.minPrice || item.maxPrice) {
                         priceText = formatPriceDisplay(item.minPrice, item.maxPrice);
                     } else if (item.price) {
                         // Fallback to old price field if exists
                         priceText = item.price;
                         if (priceText && !priceText.includes('€') && !priceText.includes('$')) {
                             priceText = `€${priceText}`;
                         }
                     } else {
                         priceText = "Contact For Price";
                     }

                     // Format request ID
                     let requestIdText = "";
                     if (item.requestId) {
                         requestIdText = `#${item.requestId}`;
                     }

                     // Capitalize status
                     let formattedStatus = item.status || "Pending";
                     formattedStatus = formattedStatus.charAt(0).toUpperCase() + formattedStatus.slice(1);

                     // Extract name from developer or email
                     let displayName = item.developer1 || item.developerName || item.email || "Unknown";

                     return {
                         _id: item._id,
                         name: displayName,
                         propertyDetails: propertyDetails,
                         location: location,
                         price: priceText,
                         requestId: requestIdText,
                         status: formattedStatus,
                         _createdDate: item._createdDate || item.createdAt
                     };
                 });

                 return { success: true, data: formattedData };
             })
             .catch((error) => {
                 console.error("Error fetching property offers:", error);
                 return { success: false, error: error.message };
             });
     }
 );
 // Helper function to format price with K/M
 function formatPriceDisplay(minPrice, maxPrice) {
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
         return price.toString();
     };

     const minFormatted = formatNumber(minPrice);
     const maxFormatted = formatNumber(maxPrice);

     if (!minPrice && !maxPrice) return "Contact For Price";

     if (minPrice && maxPrice) {
         return minPrice === maxPrice ?
             `Starting from €${minFormatted}` :
             `€${minFormatted} - €${maxFormatted}`;
     }

     if (minPrice) return `Starting from €${minFormatted}`;
     if (maxPrice) return `Up to €${maxFormatted}`;

     return "Price on Request";
 }
 export const getPropertyOfferDetails = webMethod(
     Permissions.Anyone,
     (offerId) => {
         return wixData.get("Properties", offerId, { suppressAuth: true })
             .then((result) => {
                 console.log("Found property offer details for:", offerId);
                 return { success: true, data: result };
             })
             .catch((error) => {
                 console.error("Error fetching property offer details:", error);
                 return { success: false, error: error.message };
             });
     }
 );

 export const getApprovedPropertiesWithSearch = webMethod(
     Permissions.Anyone,
     async (page = 1, itemsPerPage = 5, searchText = "") => {
         try {
             const skipCount = (page - 1) * itemsPerPage;

             // Fast path (no search)
             if (!searchText || !searchText.trim()) {
                 const raw = await wixData.query("Properties")
                     .eq("status", "Approved")
                     .descending("_createdDate")
                     .skip(skipCount)
                     .limit(itemsPerPage)
                     .find({ suppressAuth: true });

                 return pack(raw.items.map(formatItem), raw.totalCount, page, itemsPerPage);
             }

             const search = searchText.trim();
             const searchLower = search.toLowerCase();

             // -------- Bucket B candidates (broad text OR) --------
             const fields = ["title", "state", "stateCity", "location", "address", "projectName", "developer1", "country"];
             let orQuery = wixData.query("Properties").eq("status", "Approved").contains(fields[0], search);
             for (let i = 1; i < fields.length; i++) {
                 orQuery = orQuery.or(
                     wixData.query("Properties").eq("status", "Approved").contains(fields[i], search)
                 );
             }

             const [broadRes, wideRes] = await Promise.all([
                 // Pull a broad set of text matches (limit generous slice)
                 orQuery.limit(1000).find({ suppressAuth: true }),

                 // Pull a wide Approved slice to scan propertyType tags for partials
                 wixData.query("Properties")
                 .eq("status", "Approved")
                 .limit(1000)
                 .find({ suppressAuth: true })
             ]);

             const broadItems = broadRes.items || [];
             const wideItems = wideRes.items || [];

             // -------- Bucket A (propertyType priority) --------
             // Match any tag in array: exact > startsWith > contains
             const propTypeMatched = [];
             for (const item of wideItems) {
                 const tags = Array.isArray(item.propertyType) ?
                     item.propertyType.map(t => (t || "").toString()) :
                     [];

                 if (!tags.length) continue;

                 const lower = tags.map(t => t.toLowerCase());
                 const exact = lower.some(t => t === searchLower);
                 const starts = !exact && lower.some(t => t.startsWith(searchLower));
                 const part = !exact && !starts && lower.some(t => t.includes(searchLower));

                 if (exact || starts || part) propTypeMatched.push(item);
             }

             // -------- Union + dedupe (prefer items that appear in both) --------
             const byId = new Map();
             const pushUnique = (arr, sourceLabel) => {
                 arr.forEach(it => {
                     if (!byId.has(it._id)) {
                         byId.set(it._id, { item: it, source: new Set([sourceLabel]) });
                     } else {
                         byId.get(it._id).source.add(sourceLabel);
                     }
                 });
             };

             pushUnique(propTypeMatched, 'A'); // propertyType bucket
             pushUnique(broadItems, 'B'); // broad text bucket

             const combined = Array.from(byId.values()).map(({ item, source }) => {
                 const score = computeScoreTypeFirst(item, searchLower, source);
                 return { item, score };
             });

             // Sort: propertyType matches first (score), then newest
             combined.sort((a, b) => {
                 if (b.score !== a.score) return b.score - a.score;
                 const ad = a.item._createdDate ? new Date(a.item._createdDate).getTime() : 0;
                 const bd = b.item._createdDate ? new Date(b.item._createdDate).getTime() : 0;
                 return bd - ad;
             });

             const totalCount = combined.length;
             const pageItems = combined.slice(skipCount, skipCount + itemsPerPage).map(x => formatItem(x.item));

             return pack(pageItems, totalCount, page, itemsPerPage);

         } catch (error) {
             console.error("Error fetching approved properties:", error);
             return { success: false, error: error.message };
         }
     }
 );

 // ---- helpers ----
 function computeScoreTypeFirst(item, searchLower, sourceSet) {
     let score = 0;

     // Bucket A membership (propertyType matched) hard boost
     if (sourceSet.has('A')) score += 10000; // forces type matches to the very top

     // Within type matches, grade exact/starts/contains for nicer intra-group ordering
     const types = Array.isArray(item.propertyType) ?
         item.propertyType.map(t => (t || '').toString().toLowerCase()) :
         [];

     if (sourceSet.has('A') && types.length) {
         if (types.some(t => t === searchLower)) score += 300; // exact
         else if (types.some(t => t.startsWith(searchLower))) score += 200; // startsWith
         else if (types.some(t => t.includes(searchLower))) score += 120; // contains
     }

     // Titles etc — much smaller weight, just for ordering inside Bucket B
     const title = (item.title || '').toString().toLowerCase();
     if (title) {
         if (title === searchLower) score += 40;
         else if (title.startsWith(searchLower)) score += 25;
         else if (title.includes(searchLower)) score += 10;
     }

     const soft = [
         item.state, item.stateCity, item.location, item.address,
         item.projectName, item.developer1,
         Array.isArray(item.country) ? item.country.join(' ') : item.country
     ].filter(Boolean).join(' ').toLowerCase();

     if (soft.includes(searchLower)) score += 5;

     return score;
 }

 function formatItem(item) {
     const propertyTypeText = Array.isArray(item.propertyType) ? item.propertyType.join(", ") : (item.propertyType || "Property");
     const countryText = Array.isArray(item.country) ? item.country.join(", ") : (item.country || "");
     return {
         _id: item._id,
         title: item.title || "No Title",
         propertyType: propertyTypeText,
         state: item.state || "State not specified",
         city: item.stateCity || item.location || "",
         country: countryText,
         propertyUrl: item['link-properties-1-title'] ?
             `https://www.sharon-homes.com${item['link-properties-1-title']}` :
             "N/A",
         dealType: Array.isArray(item.dealType) ? item.dealType.join(", ") : item.dealType || "N/A",
         investmentOpportunity: Array.isArray(item.investmentOpportunity) ? item.investmentOpportunity.join(", ") : item.investmentOpportunity || "N/A",
         price: item.price || "N/A",
         stateCity: item.stateCity || "N/A",
         description: item.description || "N/A",
         shortDescription: item.shortDescription || "N/A",
         developer1: item.developer1 || "N/A",
         delivery: item.delivery || "N/A",
         projectName: item.projectName || "N/A",
         plotArea: item.plotArea || "N/A",
         requestId: item.requestId || "N/A",
         address: item.address || "N/A",
         status: item.status || "N/A",
         zipCode: item.zipCode || "N/A",
         availableDate: item.availableDate || "N/A",
         email: item.email || "N/A",
         commission: item.commission || "N/A",
         minBedrooms: item.minBedrooms || "N/A",
         maxBedrooms: item.maxBedrooms || "N/A",
         bedroomRange: item.bedroomRange || "N/A",
         priceRange: item.priceRange || "N/A",
         minPrice: item.minPrice || "N/A",
         maxPrice: item.maxPrice || "N/A"
     };

 }

 function pack(items, totalCount, page, itemsPerPage) {
     return {
         success: true,
         data: items,
         totalCount,
         totalPages: Math.max(1, Math.ceil(totalCount / itemsPerPage)),
         currentPage: page
     };
 }

 // Backend function to send property assignment email
 export const sendPropertyAssignmentEmail = webMethod(
     Permissions.Anyone,
     async (emailData) => {
         try {
             const { name, email, propertyLinks } = emailData;

             const formattedLinks = propertyLinks
                 .split('\n')
                 .map(link => `• ${link}`)
                 .join('\n\n'); // double newlines for spacing

             const buyerEmailData = {
                 email,
                 name,
                 message: `Hey ${name},\n\nWe found some properties that will interest you and are closely matched to your request.\n\nHere are the links:\n\n${formattedLinks}\n\nBest regards,\nThe Property Match Team`
             };

             // Email template ID - you'll need to update this
             const propertyAssignmentEmailTemplateId = "Uzhn8ew"; // Update with your actual template ID

             // Send email using existing function
             await sendEmailToUser(buyerEmailData, propertyAssignmentEmailTemplateId);

             console.log("Property assignment email sent to:", email);
             return { success: true, message: "Email sent successfully" };

         } catch (error) {
             console.error("Error sending property assignment email:", error);
             return { success: false, error: error.message };
         }
     }
 );

 export const saveBuyRequest = webMethod(
     Permissions.Anyone,
     (requestData) => {
         return wixData.insert("BuyRequests", requestData, { suppressAuth: true })
             .then((result) => {
                 console.log("Buy request saved successfully:", result._id);
                 return { success: true, id: result._id };
             })
             .catch((error) => {
                 console.error("Error saving buy request:", error);
                 return { success: false, error: error.message };
             });
     }
 );

 export const getBuyRequests = webMethod(
     Permissions.Anyone,
     () => {
         return wixData.query("BuyRequests")
             .descending("_createdDate")
             .find({ suppressAuth: true })
             .then((results) => {
                 console.log("Found requests:", results.items.length);

                 // Format data for repeater
                 const formattedData = results.items.map(item => {
                     // Format property details: "House • 3-5 Rooms • 1,500+ sq ft"
                     let propertyDetails = item.property_type || "Property";

                     // Add rooms info
                     if (item.min_rooms || item.max_rooms) {
                         if (item.min_rooms && item.max_rooms) {
                             propertyDetails += ` • ${item.min_rooms}-${item.max_rooms} `;
                         } else if (item.min_rooms) {
                             propertyDetails += ` • ${item.min_rooms}`;
                         } else if (item.max_rooms) {
                             propertyDetails += ` • Up to ${item.max_rooms}`;
                         }
                     }

                     // Add area info
                     if (item.min_area) {
                         propertyDetails += ` • ${item.min_area.toLocaleString()}+ sq ft`;
                     }

                     // Format price range: "$400,000 - $800,000"
                     let priceRange = "";
                     if (item.min_price && item.max_price) {
                         priceRange = `$${item.min_price.toLocaleString()} - $${item.max_price.toLocaleString()}`;
                     } else if (item.min_price) {
                         priceRange = `$${item.min_price.toLocaleString()}+`;
                     } else if (item.max_price) {
                         priceRange = `Up to $${item.max_price.toLocaleString()}`;
                     }

                     return {
                         _id: item._id,
                         name: item.name || "Unknown",
                         propertyDetails: propertyDetails,
                         city: item.cities || "Not specified",
                         priceRange: priceRange,
                         status: item.status || "pending",
                         _createdDate: item._createdDate
                     };
                 });

                 return { success: true, data: formattedData };
             })
             .catch((error) => {
                 console.error("Error fetching buy requests:", error);
                 return { success: false, error: error.message };
             });
     }
 );

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

  // Update Buy Request Function
 export const updateBuyRequest = webMethod(
     Permissions.Anyone,
     async (requestId, updatedData) => {
         try {
             // Validate request ID
             if (!requestId) {
                 return {
                     success: false,
                     error: "Request ID is required"
                 };
             }

             // First, get the existing record to ensure it exists
             const existingItem = await wixData.get("BuyRequests", requestId, {
                 suppressAuth: true
             });

             if (!existingItem) {
                 return {
                     success: false,
                     error: "Request not found"
                 };
             }

             // Prepare the update object
             // This preserves all existing fields and only updates provided ones
             const itemToUpdate = {
                 ...existingItem, // Start with existing data
                 ...updatedData, // Override with new data
                 _id: requestId // Ensure ID is correct
             };

             // Clean up system fields that shouldn't be updated
             delete itemToUpdate._createdDate;
             delete itemToUpdate._updatedDate;
             delete itemToUpdate._owner;

             // These are computed fields for display in repeaters
             itemToUpdate.propertyDetails = formatPropertyDetails(itemToUpdate);
             itemToUpdate.city = itemToUpdate.cities || "";
             itemToUpdate.priceRange = formatPriceRange(itemToUpdate.min_price, itemToUpdate.max_price);

             // Perform the update
             const result = await wixData.update("BuyRequests", itemToUpdate, {
                 suppressAuth: true
             });

             console.log("Request updated successfully:", requestId);

             return {
                 success: true,
                 data: result,
                 id: result._id
             };

         } catch (error) {
             console.error("Error updating buy request:", error);
             return {
                 success: false,
                 error: error.message || "Failed to update request"
             };
         }
     }
 );

 export const approveRequest = webMethod(
     Permissions.Anyone,
     async (requestId) => {
         try {
             // Get the buy request
             const item = await wixData.get("BuyRequests", requestId, { suppressAuth: true });

             // Update status in main BuyRequests collection
             const updatedItem = await wixData.update("BuyRequests", {
                 ...item,
                 status: "Approved",
                 updated_at: new Date()
             }, { suppressAuth: true });

             // Update status in BuyRequestTranslations collection (all 3 language rows)
             try {
                 // Query all translation rows with matching buyRequestId
                 const translationResults = await wixData.query("BuyRequestTranslations")
                     .eq("buyRequestId", requestId)
                     .find({ suppressAuth: true });

                 console.log(`Found ${translationResults.items.length} translation rows for buyRequestId: ${requestId}`);

                 // Update each translation row
                 const updatePromises = translationResults.items.map(async (translationRow) => {
                     return await wixData.update("BuyRequestTranslations", {
                         ...translationRow,
                         status: "Approved",
                         updated_at: new Date()
                     }, { suppressAuth: true });
                 });

                 await Promise.all(updatePromises);
                 console.log(`Updated ${translationResults.items.length} translation rows to Approved status`);

             } catch (translationError) {
                 console.error("Error updating BuyRequestTranslations:", translationError);
                 // Continue even if translation update fails
             }

             console.log("Request approved:", requestId);
             return { success: true, message: "Request approved successfully" };

         } catch (error) {
             console.error("Error approving request:", error);
             return { success: false, error: error.message };
         }
     }
 );

 export const disapproveRequest = webMethod(
     Permissions.Anyone,
     async (requestId) => {
         try {
             // Get the buy request
             const item = await wixData.get("BuyRequests", requestId, { suppressAuth: true });

             // Update status in main BuyRequests collection
             const updatedItem = await wixData.update("BuyRequests", {
                 ...item,
                 status: "Rejected",
                 updated_at: new Date()
             }, { suppressAuth: true });

             // Update status in BuyRequestTranslations collection (all 3 language rows)
             try {
                 // Query all translation rows with matching buyRequestId
                 const translationResults = await wixData.query("BuyRequestTranslations")
                     .eq("buyRequestId", requestId)
                     .find({ suppressAuth: true });

                 console.log(`Found ${translationResults.items.length} translation rows for buyRequestId: ${requestId}`);

                 // Update each translation row
                 const updatePromises = translationResults.items.map(async (translationRow) => {
                     return await wixData.update("BuyRequestTranslations", {
                         ...translationRow,
                         status: "Rejected",
                         updated_at: new Date()
                     }, { suppressAuth: true });
                 });

                 await Promise.all(updatePromises);
                 console.log(`Updated ${translationResults.items.length} translation rows to Rejected status`);

             } catch (translationError) {
                 console.error("Error updating BuyRequestTranslations:", translationError);
                 // Continue even if translation update fails
             }

             console.log("Request disapproved:", requestId);
             return { success: true, message: "Request disapproved successfully" };

         } catch (error) {
             console.error("Error disapproving request:", error);
             return { success: false, error: error.message };
         }
     }
 );

 export const getApprovedRequests = webMethod(
     Permissions.Anyone,
     () => {
         return wixData.query("BuyRequests")
             .eq("status", "Approved")
             .descending("_createdDate")
             .find({ suppressAuth: true })
             .then((results) => {
                 console.log("Found approved requests:", results.items.length);

                 // Format data for repeater
                 const formattedData = results.items.map(item => {
                     // Format property details: "House • 3-5 Rooms • 1,500+ sq ft"
                     let propertyDetails = item.property_type || "Property";

                     // Add rooms info
                     if (item.min_rooms || item.max_rooms) {
                         if (item.min_rooms && item.max_rooms) {
                             propertyDetails += ` • ${item.min_rooms}-${item.max_rooms} `;
                         } else if (item.min_rooms) {
                             propertyDetails += ` • ${item.min_rooms}`;
                         } else if (item.max_rooms) {
                             propertyDetails += ` • Up to ${item.max_rooms} `;
                         }
                     }

                     // Add area info
                     if (item.min_area) {
                         propertyDetails += ` • ${item.min_area.toLocaleString()}+ sq ft`;
                     }

                     // Format price range: "$400,000 - $800,000"
                     let priceRange = "";
                     if (item.min_price && item.max_price) {
                         priceRange = `$${item.min_price.toLocaleString()} - $${item.max_price.toLocaleString()}`;
                     } else if (item.min_price) {
                         priceRange = `$${item.min_price.toLocaleString()}+`;
                     } else if (item.max_price) {
                         priceRange = `Up to $${item.max_price.toLocaleString()}`;
                     }

                     // Format rooms separately for individual display
                     let roomsText = "";
                     if (item.min_rooms && item.max_rooms) {
                         roomsText = `${item.min_rooms} - ${item.max_rooms}`;
                     } else if (item.min_rooms) {
                         roomsText = `${item.min_rooms}+`;
                     } else if (item.max_rooms) {
                         roomsText = `Up to ${item.max_rooms}`;
                     } else {
                         roomsText = "Any";
                     }

                     return {
                         _id: item._id,
                         name: item.name || "Unknown",
                         propertyDetails: propertyDetails,
                         city: item.cities || "Not specified",
                         priceRange: priceRange,
                         status: "Approved",
                         _createdDate: item._createdDate,
                         // Individual fields for detailed view
                         property_type: item.property_type || "Not specified",
                         roomsText: roomsText,
                         min_area: item.min_area ? `${item.min_area.toLocaleString()} sq ft` : "Not specified",
                         comments: item.comments || "No comments",
                         neighbourhood: item.neighbourhood || "Not specified"
                     };
                 });

                 return { success: true, data: formattedData };
             })
             .catch((error) => {
                 console.error("Error fetching approved requests:", error);
                 return { success: false, error: error.message };
             });
     }
 );

 export const savePropertyOffer = webMethod(
     Permissions.Anyone,
     async (offerData) => {
         try {
             // First, save to PropertyOffers collection (original)
             const offerResult = await wixData.insert("PropertyOffers", offerData, { suppressAuth: true });
             console.log("Property offer saved to PropertyOffers:", offerResult._id);

             // Helper function to convert URLs to Wix gallery format
             const formatGalleryImages = (imageUrls) => {
                 if (!imageUrls || !Array.isArray(imageUrls)) return [];

                 return imageUrls.map((url, index) => ({
                     type: 'image',
                     src: url,
                     title: `Property Image ${index + 1}`,
                     description: '',
                     // For Wix gallery field, use this format:
                     image: {
                         imageInfo: url
                     }
                 }));
             };

             // Helper function to convert to tag array
             const toTagArray = (value) => {
                 if (!value) return [];
                 if (Array.isArray(value)) return value;
                 if (typeof value === 'string' && value.includes(',')) {
                     return value.split(',').map(tag => tag.trim()).filter(tag => tag);
                 }
                 return [value];
             };

             // Helper function to format price range for display
             const formatPriceRange = (minPrice, maxPrice) => {
                 if (minPrice && maxPrice) {
                     if (minPrice === maxPrice) {
                         return `€${minPrice.toLocaleString()}`;
                     } else {
                         return `€${minPrice.toLocaleString()} - €${maxPrice.toLocaleString()}`;
                     }
                 } else if (minPrice) {
                     return `Starting from €${minPrice.toLocaleString()}`;
                 } else if (maxPrice) {
                     return `Up to €${maxPrice.toLocaleString()}`;
                 }
                 return "Price on request";
             };

             // Prepare data for Properties collection
             const propertyData = {
                 // Text fields
                 title: offerData.property_title,
                 stateCity: offerData.city,
                 location: offerData.city,
                 state: offerData.state,
                 address: offerData.address, //address field object
                 zipCode: offerData.zip_code,

                 // Tag fields - convert to arrays
                 country: toTagArray(offerData.country),
                 propertyType: toTagArray(offerData.property_type),
                 dealType: toTagArray(offerData.deal_type),
                 investmentOpportunity: toTagArray(offerData.investment_opportunity),

                 // Price fields - NEW structure with min/max
                 minPrice: offerData.min_price || 0,
                 maxPrice: offerData.max_price || 0,
                 price: formatPriceRange(offerData.min_price, offerData.max_price), // Display string
                 priceRange: `${offerData.min_price}-${offerData.max_price}`, // Simple range string

                 commission: `${offerData.commission}%`,

                 // Bedroom fields
                 minBedrooms: offerData.min_bedrooms,
                 maxBedrooms: offerData.max_bedrooms,
                 bedroomRange: `${offerData.min_bedrooms}-${offerData.max_bedrooms}`,

                 plotArea: offerData.plot_area,

                 // Gallery - format properly for Wix
                 gallery: formatGalleryImages(offerData.gallery),

                 // Text fields
                 shortDescription: offerData.short_description,
                 description: offerData.description,

                 // Developer info
                 developer1: offerData.developer_name,
                 projectName: offerData.project_name,
                 availableDate: offerData.available_date,
                 delivery: offerData.delivery_time,
                 email: offerData.email,

                 // Additional fields
                 agreement: offerData.agreement,
                 status: offerData.status || 'Pending',
                 requestId: offerData.request_id,
                 createdAt: new Date(),
                 updatedAt: new Date()
             };

             // Save to Properties collection
             const propertyResult = await wixData.insert("Properties", propertyData, { suppressAuth: true });
             console.log("Property saved to Properties:", propertyResult._id);

             return {
                 success: true,
                 offerId: offerResult._id,
                 propertyId: propertyResult._id
             };

         } catch (error) {
             console.error("Error saving property data:", error);
             return { success: false, error: error.message };
         }
     }
 );

 export const updatePropertyOffer = webMethod(
     Permissions.Anyone,
     async (offerId, updatedData) => {
         try {
             // Validate offer ID
             if (!offerId) {
                 return {
                     success: false,
                     error: "Offer ID is required"
                 };
             }

             // Get existing record
             const existingItem = await wixData.get("PropertyOffers", offerId, {
                 suppressAuth: true
             });

             if (!existingItem) {
                 return {
                     success: false,
                     error: "Offer not found"
                 };
             }

             // Prepare update object
             const itemToUpdate = {
                 ...existingItem,
                 ...updatedData,
                 _id: offerId
             };

             // Clean up system fields
             delete itemToUpdate._createdDate;
             delete itemToUpdate._updatedDate;
             delete itemToUpdate._owner;

             // Format display fields
             itemToUpdate.propertyDetails = `${itemToUpdate.property_type || ''} - ${itemToUpdate.bathrooms || ''} bathrooms`;
             itemToUpdate.location = `${itemToUpdate.city || ''}, ${itemToUpdate.state || ''}`;
             itemToUpdate.price = itemToUpdate.price ? `${Number(itemToUpdate.price).toLocaleString()}` : "";

             // Update the record
             const result = await wixData.update("PropertyOffers", itemToUpdate, {
                 suppressAuth: true
             });

             console.log("Offer updated successfully:", offerId);

             return {
                 success: true,
                 data: result,
                 id: result._id
             };

         } catch (error) {
             console.error("Error updating offer:", error);
             return {
                 success: false,
                 error: error.message || "Failed to update offer"
             };
         }
     }
 );


 // Helper function to format property details for display
 function formatPropertyDetails(data) {
     let details = [];

     if (data.property_type) {
         details.push(data.property_type);
     }

     if (data.min_rooms || data.max_rooms) {
         let rooms = "";
         if (data.min_rooms && data.max_rooms) {
             rooms = `${data.min_rooms}-${data.max_rooms} rooms`;
         } else if (data.min_rooms) {
             rooms = `${data.min_rooms}+ rooms`;
         } else if (data.max_rooms) {
             rooms = `Up to ${data.max_rooms} rooms`;
         }
         details.push(rooms);
     }

     if (data.min_area) {
         details.push(`${data.min_area} sq ft min`);
     }

     return details.join(", ");
 }

 // Helper function to format price range for display
 function formatPriceRange(minPrice, maxPrice) {
     if (!minPrice && !maxPrice) {
         return "Price not specified";
     }

     const min = minPrice ? `$${Number(minPrice).toLocaleString()}` : "";
     const max = maxPrice ? `$${Number(maxPrice).toLocaleString()}` : "";

     if (min && max) {
         return `${min} - ${max}`;
     } else if (min) {
         return `${min}+`;
     } else {
         return `Up to ${max}`;
     }
 }

 // Optional: Batch update function for multiple records
 export const batchUpdateBuyRequests = webMethod(
     Permissions.Anyone,
     async (updates) => {
         try {
             const results = [];
             const errors = [];

             for (const update of updates) {
                 try {
                     const result = await updateBuyRequest(update.id, update.data);
                     if (result.success) {
                         results.push(result);
                     } else {
                         errors.push({
                             id: update.id,
                             error: result.error
                         });
                     }
                 } catch (error) {
                     errors.push({
                         id: update.id,
                         error: error.message
                     });
                 }
             }

             return {
                 success: errors.length === 0,
                 updated: results.length,
                 results: results,
                 errors: errors
             };

         } catch (error) {
             console.error("Batch update error:", error);
             return {
                 success: false,
                 error: error.message
             };
         }
     }
 );

 export const getBuyerDataById = webMethod(
     Permissions.Anyone,
     (requestId) => {
         return wixData.get("BuyRequests", requestId, { suppressAuth: true })
             .then((result) => {
                 console.log("Found buyer data for request:", requestId);
                 return {
                     success: true,
                     data: {
                         _id: result._id,
                         name: result.name,
                         email: result.email,
                         phone: result.phone,
                         cities: result.cities,
                         property_type: result.property_type,
                         min_price: result.min_price,
                         max_price: result.max_price,
                         created_at: result._createdDate
                     }
                 };
             })
             .catch((error) => {
                 console.error("Error fetching buyer data:", error);
                 return { success: false, error: error.message };
             });
     }
 );

 // Get offer data by offer ID  
 export const getOfferDataById = webMethod(
     Permissions.Anyone,
     (offerId) => {
         return wixData.get("PropertyOffers", offerId, { suppressAuth: true })
             .then((result) => {
                 console.log("Found offer data for offer:", offerId);
                 return {
                     success: true,
                     data: {
                         _id: result._id,
                         request_id: result.request_id,
                         name: result.name,
                         email: result.email,
                         property_type: result.property_type,
                         price: result.price,
                         city: result.city,
                         state: result.state,
                         street_address: result.street_address,
                         area: result.area,
                         comments: result.comments,
                         created_at: result._createdDate
                     }
                 };
             })
             .catch((error) => {
                 console.error("Error fetching offer data:", error);
                 return { success: false, error: error.message };
             });
     }
 );

 // Get both buyer and offer data in one call
 export const getBuyerAndOfferData = webMethod(
     Permissions.Anyone,
     async (offerId) => {
         try {
             // Get offer data first
             const offerResult = await wixData.get("PropertyOffers", offerId, { suppressAuth: true });

             // Get buyer data using request_id from offer
             const buyerResult = await wixData.get("BuyRequests", offerResult.request_id, { suppressAuth: true });

             return {
                 success: true,
                 data: {
                     buyer: {
                         _id: buyerResult._id,
                         name: buyerResult.name,
                         email: buyerResult.email,
                         phone: buyerResult.phone,
                         cities: buyerResult.cities,
                         property_type: buyerResult.property_type,
                         budget: `$${buyerResult.min_price.toLocaleString()} - $${buyerResult.max_price.toLocaleString()}`
                     },
                     offer: {
                         _id: offerResult._id,
                         name: offerResult.name,
                         email: offerResult.email,
                         property_type: offerResult.property_type,
                         price: `$${offerResult.price.toLocaleString()}`,
                         location: `${offerResult.city}, ${offerResult.state}`,
                         address: offerResult.street_address,
                         area: `${offerResult.area.toLocaleString()} sq ft`,
                         comments: offerResult.comments
                     }
                 }
             };
         } catch (error) {
             console.error("Error fetching buyer and offer data:", error);
             return { success: false, error: error.message };
         }
     }
 );