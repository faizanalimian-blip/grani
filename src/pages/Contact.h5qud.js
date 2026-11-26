import wixWindowFrontend from 'wix-window-frontend';

$w.onReady(function () {
    const currentLanguage = wixWindowFrontend.multilingual.currentLanguage;
    applyRTLLTR(currentLanguage);
});

function applyRTLLTR(lang) {
    const isRTL = lang === 'he';

    if (isRTL) {
        $w('#LTR1').collapse();
        $w('#LTR2').collapse();
        $w('#LTR3').collapse();
        $w('#RTL1').expand();
        $w('#RTL2').expand();
        $w('#RTL3').expand();
    } else {
        $w('#LTR1').expand();
        $w('#LTR2').expand();
        $w('#LTR3').expand();
        $w('#RTL1').collapse();
        $w('#RTL2').collapse();
        $w('#RTL3').collapse();
    }
}