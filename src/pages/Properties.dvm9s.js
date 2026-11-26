import wixLocation from 'wix-location';
import {
    searchPropertiesPaginated,
    getAllCitiesByCountry,
    getAllNeighbourhoodsByCity,
    getAllPropertyTypes,
    getAllCountries,
    getAllDealTypes,
    getPropertyEnglishUrl
} from 'backend/search.web.js';
import wixWindowFrontend from 'wix-window-frontend';

let currentLanguage = 'en';
let currentPage     = 1;
let currentFilters  = {};

// Infinite scroll state
let allLoadedItems = [];
let isLoading      = false;
let hasMore        = true;

// ── Dropdown option constants ─────────────────────────────
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

const STATUS_OPTIONS = [
    { label: 'Any Status',      value: '' },
    { label: 'Off-plan',        value: 'Off-plan' },
    { label: 'In Construction', value: 'In Construction' },
    { label: 'New & Ready',     value: 'New & Ready' },
    { label: 'Resale',          value: 'Resale' }
];

const SORT_OPTIONS = [
    { label: 'Newest',             value: 'newest' },
    { label: 'Oldest',             value: 'oldest' },
    { label: 'Price: Low to High', value: 'priceAsc' },
    { label: 'Price: High to Low', value: 'priceDesc' }
];

const VALID_BEDROOMS = ['1', '2', '3', '4', '5'];
const VALID_STATUSES = STATUS_OPTIONS.map(o => o.value).filter(Boolean);
const VALID_SORTS    = SORT_OPTIONS.map(o => o.value);
const PRICE_VALUES   = PRICE_OPTIONS.map(o => o.value).filter(Boolean);

