// dashboardData_web.js
// Backend web method: returns everything the admin-dashboard custom element needs.
// Place in: backend/dashboardData.web.js
//
// Usage from page Velo:
//   import { getDashboardData } from 'backend/dashboardData.web.js';

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

export const getDashboardData = webMethod(
    Permissions.Anyone,
    async () => {
        try {

            // ── 1. Fetch ALL Properties in one paginated pass ─────────────────
            // 215 items fits in a single 1000-limit query, but we paginate
            // defensively in case the catalogue grows.
            let allProps = [];
            let skip = 0;
            const LIMIT = 1000;
            let hasMore = true;

            while (hasMore) {
                const res = await wixData
                    .query('Properties')
                    .descending('_createdDate')
                    .limit(LIMIT)
                    .skip(skip)
                    .find({ suppressAuth: true });

                allProps = allProps.concat(res.items);
                hasMore = res.items.length === LIMIT;
                skip += LIMIT;
            }

            // ── 2. Fetch Buy Requests (small collection) ─────────────────────
            const brRes = await wixData
                .query('BuyRequests')
                .limit(1000)
                .find({ suppressAuth: true });
            const allBR = brRes.items;

            // ── 3. Compute property stats ────────────────────────────────────

            const total     = allProps.length;
            let approved    = 0, pending = 0;
            let villaCount  = 0, aptCount = 0, otherCount = 0;
            let invCount    = 0, transCount = 0;
            let seaView     = 0, closeSea = 0;
            let cyprusCount = 0, greeceCount = 0;
            let prices      = [], villaPrices = [], aptPrices = [];
            let monthMap    = {};   // 'YYYY-MM' → count
            const priceBuckets = { u250: 0, u500: 0, u1m: 0, u2m: 0, over2m: 0 };
            const bedrooms  = { b1: 0, b2: 0, b3: 0, b4: 0, b5plus: 0 };
            const recentFeed = [];  // for feed items

            for (const p of allProps) {

                // Status
                const status = (p.status || '').toLowerCase();
                if (status === 'approved') approved++;
                else pending++;

                // Property type — stored as array e.g. ['Villa'] or ['Apartment']
                const types = Array.isArray(p.propertyType)
                    ? p.propertyType.map(t => t.toLowerCase())
                    : [(p.propertyType || '').toLowerCase()];
                const isVilla = types.some(t => t === 'villa');
                const isApt   = types.some(t => t === 'apartment' || t === 'penthouse' || t === 'studio');
                if      (isVilla) villaCount++;
                else if (isApt)   aptCount++;
                else              otherCount++;

                // Country — stored as array e.g. ['Cyprus']
                const countries = Array.isArray(p.country)
                    ? p.country.map(c => c.toLowerCase())
                    : [(p.country || '').toLowerCase()];
                if (countries.some(c => c.includes('cyprus'))) cyprusCount++;
                if (countries.some(c => c.includes('greece'))) greeceCount++;

                // Investment & translation
                const inv = Array.isArray(p.investmentOpportunity)
                    ? p.investmentOpportunity.some(v => v.toLowerCase() === 'yes')
                    : (p.investmentOpportunity || '').toLowerCase() === 'yes';
                if (inv) invCount++;
                if (p.translationsCompleted === true) transCount++;

                // Sea attributes
                if (p.seaView  === true) seaView++;
                if (p.closeToSea === true) closeSea++;

                // Price aggregation
                const price = parseFloat(p.minPrice) || 0;
                if (price > 0) {
                    prices.push(price);
                    if (isVilla) villaPrices.push(price);
                    if (isApt)   aptPrices.push(price);

                    if      (price < 250000)  priceBuckets.u250++;
                    else if (price < 500000)  priceBuckets.u500++;
                    else if (price < 1000000) priceBuckets.u1m++;
                    else if (price < 2000000) priceBuckets.u2m++;
                    else                      priceBuckets.over2m++;
                }

                // Bedroom distribution
                const beds = parseInt(p.minBedrooms) || 0;
                if      (beds <= 1) bedrooms.b1++;
                else if (beds === 2) bedrooms.b2++;
                else if (beds === 3) bedrooms.b3++;
                else if (beds === 4) bedrooms.b4++;
                else                 bedrooms.b5plus++;

                // Monthly additions
                const created = p._createdDate
                    ? new Date(p._createdDate)
                    : null;
                if (created) {
                    const ym = `${created.getFullYear()}-${String(created.getMonth()+1).padStart(2,'0')}`;
                    monthMap[ym] = (monthMap[ym] || 0) + 1;
                }

                // Feed (collect all, sort later)
                const typeLabel = Array.isArray(p.propertyType)
                    ? p.propertyType[0] || 'Property'
                    : (p.propertyType || 'Property');
                recentFeed.push({
                    title:  p.title || 'Untitled Property',
                    badge:  typeLabel,
                    date:   created ? created.toISOString().split('T')[0] : '',
                    _sort:  created ? created.getTime() : 0
                });
            }

            // ── 4. Aggregated numbers ─────────────────────────────────────────
            const avg  = v => v.length ? Math.round(v.reduce((a,b)=>a+b,0) / v.length) : 0;
            const avgPrice  = avg(prices);
            const avgVilla  = avg(villaPrices);
            const avgApt    = avg(aptPrices);
            const maxPrice  = prices.length ? Math.max(...prices) : 0;

            // ── 5. Monthly trend (last 8 active months) ───────────────────────
            const sortedMonths = Object.keys(monthMap).sort();
            const last8        = sortedMonths.slice(-8);

            const MONTH_NAMES = {
                '01':'Jan','02':'Feb','03':'Mar','04':'Apr',
                '05':'May','06':'Jun','07':'Jul','08':'Aug',
                '09':'Sep','10':'Oct','11':'Nov','12':'Dec'
            };
            const monthLabels = last8.map(ym => {
                const [yr, mo] = ym.split('-');
                return MONTH_NAMES[mo] + ' ' + yr.slice(2);  // e.g. "Dec 25"
            });
            const monthValues = last8.map(ym => monthMap[ym]);

            // ── 6. Buy requests ────────────────────────────────────────────────
            const buyTotal    = allBR.length;
            const buyApproved = allBR.filter(r => (r.status||'').toLowerCase() === 'approved').length;
            const buyPending  = allBR.filter(r => (r.status||'').toLowerCase() === 'pending').length;

            // ── 7. Price buckets for chart ─────────────────────────────────────
            const maxBucket = Math.max(...Object.values(priceBuckets));
            const priceBucketsArr = [
                { label:'<250K',     val: priceBuckets.u250,  max: maxBucket, colorClass:'bar-fill-gold',  tip:`<250K: ${priceBuckets.u250} properties &middot; ${pct(priceBuckets.u250, prices.length)}% of catalogue` },
                { label:'250K-500K', val: priceBuckets.u500,  max: maxBucket, colorClass:'bar-fill-gold',  tip:`250K-500K: ${priceBuckets.u500} properties &middot; ${pct(priceBuckets.u500, prices.length)}% of catalogue` },
                { label:'500K-1M',   val: priceBuckets.u1m,   max: maxBucket, colorClass:'bar-fill-ink',   tip:`500K-1M: ${priceBuckets.u1m} properties &middot; ${pct(priceBuckets.u1m, prices.length)}% of catalogue` },
                { label:'1M-2M',     val: priceBuckets.u2m,   max: maxBucket, colorClass:'bar-fill-amber', tip:`1M-2M: ${priceBuckets.u2m} properties &middot; ${pct(priceBuckets.u2m, prices.length)}% of catalogue` },
                { label:'>2M',       val: priceBuckets.over2m,max: maxBucket, colorClass:'bar-fill-muted', tip:`&gt;2M: ${priceBuckets.over2m} properties &middot; ${pct(priceBuckets.over2m, prices.length)}% of catalogue` }
            ];

            // ── 8. Bedroom buckets ─────────────────────────────────────────────
            const maxBed = Math.max(...Object.values(bedrooms));
            const bedroomBucketsArr = [
                { label:'1 BR',  val: bedrooms.b1,     max: maxBed, colorClass:'bar-fill-gold', tip:`1 BR: ${bedrooms.b1} properties &middot; ${pct(bedrooms.b1, total)}%` },
                { label:'2 BR',  val: bedrooms.b2,     max: maxBed, colorClass:'bar-fill-ink',  tip:`2 BR: ${bedrooms.b2} properties &middot; ${pct(bedrooms.b2, total)}%` },
                { label:'3 BR',  val: bedrooms.b3,     max: maxBed, colorClass:'bar-fill-gold', tip:`3 BR: ${bedrooms.b3} properties &middot; ${pct(bedrooms.b3, total)}%` },
                { label:'4 BR',  val: bedrooms.b4,     max: maxBed, colorClass:'bar-fill-ink',  tip:`4 BR: ${bedrooms.b4} properties &middot; ${pct(bedrooms.b4, total)}%` },
                { label:'5+ BR', val: bedrooms.b5plus, max: maxBed, colorClass:'bar-fill-muted',tip:`5+ BR: ${bedrooms.b5plus} properties &middot; ${pct(bedrooms.b5plus, total)}%` }
            ];

            // ── 9. Feed (6 most recent) ────────────────────────────────────────
            const FEED_ICONS = ['🏠','🌊','🏢','🌿','🏡','🛖'];
            const feedItems = recentFeed
                .sort((a, b) => b._sort - a._sort)
                .slice(0, 6)
                .map((item, i) => ({
                    emoji: FEED_ICONS[i % 6],
                    title: item.title,
                    badge: item.badge,
                    date:  item.date
                }));

            // ── 10. Quick stats ────────────────────────────────────────────────
            const translationCount = allProps.length * 3; // EN + DE + HE
            const quickStats = [
                { num: seaView,           label: 'Sea View',    tip: 'Properties with sea view tag' },
                { num: closeSea,          label: 'Sea Front',   tip: 'Properties close to the sea' },
                { num: translationCount,  label: 'Translations',tip: `${translationCount} translation records across ${transCount} properties × 3 languages` },
                { num: 3,                 label: 'Languages',   tip: 'English, German and Hebrew' }
            ];

            // ── 11. Assemble final payload ─────────────────────────────────────
            return {
                success: true,
                db: {
                    totalProperties:   total,
                    approved:          approved,
                    pending:           pending,
                    villaCount:        villaCount,
                    aptCount:          aptCount,
                    otherCount:        otherCount,
                    avgPrice:          avgPrice,
                    avgVilla:          avgVilla,
                    avgApt:            avgApt,
                    maxPrice:          maxPrice,
                    invOpportunity:    invCount,
                    transComplete:     transCount,
                    buyTotal:          buyTotal,
                    buyApproved:       buyApproved,
                     buyPending:        buyPending, 
                    cyprus:            cyprusCount,
                    greece:            greeceCount,
                    monthLabels:       monthLabels,
                    monthValues:       monthValues,
                    priceBuckets:      priceBucketsArr,
                    bedroomBuckets:    bedroomBucketsArr,
                    quickStats:        quickStats
                },
                feed: feedItems
            };

        } catch (err) {
            console.error('[dashboardData] error:', err);
            return { success: false, error: err.message };
        }
    }
);

// ── helper ──────────────────────────────────────────────────────────────────
function pct(v, total) {
    return total ? Math.round(v / total * 1000) / 10 : 0;
}