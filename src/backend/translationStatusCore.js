import wixData from 'wix-data';

// ─────────────────────────────────────────────────────────────────────────────
// Keeps PropertyTranslations.status in step with Properties.status.
//
// Why this exists: a translation row copies `status` once, when it is created
// (translationCron.web.js). The KW7 sync later flips Properties.status to
// 'Pending' when a listing is sold or leaves the feed, but never touched the
// translation rows. Public search, the dropdowns and the property pages read
// PropertyTranslations with status = 'Approved', so removed listings stayed live.
//
// `db` is injectable so the logic can be tested without Wix.
// ─────────────────────────────────────────────────────────────────────────────

const OPTS = { suppressAuth: true };
const TRANSLATIONS = 'PropertyTranslations';

function chunk(arr, n) {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
}

/**
 * Set the status on every translation row of one property.
 * Only rows whose status differs are written. Returns the number changed.
 */
export async function setTranslationStatus(propertyId, status, db = wixData) {
    if (!propertyId || !status) return 0;
    const res = await db.query(TRANSLATIONS).eq('propertyId', propertyId).limit(100).find(OPTS);
    const stale = res.items.filter(r => r.status !== status);
    if (stale.length === 0) return 0;
    await db.bulkUpdate(TRANSLATIONS, stale.map(r => ({ ...r, status })), OPTS);
    return stale.length;
}

/**
 * Find (and optionally fix) translation rows that are still 'Approved' while
 * their property is 'Pending'. Only ever moves Approved -> Pending, never the
 * other way, so it can only hide listings, and a re-run is harmless.
 *
 * dryRun defaults to true: it reports and writes nothing.
 */
export async function demoteStaleTranslations({ dryRun = true, deadline = Date.now() + 45000 } = {}, db = wixData) {
    const out = {
        dryRun, propertiesChecked: 0, staleRows: 0, updatedRows: 0,
        sample: [], partial: false, errors: []
    };

    let page = await db.query('Properties').eq('status', 'Pending').limit(1000).find(OPTS);

    while (true) {
        const ids = page.items.map(p => p._id);
        out.propertiesChecked += ids.length;

        for (const group of chunk(ids, 100)) {
            if (Date.now() > deadline) { out.partial = true; return out; }

            const rows = await db.query(TRANSLATIONS)
                .hasSome('propertyId', group)
                .eq('status', 'Approved')
                .limit(1000)
                .find(OPTS);

            out.staleRows += rows.items.length;
            for (const r of rows.items) {
                if (out.sample.length < 10) {
                    out.sample.push({ propertyId: r.propertyId, language: r.language, title: r.title });
                }
            }

            if (!dryRun && rows.items.length > 0) {
                try {
                    const r = await db.bulkUpdate(TRANSLATIONS,
                        rows.items.map(x => ({ ...x, status: 'Pending' })), OPTS);
                    out.updatedRows += r.updated || 0;
                    if (r.errors && r.errors.length) {
                        out.errors.push(...r.errors.map(e => e.message || String(e)));
                    }
                } catch (err) {
                    out.errors.push(err.message);
                }
            }
        }

        if (!page.hasNext()) break;
        page = await page.next();
    }
    return out;
}