$w.onReady(async function () {
    currentLanguage = wixWindowFrontend.multilingual.currentLanguage;
    console.log('🔍 [SEARCH] language:', currentLanguage);
    applyRTLLTR(currentLanguage);
    showLoading();

    // ── Hardcoded dropdowns — LTR ────────────────────────
    $w('#bedroomsDropdown').options       = BEDROOM_OPTIONS;
    $w('#priceDropdown').options          = PRICE_OPTIONS;
    $w('#propertyStatusDropdown').options = STATUS_OPTIONS;
    $w('#sortDropdown').options           = SORT_OPTIONS;
    $w('#sortDropdown').value             = 'newest';

    // ── Hardcoded dropdowns — RTL ────────────────────────
    $w('#bedroomsDropdownRTL').options       = BEDROOM_OPTIONS;
    $w('#priceDropdownRTL').options          = PRICE_OPTIONS;
    $w('#propertyStatusDropdownRTL').options = STATUS_OPTIONS;
    $w('#sortDropdownRTL').options           = SORT_OPTIONS;
    $w('#sortDropdownRTL').value             = 'newest';

    // ── Dynamic dropdowns — LTR + RTL ───────────────────
    const [countriesRes, typesRes, dealTypesRes] = await Promise.all([
        getAllCountries(currentLanguage),
        getAllPropertyTypes(currentLanguage),
        getAllDealTypes(currentLanguage)
    ]);

    const countryOpts  = [{ label: 'Any Country', value: '' }, ...countriesRes];
    const typeOpts     = [{ label: 'Any Type',    value: '' }, ...typesRes];
    const dealTypeOpts = [{ label: 'Any',         value: '' }, ...dealTypesRes];

    $w('#countryDropdown').options      = countryOpts;
    $w('#propertyTypeDropdown').options = typeOpts;
    $w('#dealTypeDropdown').options     = dealTypeOpts;

    $w('#countryDropdownRTL').options      = countryOpts;
    $w('#propertyTypeDropdownRTL').options = typeOpts;
    $w('#dealTypeDropdownRTL').options     = dealTypeOpts;

    $w('#cityDropdown').disable();
    $w('#cityDropdownRTL').disable();
    $w('#neighbourhoodDropdown').disable();
    $w('#neighbourhoodDropdownRTL').disable();

    // ── Country → cities cascade (LTR) ──────────────────
    $w('#countryDropdown').onChange(() => {
        const country = $w('#countryDropdown').value;
        $w('#cityDropdown').value   = undefined;
        $w('#cityDropdown').options = [];
        $w('#neighbourhoodDropdown').value   = undefined;
        $w('#neighbourhoodDropdown').options = [];
        $w('#neighbourhoodDropdown').disable();
        if (!country) { $w('#cityDropdown').disable(); return; }

        getAllCitiesByCountry(country, currentLanguage).then(res => {
            $w('#cityDropdown').options = [{ label: 'Any City', value: '' }, ...res];
            $w('#cityDropdown').enable();
        });
    });

    // ── Country → cities cascade (RTL) ──────────────────
    $w('#countryDropdownRTL').onChange(() => {
        const country = $w('#countryDropdownRTL').value;
        $w('#cityDropdownRTL').value   = undefined;
        $w('#cityDropdownRTL').options = [];
        $w('#neighbourhoodDropdownRTL').value   = undefined;
        $w('#neighbourhoodDropdownRTL').options = [];
        $w('#neighbourhoodDropdownRTL').disable();
        if (!country) { $w('#cityDropdownRTL').disable(); return; }

        getAllCitiesByCountry(country, currentLanguage).then(res => {
            $w('#cityDropdownRTL').options = [{ label: 'Any City', value: '' }, ...res];
            $w('#cityDropdownRTL').enable();
        });
    });

    // ── City → neighbourhoods cascade (LTR) ─────────────
    $w('#cityDropdown').onChange(() => {
        const city = $w('#cityDropdown').value;
        $w('#neighbourhoodDropdown').value = undefined;
        $w('#neighbourhoodDropdown').options = [];
        if (!city) { $w('#neighbourhoodDropdown').disable(); return; }

        getAllNeighbourhoodsByCity(city, currentLanguage).then(res => {
            $w('#neighbourhoodDropdown').options = [{ label: 'Any Neighbourhood', value: '' }, ...res];
            $w('#neighbourhoodDropdown').enable();
        });
    });

    // ── City → neighbourhoods cascade (RTL) ─────────────
    $w('#cityDropdownRTL').onChange(() => {
        const city = $w('#cityDropdownRTL').value;
        $w('#neighbourhoodDropdownRTL').value = undefined;
        $w('#neighbourhoodDropdownRTL').options = [];
        if (!city) { $w('#neighbourhoodDropdownRTL').disable(); return; }

        getAllNeighbourhoodsByCity(city, currentLanguage).then(res => {
            $w('#neighbourhoodDropdownRTL').options = [{ label: 'Any Neighbourhood', value: '' }, ...res];
            $w('#neighbourhoodDropdownRTL').enable();
        });
    });

    // ── Read & apply query params ────────────────────────
    await applyQueryParams(countryOpts, typeOpts, dealTypeOpts);

    // ── Initial load ─────────────────────────────────────
    currentFilters = getFiltersFromForm();
    await freshLoad();

    // ── Search buttons ───────────────────────────────────
    $w('#searchButton').onClick(async () => {
        currentFilters = getFiltersFromForm();
        await freshLoad();
        wixWindowFrontend.scrollTo(0, 820);
    });
    $w('#searchButtonRTL').onClick(async () => {
        currentFilters = getFiltersFromForm();
        await freshLoad();
        wixWindowFrontend.scrollTo(0, 820);
    });

    // ── Sort change triggers fresh load ──────────────────
    $w('#sortDropdown').onChange(async () => {
        currentFilters = getFiltersFromForm();
        await freshLoad();
    });
    $w('#sortDropdownRTL').onChange(async () => {
        currentFilters = getFiltersFromForm();
        await freshLoad();
    });

    // ── Reset buttons ────────────────────────────────────
    $w('#resetButton').onClick(()    => resetFilters());
    $w('#resetButtonRTL').onClick(() => resetFilters());
});

