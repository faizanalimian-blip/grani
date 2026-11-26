import wixWindowFrontend from "wix-window-frontend";
import wixLocation from "wix-location";
import { savePropertyWithTranslations } from 'backend/optimisedTranslate.web.js';
import {
    getCountries,
    getstatesByCountryCode,
    getCitiesOfState
} from 'backend/csc.web.js';

let sourceLanguage = wixWindowFrontend.multilingual.currentLanguage; // "en"
let requestId = null;
let uploadedGalleryFiles = []; // Store uploaded file URLs

$w.onReady(function () {
    // Get data passed from the opening page
    const context = wixWindowFrontend.lightbox.getContext();

    if (context && context.requestId) {
        requestId = context.requestId;
        console.log("Creating offer for request:", requestId);
        setupForm();
    } else {
        setupForm();
    }

    $w('#stateDropdown').disable();
    $w('#cityDropdown').disable();

    // Load countries
    loadCountries();

    // Country selection handler
    $w('#countryDropdown').onChange(() => {
        const countryCode = $w('#countryDropdown').value;
        $w('#stateDropdown').enable();
        $w('#cityDropdown').disable();
        $w('#cityDropdown').options = [];
        loadStates(countryCode);
    });

    // State selection handler
    $w('#stateDropdown').onChange(() => {
        const countryCode = $w('#countryDropdown').value;
        const stateCode = $w('#stateDropdown').value;
        $w('#cityDropdown').enable();
        loadCities(countryCode, stateCode);
    });
});

async function loadCountries() {
    const countries = await getCountries();
    $w('#countryDropdown').options = countries.map(c => ({
        label: c.name,
        value: c.isoCode
    }));
}

async function loadStates(countryCode) {
    const states = await getstatesByCountryCode(countryCode);
    $w('#stateDropdown').options = states.map(s => ({
        label: s.name,
        value: s.isoCode
    }));
}

async function loadCities(countryCode, stateCode) {
    const cities = await getCitiesOfState(countryCode, stateCode);
    $w('#cityDropdown').options = cities.map(c => ({
        label: c.name,
        value: c.name
    }));
}

function setupForm() {
    $w('#errorText').hide();

    // Submit button handler
    $w('#submitButton').onClick(() => {
        // submitOffer();
        if (validateForm()) {
            submitOffer();
        }
    });

    // Gallery upload handler
    $w('#galleryUploadButton').onChange(() => {
        if ($w("#galleryUploadButton").value.length > 0) {
            console.log(
                "Files selected for upload:",
                $w("#galleryUploadButton").value.map(file => file.name)
            );

            // Reset the array before uploading new files
            uploadedGalleryFiles = []; // Clear previous files

            $w("#galleryUploadButton").uploadFiles()
                .then(uploadedFiles => {
                    uploadedFiles.forEach(uploadedFile => {
                        console.log('File url:', uploadedFile.fileUrl);
                        uploadedGalleryFiles.push(uploadedFile.fileUrl);
                    });
                    console.log("Gallery upload successful. Total files:", uploadedGalleryFiles.length);
                })
                .catch(uploadError => {
                    console.log("File upload error: " + uploadError.errorCode);
                    console.log(uploadError.errorDescription);
                    $w('#errorText').text = "Failed to upload files. Please try again.";
                    $w('#errorText').show();
                });
        } else {
            console.log("No files selected.");
        }
    });

}

