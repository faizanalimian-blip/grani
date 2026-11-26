import wixLocation from 'wix-location';
import {
    getFeaturedProperties,
    getCountryPropertyCounts,
    getAllCountries,
    getAllCitiesByCountry,
    getAllPropertyTypes,
    getPropertyEnglishUrl
} from 'backend/search.web.js';
import wixWindowFrontend from 'wix-window-frontend';

let currentLanguage = 'en';

// Shared dropdown options
const BEDROOM_OPTIONS = [
    { label: 'Any Bedrooms', value: '' },
    { label: '1 Bedroom',    value: '1' },
    { label: '2 Bedrooms',   value: '2' },
    { label: '3 Bedrooms',   value: '3' },
    { label: '4 Bedrooms',   value: '4' },
    { label: '5+ Bedrooms',  value: '5' }
];

const PRICE_OPTIONS = [
    { label: 'Any Price',      value: '' },
    { label: 'Up to €250K',    value: '0-250000' },
    { label: '€250K – €500K',  value: '250000-500000' },
    { label: '€500K – €1M',    value: '500000-1000000' },
    { label: '€1M – €2M',      value: '1000000-2000000' },
    { label: '€2M+',           value: '2000000-0' }
];

$w.onReady(async function () {
    console.log('🌐 [HOME] onReady fired');
    console.log('🌐 [HOME] multilingual object:', wixWindowFrontend.multilingual);
    currentLanguage = wixWindowFrontend.multilingual.currentLanguage;
    console.log('🌐 [HOME] currentLanguage detected:', currentLanguage);

    applyRTLLTR(currentLanguage);
    showLoading();

    // ── Dropdowns — LTR ─────────────────────────────────
    $w('#bedroomsDropdown').options = BEDROOM_OPTIONS;
    $w('#priceDropdown').options    = PRICE_OPTIONS;

    // ── Dropdowns — RTL (IDs set in editor by user) ─────
    $w('#bedroomsDropdownRTL').options = BEDROOM_OPTIONS;
    $w('#priceDropdownRTL').options    = PRICE_OPTIONS;

    // ── Country dropdowns ────────────────────────────────
    getAllCountries(currentLanguage).then(res => {
        console.log('🌍 [HOME] Countries loaded:', res.length);
        const opts = [{ label: 'Any Country', value: '' }, ...res];
        $w('#countryDropdown').options    = opts;
        $w('#countryDropdownRTL').options = opts;
    });

    // ── City dropdowns — disabled until country selected ──
    $w('#cityDropdown').disable();
    $w('#cityDropdownRTL').disable();

    $w('#countryDropdown').onChange(() => {
        const country = $w('#countryDropdown').value;
        $w('#cityDropdown').value   = undefined;
        if (!country) { $w('#cityDropdown').disable(); return; }
        getAllCitiesByCountry(country, currentLanguage).then(res => {
            $w('#cityDropdown').options = [{ label: 'Any City', value: '' }, ...res];
            $w('#cityDropdown').enable();
        });
    });

    $w('#countryDropdownRTL').onChange(() => {
        const country = $w('#countryDropdownRTL').value;
        $w('#cityDropdownRTL').value   = undefined;
        if (!country) { $w('#cityDropdownRTL').disable(); return; }
        getAllCitiesByCountry(country, currentLanguage).then(res => {
            $w('#cityDropdownRTL').options = [{ label: 'Any City', value: '' }, ...res];
            $w('#cityDropdownRTL').enable();
        });
    });

    // ── Property type dropdowns ──────────────────────────
    getAllPropertyTypes(currentLanguage).then(res => {
        console.log('🏠 [HOME] Property types loaded:', res.length);
        const opts = [{ label: 'Any Type', value: '' }, ...res];
        $w('#propertyTypeDropdown').options    = opts;
        $w('#propertyTypeDropdownRTL').options = opts;
    });

    // ── Load featured + counts in parallel ───────────────
    console.log('🔄 [HOME] Calling getFeaturedProperties with language:', currentLanguage);
    const [featuredResult, countsResult] = await Promise.all([
        getFeaturedProperties(currentLanguage),
        getCountryPropertyCounts(currentLanguage)
    ]);

    console.log('📦 [HOME] featuredResult:', featuredResult);
    console.log('📦 [HOME] isFeatured:', featuredResult.isFeatured);
    console.log('📦 [HOME] items count:', featuredResult.data?.length);
    console.log('📦 [HOME] first item language:', featuredResult.data?.[0]?.language);
    console.log('📦 [HOME] first item title:', featuredResult.data?.[0]?.title);

    // ── Populate repeater ────────────────────────────────
    if (featuredResult.success && featuredResult.data.length > 0) {
        populateRepeater(featuredResult.data);
    } else {
        console.warn('⚠️ [HOME] No featured data');
        showNoResults();
    }
    hideLoading();

    // ── Country repeaters ────────────────────────────────
    console.log('📊 [HOME] countsResult:', countsResult);
    if (countsResult.success) {
        const counts = [countsResult.cyprus, countsResult.greece];

        $w('#countriesRepeaterLTR').forEachItem(($item, itemData, index) => {
            const country = index === 0 ? 'Cyprus' : 'Greece';
            console.log(`🏳️ [HOME] LTR item ${index} → ${country}: ${counts[index]}`);
            $item('#countTextLTR').text = `${counts[index]} properties available`;
            $item('#itemBoxLTR').onClick(() => {
                wixLocation.to(`/properties-1?country=${country}`);
            });
        });

        $w('#countriesRepeaterRTL').forEachItem(($item, itemData, index) => {
            const country = index === 0 ? 'Cyprus' : 'Greece';
            $item('#countTextRTL').text = `${counts[index]} properties available`;
            $item('#itemBoxRTL').onClick(() => {
                wixLocation.to(`/properties-1?country=${country}`);
            });
        });
    }

    // ── Search buttons ───────────────────────────────────
    $w('#searchButton').onClick(()    => navigateToSearch());
    $w('#searchButtonRTL').onClick(() => navigateToSearch());
});