// ── Read query params, validate, pre-populate both sections
async function applyQueryParams(countryOpts, typeOpts, dealTypeOpts) {
    const q = wixLocation.query;
    console.log('🔗 [SEARCH] query params:', q);
    if (!q || Object.keys(q).length === 0) return;

    const validCountries  = countryOpts.map(o => o.value).filter(Boolean);
    const validTypes      = typeOpts.map(o => o.value).filter(Boolean);
    const validDealTypes  = dealTypeOpts.map(o => o.value).filter(Boolean);

    // country + city + neighbourhood (load cities, then neighbourhoods, then set all)
    if (q.country && validCountries.includes(q.country)) {
        $w('#countryDropdown').value    = q.country;
        $w('#countryDropdownRTL').value = q.country;

        const cities      = await getAllCitiesByCountry(q.country, currentLanguage);
        const cityOpts    = [{ label: 'Any City', value: '' }, ...cities];
        const validCities = cityOpts.map(o => o.value).filter(Boolean);

        $w('#cityDropdown').options    = cityOpts;
        $w('#cityDropdownRTL').options = cityOpts;
        $w('#cityDropdown').enable();
        $w('#cityDropdownRTL').enable();

        if (q.city && validCities.includes(q.city)) {
            $w('#cityDropdown').value    = q.city;
            $w('#cityDropdownRTL').value = q.city;

            const neighbourhoods      = await getAllNeighbourhoodsByCity(q.city, currentLanguage);
            const neighbourhoodOpts   = [{ label: 'Any Neighbourhood', value: '' }, ...neighbourhoods];
            const validNeighbourhoods = neighbourhoodOpts.map(o => o.value).filter(Boolean);

            $w('#neighbourhoodDropdown').options    = neighbourhoodOpts;
            $w('#neighbourhoodDropdownRTL').options = neighbourhoodOpts;
            $w('#neighbourhoodDropdown').enable();
            $w('#neighbourhoodDropdownRTL').enable();

            if (q.neighbourhood && validNeighbourhoods.includes(q.neighbourhood)) {
                $w('#neighbourhoodDropdown').value    = q.neighbourhood;
                $w('#neighbourhoodDropdownRTL').value = q.neighbourhood;
            }
        }
    }

    // propertyType
    if (q.propertyType && validTypes.includes(q.propertyType)) {
        $w('#propertyTypeDropdown').value    = q.propertyType;
        $w('#propertyTypeDropdownRTL').value = q.propertyType;
    }

    // dealType
    if (q.dealType && validDealTypes.includes(q.dealType)) {
        $w('#dealTypeDropdown').value    = q.dealType;
        $w('#dealTypeDropdownRTL').value = q.dealType;
    }

    // bedrooms
    if (q.bedrooms && VALID_BEDROOMS.includes(q.bedrooms)) {
        $w('#bedroomsDropdown').value    = q.bedrooms;
        $w('#bedroomsDropdownRTL').value = q.bedrooms;
    }

    // price range
    if (q.minPrice || q.maxPrice) {
        const priceKey = `${q.minPrice || '0'}-${q.maxPrice || '0'}`;
        if (PRICE_VALUES.includes(priceKey)) {
            $w('#priceDropdown').value    = priceKey;
            $w('#priceDropdownRTL').value = priceKey;
        } else {
            console.warn('⚠️ [SEARCH] Invalid price range param:', priceKey);
        }
    }

    // propertyStatus
    if (q.propertyStatus && VALID_STATUSES.includes(q.propertyStatus)) {
        $w('#propertyStatusDropdown').value    = q.propertyStatus;
        $w('#propertyStatusDropdownRTL').value = q.propertyStatus;
    }

    // sortBy
    if (q.sortBy && VALID_SORTS.includes(q.sortBy)) {
        $w('#sortDropdown').value    = q.sortBy;
        $w('#sortDropdownRTL').value = q.sortBy;
    }

    // kwRef — free text, no validation list needed
    if (q.kwRef) {
        $w('#kwRefInput').value    = q.kwRef;
        $w('#kwRefInputRTL').value = q.kwRef;
    }

    console.log('✅ [SEARCH] Query params applied');
}

// ── Read filters from active section ─────────────────────
function getFiltersFromForm() {
    const isRTL = currentLanguage === 'he';

    const country       = isRTL ? $w('#countryDropdownRTL').value        : $w('#countryDropdown').value;
    const city          = isRTL ? $w('#cityDropdownRTL').value           : $w('#cityDropdown').value;
    const neighbourhood = isRTL ? $w('#neighbourhoodDropdownRTL').value  : $w('#neighbourhoodDropdown').value;
    const propType      = isRTL ? $w('#propertyTypeDropdownRTL').value   : $w('#propertyTypeDropdown').value;
    const bedrooms       = isRTL ? $w('#bedroomsDropdownRTL').value       : $w('#bedroomsDropdown').value;
    const priceValue     = isRTL ? $w('#priceDropdownRTL').value          : $w('#priceDropdown').value;
    const status         = isRTL ? $w('#propertyStatusDropdownRTL').value : $w('#propertyStatusDropdown').value;
    const dealType       = isRTL ? $w('#dealTypeDropdownRTL').value       : $w('#dealTypeDropdown').value;
    const sortBy         = isRTL ? $w('#sortDropdownRTL').value           : $w('#sortDropdown').value;
    const kwRefValue     = isRTL ? $w('#kwRefInputRTL').value             : $w('#kwRefInput').value;
    const closeToSea     = isRTL ? $w('#closeToSeaCheckboxRTL').checked   : $w('#closeToSeaCheckbox').checked;
    const seaView        = isRTL ? $w('#seaViewCheckboxRTL').checked      : $w('#seaViewCheckbox').checked;

    let minPrice = null;
    let maxPrice = null;
    if (priceValue) {
        const [min, max] = priceValue.split('-').map(Number);
        if (min > 0) minPrice = min;
        if (max > 0) maxPrice = max;
    }

    return {
        language:       currentLanguage,
        country:        country       || null,
        city:           city          || null,
        neighbourhood:  neighbourhood || null,
        propertyType:   propType      ? [propType] : null,
        bedrooms:       bedrooms      || null,
        minPrice,
        maxPrice,
        propertyStatus: status        || null,
        dealType:       dealType      || null,
        sortBy:         sortBy        || 'newest',
        kwRef:          kwRefValue    ? kwRefValue.trim() : null,
        closeToSea:     closeToSea    || false,
        seaView:        seaView       || false,
        page:           1,
        pageSize:       6
    };
}

