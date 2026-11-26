// ============================================================
//  PAGE CODE  —  Property Offers Dashboard page
//  Paste into the Velo Page Code panel.
//
//  Prerequisites:
//    • Custom element <property-offers-dashboard> on the page
//    • Update ELEMENT_ID below to match your element's ID
//    • backend/propertyOffersDash.web.js exists
//    • backend/csc.web.js exists
// ============================================================

import {
    getPropertiesForDashboard,
    getOfferForEdit,
    approveOffer,
    rejectOffer,
    saveOfferEdits,
    getMediaUploadUrls
} from 'backend/propertyOffersDash.web.js';

import {
    getCountries,
    getstatesByCountryCode,
    getCitiesOfState
} from 'backend/csc.web.js';

import wixWindowFrontend from 'wix-window-frontend';

// ── UPDATE this to match your element's ID in the Wix Editor ──
const ELEMENT_ID = '#propertyOffersDashboard';
// ─────────────────────────────────────────────────────────────
console.log(9897332987234);
const ce = () => $w(ELEMENT_ID);

$w.onReady(async function () {

    console.log('[POD page] onReady fired');

    // ── Pass session context ──────────────────────────────────
    // TODO: replace with real member lookup via wix-members
    ce().setAttribute('username', 'Granit');
    ce().setAttribute('initials', 'G');

    // ── Load initial offers ───────────────────────────────────
    try {
        console.log('[POD page] loading offers...');
        const result = await getPropertiesForDashboard();
        if (result.success) {
            console.log('[POD page] offers loaded:', result.data.length);
            ce().setAttribute('offers', JSON.stringify(result.data));
        } else {
            console.error('[POD page] getPropertiesForDashboard failed:', result.error);
        }
    } catch (e) {
        console.error('[POD page] Exception loading offers:', e);
    }

    // ── Approve / Reject ──────────────────────────────────────
    ce().on('statusChange', async (event) => {
        const { id, status } = event.detail;
        console.log('[POD page] statusChange:', id, '→', status);
        try {
            if (status === 'approved') {
                await approveOffer(id);
            } else if (status === 'rejected') {
                await rejectOffer(id);
            }
        } catch (err) {
            console.error('[POD page] statusChange error:', err);
        }
    });

    // ── Edit offer: fetch raw record + pre-load cascade data ──
    ce().on('editOffer', async (event) => {
        const { id } = event.detail;
        console.log('[POD page] editOffer:', id);
        try {
            const [offerResult, countries] = await Promise.all([
                getOfferForEdit(id),
                getCountries()
            ]);

            if (!offerResult.success) {
                console.error('[POD page] getOfferForEdit failed:', offerResult.error);
                return;
            }

            const property = offerResult.data;

            // Resolve stored country value (ISO code or full name) to isoCode
            const countryRaw = Array.isArray(property.country)
                ? (property.country[0] || '')
                : (property.country || '');
            const matchedCountry = countries.find(c =>
                c.isoCode === countryRaw ||
                c.name.toLowerCase() === countryRaw.toLowerCase()
            );
            const countryCode = matchedCountry?.isoCode || null;
            console.log('[POD page] country resolved:', countryRaw, '→', countryCode);

            // Pre-load states and cities so edit modal opens fully populated
            let states = [], cities = [];
            if (countryCode) {
                states = await getstatesByCountryCode(countryCode).catch(() => []);
                console.log('[POD page] states loaded:', states.length);

                if (property.state && states.length) {
                    const stateMatch = states.find(s =>
                        s.isoCode === property.state ||
                        s.name.toLowerCase() === (property.state || '').toLowerCase()
                    );
                    const stateCode = stateMatch?.isoCode || property.state;
                    cities = await getCitiesOfState(countryCode, stateCode).catch(() => []);
                    console.log('[POD page] cities loaded:', cities.length);
                }
            }

            ce().setAttribute('editdata', JSON.stringify({
                property,
                countries,
                states,
                cities
            }));

        } catch (err) {
            console.error('[POD page] editOffer error:', err);
        }
    });

    // ── Cascade: country changed → return states ──────────────
    ce().on('fetchStates', async (event) => {
        const { countryCode } = event.detail;
        console.log('[POD page] fetchStates:', countryCode);
        try {
            const states = await getstatesByCountryCode(countryCode);
            console.log('[POD page] states fetched:', states?.length);
            ce().setAttribute('states', JSON.stringify(states || []));
        } catch (err) {
            console.error('[POD page] fetchStates error:', err);
            ce().setAttribute('states', '[]');
        }
    });

    // ── Cascade: state changed → return cities ────────────────
    ce().on('fetchCities', async (event) => {
        const { countryCode, stateCode } = event.detail;
        console.log('[POD page] fetchCities:', countryCode, stateCode);
        try {
            const cities = await getCitiesOfState(countryCode, stateCode);
            console.log('[POD page] cities fetched:', cities?.length);
            ce().setAttribute('cities', JSON.stringify(cities || []));
        } catch (err) {
            console.error('[POD page] fetchCities error:', err);
            ce().setAttribute('cities', '[]');
        }
    });

    // ── Gallery: provide Wix Media upload URLs to the CE ────────
    //  CE uploads files directly to these URLs (no file data crosses
    //  Wix's event bus — only metadata goes out, URLs come back).
    ce().on('requestUploadUrls', async (event) => {
        const { files } = event.detail;
        console.log('[POD page] requestUploadUrls for', files?.length, 'files');
        try {
            const result = await getMediaUploadUrls(files);
            console.log('[POD page] upload URLs ready:', result.success, result.urls?.length);
            ce().setAttribute('uploadurls', JSON.stringify(result));
        } catch (err) {
            console.error('[POD page] requestUploadUrls error:', err);
            ce().setAttribute('uploadurls', JSON.stringify({ success: false, error: err.message }));
        }
    });

    // ── Save edits ────────────────────────────────────────────
    ce().on('saveOffer', async (event) => {
        const { id, formData } = event.detail;
        console.log('[POD page] saveOffer — id:', id, '| keys:', Object.keys(formData || {}));
        const lang = wixWindowFrontend.multilingual.currentLanguage || 'en';
        try {
            const result = await saveOfferEdits(id, formData, lang);
            console.log('[POD page] saveOfferEdits result:', result.success, result.error || '');

            // Always set saveresult so the element can react
            ce().setAttribute('saveresult', JSON.stringify(result));

            // On success: refresh the table so changes reflect immediately
            if (result.success) {
                const refreshed = await getPropertiesForDashboard();
                if (refreshed.success) {
                    console.log('[POD page] refreshed', refreshed.data.length, 'offers after save');
                    ce().setAttribute('offers', JSON.stringify(refreshed.data));
                }
            }
        } catch (err) {
            console.error('[POD page] saveOffer error:', err);
            ce().setAttribute('saveresult', JSON.stringify({
                success: false,
                error: err.message || 'Unexpected error'
            }));
        }
    });

});