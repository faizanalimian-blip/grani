// ============================================================
//  backend/requests.web.js
//  Sharon Homes — Buy Requests backend web methods
// ============================================================

import { webMethod, Permissions } from 'wix-web-module';
import wixData from 'wix-data';

const COL_REQUESTS      = 'BuyRequests';
const COL_REQ_TRANS     = 'BuyRequestTranslations';
const COL_PROPERTIES    = 'PropertyTranslations';

// ── Helpers ───────────────────────────────────────────────────

const _lcStatus = s => (s || 'pending').toLowerCase();
const _ucStatus = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : 'Pending';

function _fromItem(item, index) {
  return {
    id:            item._id,
    num:           index + 1,
    buyerName:     item.name             ?? '',
    email:         item.email            ?? '',
    phone:         item.phone            ?? '',
    country:       item.country          ?? '',
    city:          item.cities           ?? '',
    neighbourhood: item.neighbourhood    ?? '',
    propertyType:  item.property_type    ?? '',
    minBeds:       item.min_rooms  ? Number(item.min_rooms)  : null,
    maxBeds:       item.max_rooms  ? Number(item.max_rooms)  : null,
    minArea:       item.min_area   ? Number(item.min_area)   : null,
    minPrice:      item.min_price  ? Number(item.min_price)  : null,
    maxPrice:      item.max_price  ? Number(item.max_price)  : null,
    status:        _lcStatus(item.status),
    date:          item._createdDate
                     ? new Date(item._createdDate).toISOString().split('T')[0]
                     : '',
    comments:      item.comments         ?? '',
  };
}

function _toItem(request) {
  return {
    _id:           request.id,
    name:          request.buyerName     || '',
    country:       request.country       || '',
    cities:        request.city          || '',
    neighbourhood: request.neighbourhood || '',
    property_type: request.propertyType  || '',
    min_rooms:     request.minBeds  != null ? String(request.minBeds)  : null,
    max_rooms:     request.maxBeds  != null ? String(request.maxBeds)  : null,
    min_area:      request.minArea  != null ? String(request.minArea)  : null,
    min_price:     request.minPrice != null ? String(request.minPrice) : null,
    max_price:     request.maxPrice != null ? String(request.maxPrice) : null,
    status:        _ucStatus(request.status),
    comments:      request.comments      || '',
  };
}

/** Sync status to all BuyRequestTranslations rows for a given request */
async function _syncTranslationStatus(requestId, ucStatus) {
  try {
    const trans = await wixData.query(COL_REQ_TRANS)
      .eq('buyRequestId', requestId)
      .find({ suppressAuth: true });

    if (trans.items.length > 0) {
      await Promise.all(trans.items.map(t => {
        t.status = ucStatus;
        return wixData.update(COL_REQ_TRANS, t, { suppressAuth: true });
      }));
      console.log(`[requests.web] synced ${trans.items.length} translation(s) → ${ucStatus}`);
    }
  } catch (err) {
    // Non-fatal — log and continue
    console.error('[requests.web] _syncTranslationStatus error:', err);
  }
}

// ── Web methods ───────────────────────────────────────────────

export const getAllBuyRequests = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const result = await wixData
        .query(COL_REQUESTS)
        .descending('_createdDate')
        .limit(200)
        .find({ suppressAuth: true });

      return result.items.map(_fromItem);
    } catch (err) {
      console.error('[requests.web] getAllBuyRequests error:', err);
      return [];
    }
  }
);

/**
 * Full edit save.
 * If comments changed → invalidates translations (cron recreates them).
 * Always syncs status to translation rows.
 */
