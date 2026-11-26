// ─────────────────────────────────────────────────────────────────────────────
// Property page SEO: title, meta description, Open Graph, image alt text and
// JSON-LD for one listing, built from its PropertyTranslations row.
//
// Pure functions, no Wix imports, so the output can be tested outside Wix.
// The property pages apply the result with wix-seo-frontend.
// URLs are not changed here.
// ─────────────────────────────────────────────────────────────────────────────

export const BRAND = 'Sharon Homes';
export const SITE_URL = 'https://www.sharon-homes.com';
const TITLE_MAX = 60;
const DESC_MAX = 155;

const COUNTRY = {
    en: { Cyprus: 'Cyprus', Greece: 'Greece', Israel: 'Israel' },
    de: { Cyprus: 'Zypern', Greece: 'Griechenland', Israel: 'Israel' }
};
const COUNTRY_ISO = { Cyprus: 'CY', Greece: 'GR', Israel: 'IL' };

// Feed types are free text. Unknown types fall back to the original word.
const TYPE_DE = {
    'villa': 'Villa', 'apartment': 'Wohnung', 'flat': 'Wohnung', 'penthouse': 'Penthouse',
    'studio': 'Studio', 'maisonette': 'Maisonette', 'house': 'Haus', 'detached house': 'Einfamilienhaus',
    'semi-detached house': 'Doppelhaushälfte', 'townhouse': 'Reihenhaus', 'bungalow': 'Bungalow',
    'plot': 'Grundstück', 'land': 'Grundstück', 'shop': 'Ladenlokal', 'office': 'Büro',
    'office building': 'Bürogebäude', 'hotel': 'Hotel', 'building': 'Gebäude', 'commercial': 'Gewerbeimmobilie'
};
const RESIDENTIAL_HOUSE = ['villa', 'house', 'detached house', 'semi-detached house', 'townhouse', 'bungalow'];
const RESIDENTIAL_FLAT = ['apartment', 'flat', 'penthouse', 'studio', 'maisonette'];

const first = (v) => Array.isArray(v) ? (v[0] || '') : (v || '');
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** Cut at a word boundary so the result is at most `max` characters. */
export function fit(text, max) {
    const t = clean(text);
    if (t.length <= max) return t;
    const cut = t.slice(0, max - 1);
    const sp = cut.lastIndexOf(' ');
    return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.–-]+$/, '') + '…';
}

function groupDigits(n, lang) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'de' ? '.' : ',');
}