function validateForm() {
    let isValid = true;
    let errorMessage = '';

    // General property fields
    const propertyTitle = $w('#propertyTitleInput').value.trim();
    const propertyType = $w('#propertyTypeDropdown').value;
    const dealType = $w('#dealTypeDropdown').value;
    const investmentOpportunity = $w('#investmentOpportunityDropdown').value;
const neighbourhood = $w('#neighbourhoodInput').value.trim();
    // Location fields
    const country = $w('#countryDropdown').value.trim();
    const city = $w('#cityDropdown').value.trim();
    const state = $w('#stateDropdown').value.trim();
    const address = $w('#addressInput').value;
    const zipCode = $w('#zipCodeInput').value.trim();

    // Property details
    const minPrice = $w('#minPriceInput').value.trim();
    const maxPrice = $w('#maxPriceInput').value.trim();
    const commission = $w('#commissionInput').value.trim();
    const minBedrooms = $w('#minBedroomsInput').value.trim();
    const maxBedrooms = $w('#maxBedroomsInput').value.trim();
    const plotArea = $w('#plotAreaInput').value.trim();
    const shortDescription = $w('#shortDescriptionInput').value.trim();
    const description = $w('#descriptionInput').value.trim();

    // Developer fields
    const developerName = $w('#developerNameInput').value.trim();
    const projectName = $w('#projectNameInput').value.trim();
    const availableDate = $w('#availableDatePicker').value;
    const deliveryTime = $w('#deliveryTimeInput').value.trim();
    const email = $w('#emailInput').value.trim();

    // Agreement
    const agreement = $w('#agreementCheckbox').checked;
  

    // Validations
    if (!propertyTitle) errorMessage = 'Please enter property title';
    else if (!propertyType) errorMessage = 'Please select property type';
    else if (!$w('#propertyStatusDropdown').value) errorMessage = 'Please select a property status';
    else if (!dealType) errorMessage = 'Please select deal type';
    else if (!investmentOpportunity) errorMessage = 'Please select investment opportunity';
    else if (!country) errorMessage = 'Please enter country';
    else if (!city) errorMessage = 'Please enter city';
    else if (!state) errorMessage = 'Please enter state';
    else if (!address) errorMessage = 'Please enter address';
    else if (!neighbourhood) errorMessage = 'Please enter neighbourhood';
    else if (!zipCode) errorMessage = 'Please enter zip code';
    else if (!minPrice) errorMessage = 'Please enter minimum price';
    else if (isNaN(parseFloat(minPrice))) errorMessage = 'Please enter a valid minimum price';
    else if (!maxPrice) errorMessage = 'Please enter maximum price';
    else if (isNaN(parseFloat(maxPrice))) errorMessage = 'Please enter a valid maximum price';
    else if (parseFloat(minPrice) > parseFloat(maxPrice)) errorMessage = 'Minimum price cannot be greater than maximum price';
    else if (!commission) errorMessage = 'Please enter commission';
    else if (isNaN(parseFloat(commission))) errorMessage = 'Please enter a valid commission percentage';
    else if (!minBedrooms) errorMessage = 'Please enter minimum bedrooms';
    else if (isNaN(parseInt(minBedrooms))) errorMessage = 'Please enter a valid number for minimum bedrooms';
    else if (!maxBedrooms) errorMessage = 'Please enter maximum bedrooms';
    else if (isNaN(parseInt(maxBedrooms))) errorMessage = 'Please enter a valid number for maximum bedrooms';
    else if (parseInt(minBedrooms) > parseInt(maxBedrooms)) errorMessage = 'Minimum bedrooms cannot be greater than maximum bedrooms';
    else if (!plotArea) errorMessage = 'Please enter plot area';
    else if (isNaN(parseFloat(plotArea))) errorMessage = 'Please enter a valid plot area';
    else if (uploadedGalleryFiles.length === 0) errorMessage = 'Please upload at least one image for gallery';
    else if (!shortDescription) errorMessage = 'Please enter short description';
    else if (!description) errorMessage = 'Please enter description';
    else if (!developerName) errorMessage = 'Please enter developer name';
    else if (!projectName) errorMessage = 'Please enter project name';
    else if (!availableDate) errorMessage = 'Please select available date';
    else if (!deliveryTime) errorMessage = 'Please enter delivery time';
    else if (!email) errorMessage = 'Please enter email address';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errorMessage = 'Please enter a valid email address';
    
    else if (!agreement) errorMessage = 'Please agree to the terms';
    if (containsUnsupportedScript(propertyTitle) || 
        containsUnsupportedScript(description) || 
        containsUnsupportedScript(shortDescription)) {
        
        errorMessage = 'Please use English, Hebrew, or German only. Other languages are not supported. For Property Title, Short Description and Description fields only.';
        $w('#errorText').text = errorMessage;
        $w('#errorText').show();
        return false;
    }
    

    if (errorMessage) {
        $w('#errorText').text = errorMessage;
        $w('#errorText').show();
        isValid = false;
    } else {
        $w('#errorText').hide();
    }

    return isValid;
}