// ── Fresh load ────────────────────────────────────────────
async function freshLoad() {
    allLoadedItems = [];
    currentPage    = 1;
    hasMore        = true;

    showLoading();
    currentLanguage === 'he' ? $w('#repeatorRTL').collapse() : $w('#repeatorLTR').collapse();
    hideNoResults();

    const filters = currentFilters.language ? currentFilters : getFiltersFromForm();
    console.log('🔄 [SEARCH] freshLoad:', filters);

    try {
        isLoading     = true;
        const result  = await searchPropertiesPaginated({ ...filters, page: 1, pageSize: 6 });
        isLoading     = false;

        if (!result.success || result.data.length === 0) {
            currentLanguage === 'he' ? $w('#repeatorRTL').collapse() : $w('#repeatorLTR').collapse();
            showNoResults();
            $w('#loadingText').collapse();
            if ($w('#resultsCountText')) $w('#resultsCountText').collapse();
            hasMore = false;
            return;
        }

        allLoadedItems = result.data;
        hasMore        = result.pagination.hasNextPage;

        populateRepeater(allLoadedItems);
        updateResultsCount(allLoadedItems.length, result.pagination.totalItems);
        $w('#loadingText').collapse();

    } catch (error) {
        isLoading = false;
        console.error('❌ [SEARCH] freshLoad error:', error);
        showNoResults();
        $w('#loadingText').collapse();
    }
}

// ── Load next page ────────────────────────────────────────
async function loadNextPage() {
    if (isLoading || !hasMore) return;

    console.log('📄 [SEARCH] next page:', currentPage + 1);
    isLoading = true;

    const isRTL = currentLanguage === 'he';
    const scrollLoader = isRTL ? $w('#scrollLoaderRTL') : $w('#scrollLoaderLTR');
    if (scrollLoader) scrollLoader.expand();

    try {
        currentPage++;
        const filters = currentFilters.language ? currentFilters : getFiltersFromForm();
        const result  = await searchPropertiesPaginated({ ...filters, page: currentPage, pageSize: 6 });

        if (!result.success || result.data.length === 0) {
            hasMore = false; isLoading = false;
            if (scrollLoader) scrollLoader.collapse();
            return;
        }

        allLoadedItems = [...allLoadedItems, ...result.data];
        hasMore        = result.pagination.hasNextPage;

        populateRepeater(allLoadedItems);
        updateResultsCount(allLoadedItems.length, result.pagination.totalItems);

    } catch (error) {
        console.error('❌ [SEARCH] loadNextPage error:', error);
    }

    if (scrollLoader) scrollLoader.collapse();
    isLoading = false;
}

// ── RTL / LTR toggle ─────────────────────────────────────
function applyRTLLTR(lang) {
    const isRTL = lang === 'he';
    if (isRTL) {
        $w('#LTR1').collapse();
        $w('#filterLTR').collapse();
        $w('#repeatorLTR').collapse();
        $w('#RTL1').expand();
        $w('#filterRTL').expand();
        $w('#repeatorRTL').expand();
    } else {
        $w('#RTL1').collapse();
        $w('#filterRTL').collapse();
        $w('#repeatorRTL').collapse();
        $w('#LTR1').expand();
        $w('#filterLTR').expand();
        $w('#repeatorLTR').expand();
    }
}

