import { Permissions, webMethod } from 'wix-web-module';
import { demoteStaleTranslations } from './translationStatusCore.js';

// Admin-only. Run from the Velo test panel, no parameters needed.
//   reconcileTranslationStatus()   -> dry run: reports, writes nothing
//   applyTranslationStatusFix()    -> real run: hides the stale translation rows
// Export the PropertyTranslations collection before the real run.
// If the result says partial: true, run applyTranslationStatusFix() again.

function wantsRealRun(options) {
    // The test panel may pass null, an object, or the JSON as a string.
    if (typeof options === 'string') {
        try { options = JSON.parse(options); } catch (e) { return false; }
    }
    return !!(options && options.dryRun === false);
}

export const reconcileTranslationStatus = webMethod(
    Permissions.Admin,
    async (options) => demoteStaleTranslations({ dryRun: !wantsRealRun(options) })
);

export const applyTranslationStatusFix = webMethod(
    Permissions.Admin,
    async () => demoteStaleTranslations({ dryRun: false })
);