export function formatPrice(n, lang) {
    if (!n || n <= 0) return '';
    const num = Math.round(n);
    if (lang === 'de') return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €';
    return '€' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** wix:image://v1/<id>/<name>#... -> https://static.wixstatic.com/media/<id> */
export function imageUrl(src) {
    if (!src || typeof src !== 'string') return '';
    if (/^https?:\/\//i.test(src)) return src;
    const m = src.match(/^wix:image:\/\/v1\/([^/#]+)/);
    return m ? `https://static.wixstatic.com/media/${m[1]}` : '';
}

function place(d) {
    const hood = clean(d.neighbourhood);
    const city = clean(d.stateCity);
    if (hood && city && hood.toLowerCase() !== city.toLowerCase()) return `${hood}, ${city}`;
    return hood || city;
}

function typeWord(d, lang) {
    const raw = clean(first(d.propertyType));
    if (!raw) return lang === 'de' ? 'Immobilie' : 'Property';
    if (lang === 'de') return TYPE_DE[raw.toLowerCase()] || raw;
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function isRent(d) {
    return (Array.isArray(d.dealType) ? d.dealType : [d.dealType])
        .some(t => /rent|term/i.test(String(t || '')));
}

function countryName(d, lang) {
    const c = clean(first(d.country));
    return (COUNTRY[lang] && COUNTRY[lang][c]) || c;
}

export function buildTitle(d, lang) {
    const title = clean(d.title);
    if (!title) return BRAND;
    // Country is only added in EN/DE (country names are not translated to other languages).
    const country = (lang === 'en' || lang === 'de') ? countryName(d, lang) : '';
    const hasCountry = country && title.toLowerCase().includes(country.toLowerCase());
    const candidates = [];
    if (country && !hasCountry) candidates.push(`${title}, ${country} | ${BRAND}`);
    candidates.push(`${title} | ${BRAND}`);
    if (country && !hasCountry) candidates.push(`${title}, ${country}`);
    candidates.push(title);
    return candidates.find(c => c.length <= TITLE_MAX) || fit(title, TITLE_MAX);
}

function priceText(d, lang) {
    const min = formatPrice(d.minPrice, lang);
    const max = formatPrice(d.maxPrice, lang);
    if (!min && !max) return '';
    if (min && max && d.minPrice !== d.maxPrice) return lang === 'de' ? `Preis ab ${min}` : `From ${min}`;
    return lang === 'de' ? `Preis ${min || max}` : `Price ${min || max}`;
}

export function buildDescription(d, lang) {
    if (lang !== 'en' && lang !== 'de') {
        // Other languages (Hebrew): title plus the start of the listing text.
        return fit(`${clean(d.title)}. ${clean(d.description)}`, DESC_MAX);
    }
    const de = lang === 'de';
    const where = [place(d), countryName(d, lang)].filter(Boolean).join(', ');
    const deal = isRent(d) ? (de ? 'zu vermieten' : 'for rent') : (de ? 'zu verkaufen' : 'for sale');
    const lead = `${typeWord(d, lang)} ${deal}${where ? ' in ' + where : ''}`;

    const facts = [];
    const bedsMin = d.minBedrooms || 0, bedsMax = d.maxBedrooms || 0;
    const beds = bedsMin && bedsMax && bedsMin !== bedsMax ? `${bedsMin}–${bedsMax}` : (bedsMin || bedsMax);
    if (beds) facts.push(de ? `${beds} Schlafzimmer` : `${beds} bedroom${beds === 1 ? '' : 's'}`);
    if (d.bathrooms > 0) facts.push(de ? `${d.bathrooms} ${d.bathrooms === 1 ? 'Bad' : 'Bäder'}` : `${d.bathrooms} bathroom${d.bathrooms === 1 ? '' : 's'}`);
    if (d.sizeSqm > 0) facts.push(`${groupDigits(d.sizeSqm, lang)} m²`);
    else if (d.plotArea > 0) facts.push(de ? `${groupDigits(d.plotArea, lang)} m² Grundstück` : `${groupDigits(d.plotArea, lang)} m² plot`);

    let text = lead + (facts.length ? `: ${facts.join(', ')}.` : '.');
    const price = priceText(d, lang);
    if (price) text += ` ${price}.`;
    const cta = de ? ' Jetzt bei Sharon Homes anfragen.' : ' Enquire with Sharon Homes.';
    if ((text + cta).length <= DESC_MAX) text += cta;
    return fit(text, DESC_MAX);
}

export function buildAlt(d, lang, n) {
    if (lang !== 'en' && lang !== 'de') return `${clean(d.title)} ${n}`;
    const de = lang === 'de';
    const where = [place(d), countryName(d, lang)].filter(Boolean).join(', ');
    const deal = isRent(d) ? (de ? 'zu vermieten' : 'for rent') : (de ? 'zu verkaufen' : 'for sale');
    return `${typeWord(d, lang)} ${deal}${where ? ' in ' + where : ''}, ${de ? 'Foto' : 'photo'} ${n}`;
}

/** Adds alt text to gallery items that have none. Returns a new array. */
export function withAltText(gallery, d, lang) {
    return (gallery || []).map((g, i) => (g && !clean(g.alt)) ? { ...g, alt: buildAlt(d, lang, i + 1) } : g);
}

function schemaType(d) {
    const t = clean(first(d.propertyType)).toLowerCase();
    if (RESIDENTIAL_HOUSE.includes(t)) return 'SingleFamilyResidence';
    if (RESIDENTIAL_FLAT.includes(t)) return 'Apartment';
    if (!t) return 'Accommodation';
    return 'Place';
}

export function buildStructuredData(d, lang, { url, description, active }) {
    const images = (d.gallery || []).map(g => imageUrl(g && g.src)).filter(Boolean).slice(0, 5);
    const c = clean(first(d.country));
    const address = {
        '@type': 'PostalAddress',
        addressLocality: clean(d.neighbourhood) || clean(d.stateCity) || undefined,
        addressRegion: clean(d.stateCity) || undefined,
        addressCountry: COUNTRY_ISO[c] || c || undefined
    };
    const type = schemaType(d);
    const about = { '@type': type, address };
    if (type !== 'Place') {
        if (d.minBedrooms > 0) about.numberOfBedrooms = d.minBedrooms;
        if (d.bathrooms > 0) about.numberOfBathroomsTotal = d.bathrooms;
        if (d.sizeSqm > 0) about.floorSize = { '@type': 'QuantitativeValue', value: Math.round(d.sizeSqm), unitCode: 'MTK' };
    }

    const listing = {
        '@context': 'https://schema.org',
        '@type': 'RealEstateListing',
        name: clean(d.title),
        description,
        url,
        inLanguage: lang,
        about,
        provider: { '@type': 'RealEstateAgent', name: BRAND, url: SITE_URL }
    };
    if (images.length) listing.image = images;

    const availability = active ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut';
    if (d.minPrice > 0 && d.maxPrice > 0 && d.minPrice !== d.maxPrice) {
        listing.offers = { '@type': 'AggregateOffer', priceCurrency: 'EUR', lowPrice: d.minPrice, highPrice: d.maxPrice, availability };
    } else if (d.minPrice > 0 || d.maxPrice > 0) {
        listing.offers = { '@type': 'Offer', priceCurrency: 'EUR', price: d.minPrice || d.maxPrice, availability };
    }
    return JSON.parse(JSON.stringify(listing)); // drops undefined fields
}

/**
 * Everything the page needs. `active` is false for sold or removed listings:
 * those get noindex so they drop out of search without any redirect.
 */
export function buildPropertySeo(d, lang, { url, active = true } = {}) {
    const title = buildTitle(d, lang);
    const description = buildDescription(d, lang);
    const image = imageUrl(d.gallery && d.gallery[0] && d.gallery[0].src);
    const metaTags = [
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' }
    ];
    if (url) metaTags.push({ property: 'og:url', content: url });
    if (image) metaTags.push({ property: 'og:image', content: image });
    if (!active) metaTags.push({ name: 'robots', content: 'noindex' });

    return {
        title,
        description,
        metaTags,
        structuredData: [buildStructuredData(d, lang, { url, description, active })]
    };
}
