import wixLocation from 'wix-location';
import wixWindow from 'wix-window';
import wixSeoFrontend from 'wix-seo-frontend';
import { buildPropertySeo, withAltText } from 'public/propertySeo.js';
import { getPropertyByIdAndLanguage, getPropertiesByLanguage } from 'backend/property-language-backend.web.js';

let currentLanguage = 'en';
let currentPropertyData = null;

// ── Translations ─────────────────────────────────────────
const T = {
    en: {
        yes: 'Yes',
        no: 'No',
        na: 'N/A',
        closeToSea: 'Close to Sea',
        plotArea: 'Plot Area',
        status: 'Status',
        delivery: 'Delivery'
    },
    de: {
        yes: 'Ja',
        no: 'Nein',
        na: 'N/V',
        closeToSea: 'Meeresnähe',
        plotArea: 'Grundstücksfläche',
        status: 'Status',
        delivery: 'Lieferung'
    },
    he: {
        yes: 'כן',
        no: 'לא',
        na: 'לא זמין',
        closeToSea: 'קרוב לים',
        plotArea: 'שטח מגרש',
        status: 'סטטוס',
        delivery: 'אספקה'
    }
};

$w.onReady(async function () {
    currentLanguage = wixWindow.multilingual.currentLanguage;
    console.log('🏠 [DETAIL] language:', currentLanguage);

    if ($w('#loadingSection')) $w('#loadingSection').expand();
    collapseAll();

    try {
        await loadTranslatedContent();
        await populateRelatedProperties();

        if ($w('#loadingSection')) $w('#loadingSection').collapse();
        expandActive();
    } catch (error) {
        console.error('❌ [DETAIL] page load error:', error);
    }
});

// ── Section helpers ───────────────────────────────────────
function isRTL() { return currentLanguage === 'he'; }

function collapseAll() {
    ['#detailSection1', '#detailSection2', '#detailSection1RTL', '#detailSection2RTL']
    .forEach(id => { try { $w(id).collapse(); } catch (e) {} });
}

function expandActive() {
    if (isRTL()) {
        $w('#detailSection1RTL').expand();
        $w('#detailSection2RTL').expand();
    } else {
        $w('#detailSection1').expand();
        $w('#detailSection2').expand();
    }
}

// ── Load translated property content ─────────────────────
async function loadTranslatedContent() {
    const query = wixLocation.query;
    const propertyId = query.propertyId || $w('#dynamicDataset').getCurrentItem()?.propertyId;
    if (!propertyId) throw new Error('No propertyId found');

    console.log('🔄 [DETAIL] loading:', propertyId, 'lang:', currentLanguage);

    const result = await getPropertyByIdAndLanguage(propertyId, currentLanguage);
    if (!result.success) {
        // The item no longer exists: keep it out of search (no redirect).
        if (result.error === 'Property not found') await setNoindex();
        throw new Error(result.error);
    }

    const d = result.data;
    currentPropertyData = d;
    if (result.fallback) console.log('⚠️ [DETAIL] English fallback used');

    await applySeo(d);

    populateDetail(d, '');
    populateDetail(d, 'RTL');
}

