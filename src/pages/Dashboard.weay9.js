// Dashboard_Page  —  Wix Velo page code
// ============================================================
// This runs in the Wix page context and has full access to
// wixData (via the backend method) and $w (the page's elements).
//
// What this does:
//   1. Calls getDashboardData() — backend queries Properties +
//      BuyRequests and returns every aggregate the dashboard needs.
//   2. Pushes the result to the <admin-dashboard> custom element
//      via setAttribute('data', JSON) and setAttribute('feed', JSON).
//   3. Listens for the 'navigate' event fired by the element when
//      the user clicks a KPI card, and navigates to the right page.
//
// Wix Editor setup:
//   - Add a Custom Element to the page, set the tag to: admin-dashboard
//   - Give it the ID:  #adminDashboard
//   - Set its initial height large enough (e.g. 2000px) — it
//     will self-resize via ResizeObserver once content renders.
//
// Import path — backend file lives at:
//   backend/dashboardData.web.js
// ============================================================

import { getDashboardData } from 'backend/dashboardData.web.js';
import wixLocation from 'wix-location';

$w.onReady(async function () {
console.log("ffffffffffffffffffff");
    const el = $w('#adminDashboard');

    // ── Push username / initials immediately (no DB call needed) ──────────
    // Replace these with real member data if you use Wix Members Auth.
    el.setAttribute('username', 'Granit');
    el.setAttribute('initials', 'G');

    // ── Listen for navigation events from the custom element ───────────────
    // The element fires: new CustomEvent('navigate', { detail: { page } })
    // where page is 'offers' or 'requests'.
    el.on('navigate', event => {
        const page = event.detail?.page;
        if (page === 'offers')   wixLocation.to('/property-offer-dashboard');
        if (page === 'requests') wixLocation.to('/buy-request-dashboard');
    });

    // ── Fetch live data from backend ───────────────────────────────────────
    try {
        const result = await getDashboardData();

        if (!result.success) {
            console.error('[Dashboard] getDashboardData failed:', result.error);
            // The custom element already shows mock data as fallback — no
            // further action needed; the user still sees a working dashboard.
            return;
        }

        // Push real data — attributeChangedCallback fires inside the element,
        // calls Object.assign(this._db, parsed) then this._refresh().
        el.setAttribute('data', JSON.stringify(result.db));
        el.setAttribute('feed', JSON.stringify(result.feed));

        console.log('[Dashboard] Live data pushed — ' + result.db.totalProperties + ' properties');

    } catch (err) {
        // Network / timeout error — mock data stays in place, log for debug.
        console.error('[Dashboard] fetch exception:', err);
    }
});