function submitOffer() {
    // Resolve ISO codes back to full names before saving
    const countryCode = $w('#countryDropdown').value.trim();
    const stateCode = $w('#stateDropdown').value.trim();
    const countryOptions = $w('#countryDropdown').options;
    const stateOptions = $w('#stateDropdown').options;
    const countryName = (countryOptions.find(o => o.value === countryCode) || {}).label || countryCode;
    const stateName = (stateOptions.find(o => o.value === stateCode) || {}).label || stateCode;

    const offerData = {
        request_id: requestId,
        property_title: $w('#propertyTitleInput').value.trim(),
        property_type: $w('#propertyTypeDropdown').value,
        deal_type: $w('#dealTypeDropdown').value,
        investment_opportunity: $w('#investmentOpportunityDropdown').value,
        country: countryName,
        city: $w('#cityDropdown').value.trim(),
        state: stateName,
        address: $w('#addressInput').value,
        zip_code: parseFloat($w('#zipCodeInput').value.trim()),
        min_price: parseFloat($w('#minPriceInput').value) || 0,
        max_price: parseFloat($w('#maxPriceInput').value) || 0,
        commission: parseFloat($w('#commissionInput').value) || 0,
        neighbourhood: $w('#neighbourhoodInput').value.trim(),
        min_bedrooms: parseInt($w('#minBedroomsInput').value) || 0,
        max_bedrooms: parseInt($w('#maxBedroomsInput').value) || 0,
        plot_area: parseFloat($w('#plotAreaInput').value) || 0,
        gallery: uploadedGalleryFiles,
        short_description: $w('#shortDescriptionInput').value.trim(),
        description: $w('#descriptionInput').value.trim(),
        developer_name: $w('#developerNameInput').value.trim(),
        project_name: $w('#projectNameInput').value.trim(),
        available_date: $w('#availableDatePicker').value,
        delivery_time: $w('#deliveryTimeInput').value.trim(),
        email: $w('#emailInput').value.trim(),
        agreement: $w('#agreementCheckbox').checked,
        property_status: $w('#propertyStatusDropdown').value || null,
        close_to_sea: $w('#closeToSeaCheckbox').checked,
        sea_view: $w('#seaViewCheckbox').checked,
        status: 'Pending'
    };

    $w('#submitButton').disable();
    $w('#submitButton').label = "Submitting...";

    savePropertyWithTranslations(offerData, sourceLanguage)
        .then(result => {
            if (result.success) {
                console.log("Offer submitted successfully:", result.id);
                showSuccessMessage();
                setTimeout(() => {
                    uploadedGalleryFiles = [];
                    wixWindowFrontend.lightbox.close();
                   //  wixLocation.to('/property-offer-created');
                }, 2000);
            } else {
                console.error("Offer submission failed:", result.error);
                $w('#errorText').text = "Failed to submit offer. Please try again.";
                $w('#errorText').show();
                $w('#submitButton').enable();
                $w('#submitButton').label = "Submit";
            }
        })
        .catch(error => {
            console.error("Error submitting offer:", error);
            $w('#errorText').text = "An error occurred. Please try again.";
            $w('#errorText').show();
            $w('#submitButton').enable();
            $w('#submitButton').label = "Submit";
        });
}

function showSuccessMessage() {
    $w('#errorText').text = "Form data collected successfully";
    $w('#errorText').style.color = "#3D9BE9";
    $w('#errorText').show();
}

 

function containsUnsupportedScript(text) {
    // Block specific script ranges we DON'T support
    const unsupportedScripts = [
        /[\u0600-\u06FF]/,   // Arabic (includes Urdu, Persian)
        /[\u0900-\u097F]/,   // Devanagari (Hindi, Sanskrit)
        /[\u0980-\u09FF]/,   // Bengali
        /[\u0A00-\u0A7F]/,   // Gurmukhi (Punjabi)
        /[\u0C00-\u0C7F]/,   // Telugu
        /[\u0C80-\u0CFF]/,   // Kannada
        /[\u0D00-\u0D7F]/,   // Malayalam
        /[\u4E00-\u9FFF]/,   // Chinese (CJK)
        /[\u3040-\u309F]/,   // Japanese Hiragana
        /[\u30A0-\u30FF]/,   // Japanese Katakana
        /[\uAC00-\uD7AF]/,   // Korean
        /[\u0400-\u04FF]/,   // Cyrillic (Russian, etc.)
        /[\u0E00-\u0E7F]/,   // Thai
        /[\u1780-\u17FF]/,   // Khmer
    ];
    
    return unsupportedScripts.some(regex => regex.test(text));
}