// ── SEO: title, description, Open Graph, schema ─────────
// Built from the listing data (public/propertySeo.js). Runs inside onReady so
// search engines get it in the server-rendered HTML. URLs are not changed.
// Sold or removed listings get noindex instead of a redirect.
async function applySeo(d) {
    try {
        const active = (d.parentStatus || d.status) === 'Approved';
        const url = wixLocation.url.split(/[?#]/)[0];
        const seo = buildPropertySeo(d, d.language || currentLanguage, { url, active });
        await Promise.all([
            wixSeoFrontend.setTitle(seo.title),
            wixSeoFrontend.setMetaTags(seo.metaTags),
            wixSeoFrontend.setStructuredData(seo.structuredData)
        ]);
    } catch (e) {
        console.warn('⚠️ [DETAIL] SEO tags not set:', e.message);
    }
}

async function setNoindex() {
    try { await wixSeoFrontend.setMetaTags([{ name: 'robots', content: 'noindex' }]); } catch (e) {}
}

function populateDetail(d, suffix) {
    const s = suffix;
    const t = T[currentLanguage] || T.en;
    const el = id => { try { return $w(`#${id}${s}`); } catch (e) { return null; } };

    const set = (id, val) => { const e = el(id); if (e) e.text = val; };

    set('pTitle', d.title || '');
    set('description', d.description || '');
    set('country', d.country?.join(', ') || '');
    set('stateCity', d.stateCity || '');
    set('propertyType', d.propertyType?.join(', ') || '');
    set('deal', d.dealType?.join(', ') || '');
    set('seaViewText', d.seaView ? t.yes : t.no);

    if (el('gallery') && d.gallery?.length > 0)
        el('gallery').items = withAltText(d.gallery, d, d.language || currentLanguage);

    if (el('priceRange')) {
        const min = fmtPrice(d.minPrice);
        const max = fmtPrice(d.maxPrice);
        const samePrice = d.minPrice && d.maxPrice && d.minPrice === d.maxPrice;
        set('priceRange', samePrice ?
            min :
            (min && max ? `${min} - ${max}` : min || max || ''));
    }

    if (el('bedrooms')) {
        const mn = d.minBedrooms,
            mx = d.maxBedrooms;
        if (mn && mx) set('bedrooms', mn === mx ? `${mn}` : `${mn} - ${mx}`);
        else if (mn) set('bedrooms', `${mn}+`);
        else if (mx) set('bedrooms', `Up to ${mx}`);
    }

    // ── otherInfo1Rep — Close to Sea + Plot Area ──────────
    const info1 = [{
            _id: 'closeToSea',
            key: t.closeToSea,
            value: d.closeToSea ? t.yes : t.no
        },
        {
            _id: 'plotArea',
            key: t.plotArea,
            value: d.plotArea && d.plotArea > 0 ? `${d.plotArea} m²` : t.na
        }
    ];

    // ── otherInfo2Rep — Status + Delivery ─────────────────
    const info2 = [{
            _id: 'status',
            key: t.status,
            value: d.propertyStatus || t.na
        },
        {
            _id: 'delivery',
            key: t.delivery,
            value: d.delivery || t.na
        }
    ];

    setupInfoRepeater(`#otherInfo1Rep${s}`, info1, '1', s);
    setupInfoRepeater(`#otherInfo2Rep${s}`, info2, '2', s);
}

function setupInfoRepeater(repeaterId, data, num, suffix) {
    try {
        const repeater = $w(repeaterId);
        const s = suffix;

        repeater.onItemReady(($item, itemData) => {
            try { $item(`#repKey${num}${s}`).text = itemData.key; } catch (e) {}
            try { $item(`#repValue${num}${s}`).text = itemData.value; } catch (e) {}
        });

        repeater.data = data;
    } catch (e) {
        console.warn(`⚠️ [DETAIL] setupInfoRepeater failed for ${repeaterId}:`, e.message);
    }
}

// ── Related properties ────────────────────────────────────
async function populateRelatedProperties() {
    if (!currentPropertyData) return;

    const { propertyId, stateCity, country } = currentPropertyData;

    const result = await getPropertiesByLanguage(currentLanguage);
    if (!result.success) { console.error('Related load failed:', result.error); return; }

    const related = result.data.filter(item => {
        if (item.propertyId === propertyId) return false;
        if (stateCity && item.stateCity === stateCity) return true;
        if (country?.length > 0 && item.country)
            return country.some(c => item.country.includes(c));
        return false;
    }).slice(0, 2);

    console.log(`🔗 [DETAIL] ${related.length} related properties`);

    setupRelatedRepeater('#r1', related, '');
    setupRelatedRepeater('#r1RTL', related, 'RTL');
}

function setupRelatedRepeater(repeaterId, data, suffix) {
    try {
        const repeater = $w(repeaterId);
        const s = suffix;

        if (data.length === 0) { repeater.collapse(); return; }

        repeater.onItemReady(($item, itemData) => {
            try { $item(`#image${s}`).src = itemData.gallery?.[0]?.src || ''; } catch (e) {}
            try { $item(`#image${s}`).alt = itemData.title || ''; } catch (e) {}
            try { $item(`#title${s}`).text = itemData.title || ''; } catch (e) {}

            if ($item(`#price${s}`)) {
                const min = fmtPrice(itemData.minPrice);
                const max = fmtPrice(itemData.maxPrice);
                try {
                    $item(`#price${s}`).text = itemData.minPrice === itemData.maxPrice ?
                        min :
                        (min && max ? `${min} - ${max}` : min || max || 'Contact for price');
                } catch (e) {}
            }

            try {
               $item(`#itemContainer${s}`).onClick(() => {
    wixLocation.to(
        itemData['link-property-translations-1-propertyId'] ||  // CHANGED
        `/property-details?propertyId=${itemData.propertyId}`
    );
});
            } catch (e) {}
        });

        repeater.data = data;
        repeater.expand();
    } catch (e) {
        console.warn(`⚠️ [DETAIL] setupRelatedRepeater failed for ${repeaterId}:`, e.message);
    }
}

// ── Format helpers ────────────────────────────────────────
// function fmtPrice(price) {
//     if (!price) return '';
//     if (price >= 1000000) return `€${(price / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
//     if (price >= 1000) return `€${(price / 1000).toFixed(0)}K`;
//     return `€${price}`;
// }
function fmtPrice(price) {
    if (!price) return '';
    return `€${price.toLocaleString('en-US')}`;
}