// ── Navigate to search with query params ─────────────────
function navigateToSearch() {
    const isRTL      = currentLanguage === 'he';
    const country    = (isRTL ? $w('#countryDropdownRTL').value      : $w('#countryDropdown').value)      || '';
    const city       = (isRTL ? $w('#cityDropdownRTL').value         : $w('#cityDropdown').value)         || '';
    const bedrooms   = (isRTL ? $w('#bedroomsDropdownRTL').value     : $w('#bedroomsDropdown').value)     || '';
    const price      = (isRTL ? $w('#priceDropdownRTL').value        : $w('#priceDropdown').value)        || '';
    const propType   = (isRTL ? $w('#propertyTypeDropdownRTL').value : $w('#propertyTypeDropdown').value) || '';

    const params = [];
    if (country)   params.push(`country=${encodeURIComponent(country)}`);
    if (city)      params.push(`city=${encodeURIComponent(city)}`);
    if (propType)  params.push(`propertyType=${encodeURIComponent(propType)}`);
    if (bedrooms) params.push(`bedrooms=${bedrooms}`);
    if (price) {
        const [min, max] = price.split('-');
        if (min && min !== '0') params.push(`minPrice=${min}`);
        if (max && max !== '0') params.push(`maxPrice=${max}`);
    }

    const qs = params.length ? '?' + params.join('&') : '';
    console.log('🔍 [HOME] Navigating to:', `/properties-1${qs}`);
    wixLocation.to(`/properties-1${qs}`);
}

// ── RTL / LTR section toggle ─────────────────────────────
function applyRTLLTR(lang) {
    const isRTL = lang === 'he';
    console.log('↔️ [HOME] applyRTLLTR | lang:', lang, '| isRTL:', isRTL);

    if (isRTL) {
        $w('#LTR1').collapse(); $w('#LTR2').collapse();
        $w('#LTR3').collapse(); $w('#LTR4').collapse();
        $w('#repeatorSectionLTR').collapse();
        $w('#filterLTR').collapse();
        $w('#RTL1').expand();   $w('#RTL2').expand();
        $w('#RTL3').expand();   $w('#RTL4').expand();
        $w('#repeatorSectionRTL').expand();
        $w('#filterRTL').expand();
    } else {
        $w('#LTR1').expand();   $w('#LTR2').expand();
        $w('#LTR3').expand();   $w('#LTR4').expand();
        $w('#repeatorSectionLTR').expand();
        $w('#filterLTR').expand();
        $w('#RTL1').collapse(); $w('#RTL2').collapse();
        $w('#RTL3').collapse(); $w('#RTL4').collapse();
        $w('#repeatorSectionRTL').collapse();
        $w('#filterRTL').collapse();
    }
}