// ── Populate repeater — includes merged infinite-scroll trigger ──────────
function populateRepeater(data) {
    const isRTL    = currentLanguage === 'he';
    const repeater = isRTL ? $w('#repeatorRTL') : $w('#repeatorLTR');
    const t        = id => isRTL ? id + 'RTL' : id;

    if (data.length === 0) { repeater.collapse(); showNoResults(); return; }

    const uniqueData = data.map((item, i) => ({
        ...item,
        _id: item._id || item.propertyId || String(i)
    }));

    repeater.onItemReady(($item, itemData, index) => {
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
                ? itemData.country.join(', ') : (itemData.country || '');
            $item(t('#cityText')).text = city && country
                ? `${city} · ${country}` : city || country || 'Location N/A';
        }

        if ($item(t('#countryText')))
            $item(t('#countryText')).text = Array.isArray(itemData.country)
                ? itemData.country.join(', ') : itemData.country || 'Country N/A';

        if ($item(t('#propertyTypeText')))
            $item(t('#propertyTypeText')).text = Array.isArray(itemData.propertyType)
                ? itemData.propertyType.join(', ') : itemData.propertyType || 'N/A';

        if ($item(t('#detailButton')))
            $item(t('#detailButton')).onClick(() => navigateToPropertyDetails(itemData.propertyId));

        // ── Infinite scroll trigger — merged in here so it survives every re-render ──
        if (index === uniqueData.length - 2) {
            const containerId = isRTL ? '#itemContainerRTL' : '#itemContainer';
            if ($item(containerId)) {
                $item(containerId).onViewportEnter(async () => {
                    await loadNextPage();
                });
            }
        }
    });

    repeater.data = uniqueData;
    repeater.expand();
    hideNoResults();
}

// ── Reset all filters (both sections) ────────────────────
function resetFilters() {
    // LTR
    $w('#countryDropdown').value        = undefined;
    $w('#cityDropdown').value           = undefined;
    $w('#cityDropdown').disable();
    $w('#neighbourhoodDropdown').value  = undefined;
    $w('#neighbourhoodDropdown').disable();
    $w('#propertyTypeDropdown').value   = undefined;
    $w('#bedroomsDropdown').value       = undefined;
    $w('#priceDropdown').value          = undefined;
    $w('#propertyStatusDropdown').value = undefined;
    $w('#dealTypeDropdown').value       = undefined;
    $w('#sortDropdown').value           = 'newest';
    $w('#kwRefInput').value             = '';
    $w('#closeToSeaCheckbox').checked   = false;
    $w('#seaViewCheckbox').checked      = false;

    // RTL
    $w('#countryDropdownRTL').value        = undefined;
    $w('#cityDropdownRTL').value           = undefined;
    $w('#cityDropdownRTL').disable();
    $w('#neighbourhoodDropdownRTL').value  = undefined;
    $w('#neighbourhoodDropdownRTL').disable();
    $w('#propertyTypeDropdownRTL').value   = undefined;
    $w('#bedroomsDropdownRTL').value       = undefined;
    $w('#priceDropdownRTL').value          = undefined;
    $w('#propertyStatusDropdownRTL').value = undefined;
    $w('#dealTypeDropdownRTL').value       = undefined;
    $w('#sortDropdownRTL').value           = 'newest';
    $w('#kwRefInputRTL').value             = '';
    $w('#closeToSeaCheckboxRTL').checked   = false;
    $w('#seaViewCheckboxRTL').checked      = false;

    currentFilters = { language: currentLanguage, sortBy: 'newest', page: 1, pageSize: 6 };
    freshLoad();
    console.log('🔄 [SEARCH] Filters reset');
}

// ── Results count ─────────────────────────────────────────
function updateResultsCount(loaded, total) {
    if (!$w('#resultsCountText')) return;
    let text = '';
    if (currentLanguage === 'de') {
        text = loaded >= total ? `Alle ${total} Immobilien angezeigt` : `${loaded} von ${total} Immobilien`;
    } else if (currentLanguage === 'he') {
        text = loaded >= total ? `מציג את כל ${total} הנכסים` : `מציג ${loaded} מתוך ${total} נכסים`;
    } else {
        text = loaded >= total
            ? `Showing all ${total} propert${total === 1 ? 'y' : 'ies'}`
            : `Showing ${loaded} of ${total} properties`;
    }
    $w('#resultsCountText').text = text;
    $w('#resultsCountText').expand();
}

// ── Show / hide helpers ───────────────────────────────────
function showLoading()  { if ($w('#loadingText')) $w('#loadingText').expand(); }
function showNoResults() {
    if ($w('#noResults'))       $w('#noResults').expand();
    if ($w('#resultsCountText')) $w('#resultsCountText').collapse();
}
function hideNoResults() { if ($w('#noResults')) $w('#noResults').collapse(); }

// ── Navigation — uses guaranteed-unique propertyId-based URL ─────────────
async function navigateToPropertyDetails(propertyId) {
    try {
        const result = await getPropertyEnglishUrl(propertyId);
        wixLocation.to(result.success && result.url
            ? result.url : `/property-details?propertyId=${propertyId}`);
    } catch (e) {
        wixLocation.to(`/property-details?propertyId=${propertyId}`);
    }
}

// ── Format helpers — exact prices, no K/M rounding ────────────────────────
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