export const updateBuyRequest = webMethod(
  Permissions.Anyone,
  async (request) => {
    try {
      // Get current record to detect comment changes
      const existing = await wixData.get(COL_REQUESTS, request.id, { suppressAuth: true });
      if (!existing) throw new Error(`Item ${request.id} not found`);

      const commentsChanged = request.comments !== undefined && request.comments !== existing.comments;

      const item = _toItem(request);

      // If comments changed, queue for re-translation (same pattern as old updateBuyRequestWithTranslations)
      if (commentsChanged) {
        item.translationsCompleted = false;
        item.translationError      = null;
        item.sourceLanguage        = null;
      }

      const result = await wixData.update(COL_REQUESTS, item, { suppressAuth: true });

      // Sync status to translation rows
      await _syncTranslationStatus(request.id, _ucStatus(request.status));

      // If comments changed, delete stale translations so cron recreates them
      if (commentsChanged) {
        const old = await wixData.query(COL_REQ_TRANS)
          .eq('buyRequestId', request.id)
          .find({ suppressAuth: true });

        if (old.items.length > 0) {
          await wixData.bulkRemove(COL_REQ_TRANS, old.items.map(t => t._id), { suppressAuth: true });
          console.log(`[requests.web] removed ${old.items.length} stale translation(s) for re-queue`);
        }
      }

      return { success: true, item: _fromItem(result, 0) };
    } catch (err) {
      console.error('[requests.web] updateBuyRequest error:', err);
      return { success: false, error: err.message || String(err) };
    }
  }
);

/**
 * Status-only update (approve / reject).
 * Syncs status to BuyRequestTranslations rows.
 */
export const updateBuyRequestStatus = webMethod(
  Permissions.Anyone,
  async (id, status) => {
    try {
      const current = await wixData.get(COL_REQUESTS, id, { suppressAuth: true });
      if (!current) throw new Error(`Item ${id} not found`);

      const ucStatus  = _ucStatus(status);
      current.status  = ucStatus;
      const result    = await wixData.update(COL_REQUESTS, current, { suppressAuth: true });

      // Mirror status to all translation rows
      await _syncTranslationStatus(id, ucStatus);

      return { success: true, item: _fromItem(result, 0) };
    } catch (err) {
      console.error('[requests.web] updateBuyRequestStatus error:', err);
      return { success: false, error: err.message || String(err) };
    }
  }
);

/**
 * Properties for the Assign modal.
 * Queries PropertyTranslations (isSource=true) for richest field set.
 * Includes the public property URL for the assignment email.
 */
export const getAllProperties = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const result = await wixData
        .query(COL_PROPERTIES)
        .eq('isSource', true)
        .ascending('title')
        .limit(500)
        .find({ suppressAuth: true });

      const BASE = 'https://www.sharon-homes.com';

      return result.items.map(item => {
        // Resolve public URL — try known link fields in order
        const linkPath = item['link-property-translations-title']
                      || item['link-property-translations-title-2']
                      || item['link-property-translations-all']
                      || null;
        const url = linkPath
          ? `${BASE}${linkPath.startsWith('/') ? '' : '/'}${linkPath}`
          : '';

        return {
          id:          item.propertyId  || item._id,
          name:        item.title       || item.projectName || '',
          type:        Array.isArray(item.propertyType)
                         ? item.propertyType[0]
                         : (item.propertyType || ''),
          city:        item.stateCity   || item.neighbourhood || '',
          country:     Array.isArray(item.country)
                         ? item.country[0]
                         : (item.country || ''),
          address:     item.address?.formatted || '',
          zip:         item.zipCode     ? String(item.zipCode) : '',
          dealType:    Array.isArray(item.dealType)
                         ? item.dealType.join(', ')
                         : (item.dealType || ''),
          investment:  Array.isArray(item.investmentOpportunity)
                         ? item.investmentOpportunity.join(', ')
                         : '',
          status:      item.propertyStatus || item.status || '',
          price:       null,
          minPrice:    item.minPrice    ?? null,
          maxPrice:    item.maxPrice    ?? null,
          commission:  item.commission  || null,
          minBeds:     item.minBedrooms ?? null,
          maxBeds:     item.maxBedrooms ?? null,
          plotArea:    item.plotArea    ? `${item.plotArea} m\u00b2` : 'N/A',
          coveredArea: 'N/A',
          url,                                        // ← used in assignment email
        };
      });
    } catch (err) {
      console.error('[requests.web] getAllProperties error:', err);
      return [];
    }
  }
);