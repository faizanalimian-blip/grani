// ============================================================
//  PAGE CODE  —  Buy Requests Admin page
// ============================================================

import {
  getAllBuyRequests,
  getAllProperties,
  updateBuyRequest,
  updateBuyRequestStatus
} from 'backend/requests.web';

import {
  getCountries,
  getCitiesOfCountry
} from 'backend/csc.web';

// sendPropertyAssignmentEmail lives in the existing post.web.js
import { sendPropertyAssignmentEmail } from 'backend/post.web';

$w.onReady(async function () {
console.log(323123123123);
  const el = $w('#buyRequestsDashboard');
  console.log('[Page] $w.onReady fired, el:', el ? 'found' : 'NOT FOUND');

  el.setAttribute('username', 'Granit');
  el.setAttribute('initials', 'G');

  // ── Load all data in parallel ─────────────────────────────
  console.log('[Page] fetching requests, countries, properties...');
  const [requests, countries, properties] = await Promise.all([
    getAllBuyRequests().catch(err  => { console.error('[Page] getAllBuyRequests failed:', err);  return []; }),
    getCountries().catch(err       => { console.error('[Page] getCountries failed:', err);       return []; }),
    getAllProperties().catch(err   => { console.error('[Page] getAllProperties failed:', err);   return []; }),
  ]);

  console.log('[Page] requests:', requests.length, '| countries:', countries.length, '| properties:', properties.length);
  if (requests.length)   console.log('[Page] first request sample:', JSON.stringify(requests[0]));
  if (properties.length) console.log('[Page] first property sample:', JSON.stringify(properties[0]));

  console.log('[Page] setAttribute requests...');
  el.setAttribute('requests',   JSON.stringify(requests));
  console.log('[Page] setAttribute countries...');
  el.setAttribute('countries',  JSON.stringify(countries));
  console.log('[Page] setAttribute properties...');
  el.setAttribute('properties', JSON.stringify(properties));

  // ── Cities map ────────────────────────────────────────────
  if (countries.length) {
    const cityEntries = await Promise.all(
      countries.map(async (c) => {
        const cities = await getCitiesOfCountry(c.isoCode).catch(() => []);
        console.log('[Page] cities for', c.isoCode, ':', cities.length);
        return [c.isoCode, cities];
      })
    );
    console.log('[Page] setAttribute citiesmap...');
    el.setAttribute('citiesmap', JSON.stringify(Object.fromEntries(cityEntries)));
  }

  // ── Approve / Reject ──────────────────────────────────────
  el.on('statusChange', async (event) => {
    const { id, status } = event.detail;
    console.log('[Page] statusChange:', id, '→', status);
    try {
      const result = await updateBuyRequestStatus(id, status);
      console.log('[Page] updateBuyRequestStatus result:', result.success);
    } catch (err) {
      console.error('[Page] statusChange failed:', err);
    }
  });

  // ── Full edit save ────────────────────────────────────────
  el.on('saveRequest', async (event) => {
    const { request } = event.detail;
    console.log('[Page] saveRequest received:', JSON.stringify(request));
    try {
      const result = await updateBuyRequest(request);
      console.log('[Page] updateBuyRequest result:', result.success);
      if (!result.success) throw new Error(result.error);

      const updated = await getAllBuyRequests();
      console.log('[Page] re-fetched', updated.length, 'requests');
      el.setAttribute('requests', JSON.stringify(updated));
    } catch (err) {
      console.error('[Page] saveRequest failed:', err);
    }
  });

  // ── Assign properties + send email ────────────────────────
  el.on('assignProperties', async (event) => {
    const { requestId, propertyData, buyerName, buyerEmail } = event.detail;
    console.log('[Page] assignProperties — requestId:', requestId, '| buyer:', buyerEmail, '| properties:', propertyData?.length);

    if (!buyerEmail) {
      console.warn('[Page] assignProperties: no buyer email on this request — email skipped');
      return;
    }

    if (!propertyData || propertyData.length === 0) {
      console.warn('[Page] assignProperties: no property data — email skipped');
      return;
    }

    // Build property links string matching the old lightbox format
    const propertyLinks = propertyData
      .map(p => `- ${p.name}: ${p.url || 'N/A'}`)
      .join('\n');

    console.log('[Page] sending assignment email to:', buyerEmail);
    console.log('[Page] propertyLinks:\n', propertyLinks);

    try {
      const emailResult = await sendPropertyAssignmentEmail({
        email:         buyerEmail,
        name:          buyerName,
        propertyLinks: propertyLinks
      });
      console.log('[Page] sendPropertyAssignmentEmail result:', emailResult);
    } catch (err) {
      console.error('[Page] sendPropertyAssignmentEmail failed:', err);
    }
  });

});