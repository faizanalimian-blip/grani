import wixWindowFrontend from 'wix-window-frontend';
import wixLocation from 'wix-location';
import { getHotelShowcaseProperties } from 'backend/search.web.js';

$w.onReady(async function () {
    const currentLanguage = wixWindowFrontend.multilingual.currentLanguage;
    applyRTLLTR(currentLanguage);

    const result = await getHotelShowcaseProperties(currentLanguage);
    if (result.success && result.data.length > 0) {
        populateHotelSlots(result.data);
    }
});

function applyRTLLTR(lang) {
    const isRTL = lang === 'he';

    if (isRTL) {
        $w('#LTR1').collapse();
        $w('#LTR2').collapse();
        $w('#LTR3').collapse();
        $w('#LTR4').collapse();
        $w('#RTL1').expand();
        $w('#RTL2').expand();
        $w('#RTL3').expand();
        $w('#RTL4').expand();
    } else {
        $w('#LTR1').expand();
        $w('#LTR2').expand();
        $w('#LTR3').expand();
        $w('#LTR4').expand();
        $w('#RTL1').collapse();
        $w('#RTL2').collapse();
        $w('#RTL3').collapse();
        $w('#RTL4').collapse();
    }
}

// ── Populate all 4 slots — both LTR and RTL sets get the same data ─────
function populateHotelSlots(hotels) {
    for (let i = 0; i < 4; i++) {
        const slot = i + 1;
        const hotel = hotels[i];

        if (!hotel) continue; // no data for this slot — leave elements as designed in editor

        populateSlot(slot, hotel, '');
        populateSlot(slot, hotel, 'RTL');
    }
}

function populateSlot(slot, hotel, suffix) {
    const el = base => { try { return $w(`#${base}${slot}${suffix}`); } catch (e) { return null; } };

    if (el('hotelImage')) el('hotelImage').src = hotel.image;

    if (el('hotelTitle')) el('hotelTitle').text = hotel.title;

    if (el('hotelDescription')) el('hotelDescription').text = hotel.description;

    if (el('hotelLocation')) el('hotelLocation').text = hotel.locationText;

    if (el('hotelHighlights')) el('hotelHighlights').text = hotel.highlights;

    if (el('hotelPrice')) el('hotelPrice').text = formatPriceRange(hotel.minPrice, hotel.maxPrice);

    if (el('hotelDetailButton')) {
        el('hotelDetailButton').onClick(() => {
            wixLocation.to(hotel.url);
        });
    }
}

// ── Format helper ──────────────────────────────────────────
function formatPriceRange(minPrice, maxPrice) {
    const fmt = p => {
        if (!p) return null;
        if (p >= 1000000) return `€${(p / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
        if (p >= 1000)    return `€${Math.round(p / 1000)}K`;
        return `€${p}`;
    };
    const min = fmt(minPrice);
    const max = fmt(maxPrice);
    if (min && max && minPrice !== maxPrice) return `${min} - ${max}`;
    return min || max || 'Contact for Price';
}