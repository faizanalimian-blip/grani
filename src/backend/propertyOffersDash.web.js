// ============================================================
//  backend/propertyOffersDash.web.js
//  Sharon Homes — Property Offers Dashboard backend module
//
//  All approve/reject email logic stays in post.web.js.
//  All translation/edit logic stays in optimisedTranslateUpdate.web.js.
//  This file is a focused façade for the dashboard page.
// ============================================================

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { mediaManager } from 'wix-media-backend';
import {
    approvePropertyOffer,
    disapprovePropertyOffer
} from 'backend/post.web.js';
import { updatePropertyWithTranslations } from 'backend/optimisedTranslateUpdate.web.js';

// isoCode → display name (matches allowedCountryCodes in csc.web.js)
const COUNTRY_NAMES = { CY: 'Cyprus', GR: 'Greece', IL: 'Israel' };

// ── 1. List all properties for the dashboard table ────────────

export const getPropertiesForDashboard = webMethod(
    Permissions.Anyone,
    async () => {
        try {
            const results = await wixData
                .query('Properties')
                .descending('_createdDate')
                .limit(1000)
                .find({ suppressAuth: true });

            const data = results.items.map((item, index) => {
                const countryRaw = Array.isArray(item.country)
                    ? (item.country[0] || '')
                    : (item.country || '');

                return {
                    id:             item._id,
                    num:            index + 1,
                    propertyName:   item.title || 'Untitled',
                    propertyType:   Array.isArray(item.propertyType)
                                        ? (item.propertyType[0] || '')
                                        : (item.propertyType || ''),
                    bedrooms:       item.minBedrooms || item.maxBedrooms || 0,
                    city:           item.stateCity || '',
                    country:        COUNTRY_NAMES[countryRaw] || countryRaw,
                    minPrice:       item.minPrice  || null,
                    maxPrice:       item.maxPrice  || null,
                    status:         (item.status   || 'Pending').toLowerCase(),
                    date:           item._createdDate || null,
                    offerRequestId: item._id,
                    requestId:      item.requestId || '',
                    rooms:          item.minBedrooms || 0,
                    minArea:        item.plotArea  || null,
                    description:    item.shortDescription || item.description || ''
                };
            });

            console.log('[propertyOffersDash] getPropertiesForDashboard:', data.length, 'items');
            return { success: true, data };
        } catch (error) {
            console.error('[propertyOffersDash] getPropertiesForDashboard:', error);
            return { success: false, error: error.message };
        }
    }
);

// ── 2. Fetch a single raw Properties record for the edit form ──

export const getOfferForEdit = webMethod(
    Permissions.Anyone,
    async (offerId) => {
        try {
            const item = await wixData.get('Properties', offerId, { suppressAuth: true });
            console.log('[propertyOffersDash] getOfferForEdit:', offerId);
            return { success: true, data: item };
        } catch (error) {
            console.error('[propertyOffersDash] getOfferForEdit:', error);
            return { success: false, error: error.message };
        }
    }
);

// ── 3. Approve an offer (delegates to post.web.js — sends emails) ─

export const approveOffer = webMethod(
    Permissions.Anyone,
    async (offerId) => {
        try {
            return await approvePropertyOffer(offerId);
        } catch (error) {
            console.error('[propertyOffersDash] approveOffer:', error);
            return { success: false, error: error.message };
        }
    }
);

// ── 4. Reject an offer (delegates to post.web.js) ─────────────

export const rejectOffer = webMethod(
    Permissions.Anyone,
    async (offerId) => {
        try {
            return await disapprovePropertyOffer(offerId);
        } catch (error) {
            console.error('[propertyOffersDash] rejectOffer:', error);
            return { success: false, error: error.message };
        }
    }
);

// ── 5. Get Wix Media upload URLs (for gallery uploads from the CE) ──
//
//  CE passes file metadata → backend returns signed upload URLs →
//  CE uploads files directly to those URLs → gets back wix:image:// URLs.

export const getMediaUploadUrls = webMethod(
    Permissions.Anyone,
    async (files) => {
        // files: [{id: string, name: string, type: string}]
        try {
            const urls = await Promise.all(
                files.map(async (f) => {
                    const { uploadUrl } = await mediaManager.getUploadUrl(
                        '/Sharon Homes/Property Gallery',
                        {
                            mediaOptions:   { mimeType: f.type, mediaType: 'image' },
                            metadataOptions: { isPrivate: false, isVisitorUpload: false }
                        }
                    );
                    return { id: f.id, fileName: f.name, uploadUrl };
                })
            );
            console.log('[propertyOffersDash] getMediaUploadUrls:', urls.length, 'URLs generated');
            return { success: true, urls };
        } catch (err) {
            console.error('[propertyOffersDash] getMediaUploadUrls:', err);
            return { success: false, error: err.message };
        }
    }
);

// ── 6. Save edits (delegates to optimisedTranslateUpdate.web.js) ─

export const saveOfferEdits = webMethod(
    Permissions.Anyone,
    async (offerId, formData, language) => {
        try {
            console.log('[propertyOffersDash] saveOfferEdits — id:', offerId, '| lang:', language, '| keys:', Object.keys(formData || {}));
            return await updatePropertyWithTranslations(offerId, formData, language);
        } catch (error) {
            console.error('[propertyOffersDash] saveOfferEdits:', error);
            return { success: false, error: error.message };
        }
    }
);