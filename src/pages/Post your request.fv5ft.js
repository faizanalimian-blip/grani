import { saveBuyRequestWithTranslations } from 'backend/buyRequestTranslations.web.js';
import { getCountries, getCitiesOfCountry } from 'backend/csc.web.js';

let selectedCities = [];

$w.onReady(function () {
    console.log("151515 tester logger");
    loadCountries();

    $w('#citySelector').on('citiesChanged', (event) => {
        selectedCities = event.detail.cities || [];
        console.log('🏙️ Selected cities updated:', selectedCities);
    });

    $w('#countryDropdown').onChange(async () => {
        const countryCode = $w('#countryDropdown').value;

        if (!countryCode) {
            resetCitySelector();
            return;
        }

        console.log('🌍 Country changed to:', countryCode);
        resetCitySelector();
        await loadCitiesIntoSelector(countryCode);
    });
});

async function loadCountries() {
    try {
        const countries = await getCountries();
        $w('#countryDropdown').options = countries.map(c => ({
            label: c.name,
            value: c.isoCode
        }));
        console.log('✅ Countries loaded');
    } catch (error) {
        console.error('❌ Error loading countries:', error);
    }
}

async function loadCitiesIntoSelector(countryCode) {
    try {
        console.log('🔄 Loading cities for:', countryCode);
        const cities = await getCitiesOfCountry(countryCode);
        $w('#citySelector').setAttribute('cities', JSON.stringify(cities));
        console.log('📤 Loaded cities into selector:', cities.length);
    } catch (error) {
        console.error('❌ Error loading cities:', error);
    }
}

function resetCitySelector() {
    selectedCities = [];
    $w('#citySelector').setAttribute('reset', 'true');
    setTimeout(() => {
        $w('#citySelector').setAttribute('reset', 'false');
    }, 100);
    console.log('🔄 Reset city selector');
}

function showError(msg) {
    $w('#errorText').text = msg;
    $w('#errorText').show();
}

function hideError() {
    $w('#errorText').hide();
}

function goToState(n) {
    $w('#multiStateBox').changeState(`s${n}`);
    $w('#multiStateBoxNum').changeState(`state${n}`);
    hideError();
}

// --- State 1 ---
$w('#nextButton1').onClick(() => {
    if (validateState1()) goToState(2);
});

function validateState1() {
    const country = $w('#countryDropdown').value;
    const propertyType = $w('#propertyTypeDropdown').value;

    if (!country) { showError("Please select a country"); return false; }
    if (selectedCities.length === 0) { showError("Please select at least one city"); return false; }
    if (!propertyType) { showError("Please select property type"); return false; }

    return true;
}

// --- State 2 ---
$w('#previousButton2').onClick(() => goToState(1));

$w('#nextButton2').onClick(() => {
    if (validateState2()) goToState(3);
});

function validateState2() {
    const minRooms = parseInt($w('#minRoomsInput').value.trim());

    if (!$w('#minRoomsInput').value.trim()) { showError("Please enter minimum rooms"); return false; }
    if (isNaN(minRooms) || minRooms < 1) { showError("Minimum rooms must be a valid number"); return false; }

    return true;
}

// --- State 3 ---
$w('#previousButton3').onClick(() => goToState(2));

$w('#submitButton').onClick(() => {
    if (validateState3()) submitForm();
});

function validateState3() {
    const maxPrice = $w('#maxPriceInput').value.trim();
    const comments  = $w('#commentsInput').value.trim();
    const name      = $w('#nameInput').value.trim();
    const phone     = $w('#phoneInput').value.trim();
    const email     = $w('#emailInput').value.trim();
    const agreement = $w('#agreementCheckbox').checked;

    if (!maxPrice)  { showError("Please enter maximum price"); return false; }
    if (!comments)  { showError("Please enter additional comments"); return false; }
    if (!name)      { showError("Please enter your name"); return false; }
    if (!email)     { showError("Please enter your email"); return false; }

    // const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // if (!emailRegex.test(email)) { showError("Please enter a valid email address"); return false; }

    if (!phone)     { showError("Please enter your phone"); return false; }

    // const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,5}[-\s\.]?[0-9]{1,6}$/;
    // if (!phoneRegex.test(phone)) { showError("Please enter a valid phone number"); return false; }

    if (!agreement) { showError("Please agree to be contacted"); return false; }

    return true;
}

// --- Submit ---
function submitForm() {
    const formData = {
        country:              $w('#countryDropdown').value,
        cities:               selectedCities.join(', '),
        zip_code:             $w('#zipCodeInput').value.trim(),
        neighbourhood:        $w('#neighbourhoodInput').value.trim(),
        property_type:        $w('#propertyTypeDropdown').value,
        min_rooms:            $w('#minRoomsInput').value.trim(),
        max_rooms:            $w('#maxRoomsInput').value.trim(),
        min_area:             $w('#minAreaInput').value.trim(),
        min_price:            $w('#minPriceInput').value.trim(),
        max_price:            $w('#maxPriceInput').value.trim(),
        comments:             $w('#commentsInput').value.trim(),
        name:                 $w('#nameInput').value.trim(),
        phone:                $w('#phoneInput').value.trim(),
        email:                $w('#emailInput').value.trim(),
        agreement_to_contact: $w('#agreementCheckbox').checked,
        status:               'Pending',
    };

    console.log('📝 Submitting form:', formData);

    goToState(4);
    $w('#submitButton').disable();
    $w('#submitButton').label = "Processing...";

    saveBuyRequestWithTranslations(formData)
        .then((result) => {
            if (result.success) {
                console.log("✅ Request saved:", result.id);
            } else {
                console.error("❌ Save failed:", result.error);
                showError(result.error);
                goToState(3);
            }
        })
        .catch((error) => {
            console.error("❌ Error:", error);
            showError("An error occurred. Please try again.");
            goToState(3);
        })
        .finally(() => {
            $w('#submitButton').enable();
            $w('#submitButton').label = "Submit";
        });
}