// ── Loading helpers ──────────────────────────────────────
function showLoading() {
    if ($w('#loadingText')) $w('#loadingText').expand();
    currentLanguage === 'he'
        ? $w('#repeatorSectionRTL').collapse()
        : $w('#repeatorSectionLTR').collapse();
}

function hideLoading() {
    if ($w('#loadingText')) $w('#loadingText').collapse();
    currentLanguage === 'he'
        ? $w('#repeatorSectionRTL').expand()
        : $w('#repeatorSectionLTR').expand();
}

function showNoResults() {
    if ($w('#noResults')) $w('#noResults').expand();
}

function hideNoResults() {
    if ($w('#noResults')) $w('#noResults').collapse();
}

// ── Populate featured repeater ───────────────────────────
function populateRepeater(data) {
    const isRTL    = currentLanguage === 'he';
    const repeater = isRTL ? $w('#repeatorRTL') : $w('#repeatorLTR');
    const t        = id => isRTL ? id.replace('#', '#') + 'RTL' : id;

    console.log('🔁 [HOME] populateRepeater | isRTL:', isRTL, '| items:', data.length);
    console.log('🔁 [HOME] sample item language:', data[0]?.language, '| title:', data[0]?.title);

    if (data.length === 0) { showNoResults(); return; }
    hideNoResults();

    // onItemReady MUST be registered before data is assigned
    repeater.onItemReady(($item, itemData) => {
        console.log('🃏 [HOME] onItemReady | title:', itemData.title, '| lang:', itemData.language);

        if ($item(t('#titleText')))
            $item(t('#titleText')).text = itemData.title || 'Untitled Property';

        if ($item(t('#image1')) && itemData.gallery?.length > 0)
            $item(t('#image1')).src = itemData.gallery[0].src;

        if ($item(t('#priceText')))
            $item(t('#priceText')).text = formatPriceRange(itemData.minPrice, itemData.maxPrice);

        if ($item(t('#bedroomsText')))
            $item(t('#bedroomsText')).text = formatBedroomRange(itemData.minBedrooms, itemData.maxBedrooms);

        if ($item(t('#cityText'))) {
            const city    = itemData.stateCity || '';
            const country = Array.isArray(itemData.country)
                ? itemData.country.join(', ')
                : (itemData.country || '');
            $item(t('#cityText')).text = city && country
                ? `${city} · ${country}`
                : city || country || 'Location N/A';
        }

        try {
            if ($item(t('#countryText')))
                $item(t('#countryText')).text = Array.isArray(itemData.country)
                    ? itemData.country.join(', ')
                    : itemData.country || 'Country N/A';
        } catch (e) {}

        if ($item(t('#propertyTypeText')))
            $item(t('#propertyTypeText')).text = Array.isArray(itemData.propertyType)
                ? itemData.propertyType.join(', ')
                : itemData.propertyType || 'N/A';

        if ($item(t('#detailButton')))
            $item(t('#detailButton')).onClick(() => navigateToPropertyDetails(itemData.propertyId));
    });

    // Assign data AFTER registering the handler
    repeater.data = data;
    console.log('✅ [HOME] repeater.data assigned, items:', repeater.data.length);
}

// ── Navigation ───────────────────────────────────────────
async function navigateToPropertyDetails(propertyId) {
    try {
        const result = await getPropertyEnglishUrl(propertyId);
        wixLocation.to(result.success && result.url
            ? result.url
            : `/property-details?propertyId=${propertyId}`
        );
    } catch (e) {
        wixLocation.to(`/property-details?propertyId=${propertyId}`);
    }
}

// ── Format helpers ───────────────────────────────────────
function formatPriceRange(minPrice, maxPrice) {
    const fmt = p => {
        if (!p) return null;
        return `€${p.toLocaleString('en-US')}`;
    };
    const min = fmt(minPrice);
    const max = fmt(maxPrice);
    if (min && max && minPrice !== maxPrice) return `${min} - ${max}`;
    return min || max || 'Contact for Price';
}

function formatBedroomRange(min, max) {
    if (!min && !max) return 'Beds N/A';
    if (min && max && min === max) return `${min} Bed${min > 1 ? 's' : ''}`;
    if (min && max)  return `${min}-${max} Beds`;
    if (min)         return `${min}+ Beds`;
    if (max)         return `Up to ${max} Beds`;
    return 'Beds N/A';
}