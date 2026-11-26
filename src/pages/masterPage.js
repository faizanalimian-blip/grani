// masterPage.js
import wixWindowFrontend from 'wix-window-frontend';

$w.onReady(function () {
    const currentLang = wixWindowFrontend.multilingual.currentLanguage;
    console.log('masterPage — currentLang:', currentLang);
    applyHeader(currentLang);
});

function applyHeader(lang) {
    if (lang === 'he') {
        $w('#headerLTR').collapse();
        $w('#footerLTR').collapse();
        $w('#headerRTL').expand();
        $w('#footerRTL').expand();
    } else {
        $w('#headerRTL').collapse();
        $w('#footerRTL').collapse();
        $w('#headerLTR').expand();
        $w('#footerLTR').expand();
    }
}