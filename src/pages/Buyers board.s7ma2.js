import { getApprovedRequestsPaginated, getRequestDetails } from 'backend/post.web.js';
import wixWindowFrontend from 'wix-window-frontend';

let currentPage = 1;
let totalPages = 1;
const itemsPerPage = 3;
const currentLanguage = wixWindowFrontend.multilingual.currentLanguage;

$w.onReady(function () {
    loadApprovedRequests(currentPage);
    setupPaginationHandlers();
});

function setupPaginationHandlers() {
    $w('#pagination1').onChange(() => {
        currentPage = $w('#pagination1').currentPage;
        
        // Scroll to top of repeater box smoothly
        $w('#text158').scrollTo();
        
        loadApprovedRequests(currentPage);
    });
}

function loadApprovedRequests(page) {
    // Show loading state
    //$w('#loadingText').expand();
    $w('#repeater').collapse();
    //$w('#noResults').collapse();
    //$w('#repBox').collapse();
    $w('#pagination1').collapse();

    getApprovedRequestsPaginated(page, itemsPerPage,currentLanguage)
        .then((result) => {
            // Hide loading
            //$w('#loadingText').collapse();
            
            if (result.success) {
                console.log(`Loaded page ${page}:`, result.data.length, "requests");
                
                totalPages = result.totalPages;
                
                if (result.data.length === 0) {
                    // Show no results message
                    //$w('#noResults').expand();
                    //$w('#repBox').collapse();
                    $w('#pagination1').collapse();
                } else {
                    // Show data
                    //$w('#noResults').collapse();
                    //$w('#repBox').expand();
                    
                    // Update pagination element
                    $w('#pagination1').totalPages = totalPages;
                    $w('#pagination1').currentPage = page;
                    $w('#pagination1').expand();
                    
                    populateRepeater(result.data);
                }
            } else {
                console.error("Failed to load requests:", result.error);
                // Show error state
                //$w('#noResults').expand();
                //$w('#loadingText').collapse();
            }
        })
        .catch((error) => {
            console.error("Error loading requests:", error);
            // Show error state
            //$w('#loadingText').collapse();
            //$w('#noResults').expand();
        });
}

function populateRepeater(data) {
    $w('#repeater').data = data;

    $w('#repeater').onItemReady(($item, itemData) => {
        $item('#nameText').text = itemData.name;
        $item('#cityText').text = itemData.city;
        $item('#priceRangeText').text = itemData.priceRange;
        $item('#statusText').text = itemData.status;
        
        // Additional fields
        $item('#propertyTypeText').text = itemData.property_type;
        $item('#roomsText').text = itemData.roomsText;
        $item('#minAreaText').text = itemData.min_area;
        $item('#commentsText').text = itemData.comments;

        $item('#createOfferButton').onClick(() => {
            wixWindowFrontend.openLightbox("Create Offer", { requestId: itemData._id });
        });
    });

    $w('#repeater').expand();
}