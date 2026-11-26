import { Permissions, webMethod } from 'wix-web-module';
import { demoteStaleTranslations } from './translationStatusCore.js';

// Admin-only. Run from the Velo test panel or a temporary admin call.
//   reconcileTranslationStatus()                 -> dry run, writes nothing
//   reconcileTranslationStatus({ dryRun: false }) -> hides the stale translation rows
// Export the PropertyTranslations collection before the first real run.
export const reconcileTranslationStatus = webMethod(
    Permissions.Admin,
    async (options) => {
        // The Velo test panel passes null when the parameter is left empty.
        const dryRun = !(options && options.dryRun === false);
        return demoteStaleTranslations({ dryRun });
    }
);
