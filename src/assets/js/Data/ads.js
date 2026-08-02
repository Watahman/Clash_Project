(() => {
    'use strict';

    const SCRIPT_ID = 'clashtools-google-ads';
    const CLIENT_ID = 'ca-pub-7361256415342967';

    function loadAds() {
        if (document.getElementById(SCRIPT_ID)) return;
        if (navigator.connection?.saveData) return;
        if (document.visibilityState === 'hidden') return;

        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT_ID}`;
        document.head.append(script);
    }

    function loadAdsWhenIdle() {
        const run = () => loadAds();
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(run, { timeout: 1500 });
        } else {
            run();
        }
    }

    function scheduleAds() {
        // Give the product UI priority. Engaged visitors load ads on their first
        // interaction; passive visitors still load them after a bounded delay.
        ['pointerdown', 'touchstart', 'keydown'].forEach(type => {
            window.addEventListener(type, loadAdsWhenIdle, { once: true, passive: true });
        });
        window.setTimeout(loadAdsWhenIdle, 12000);
    }

    if (document.readyState === 'complete') scheduleAds();
    else window.addEventListener('load', scheduleAds, { once: true });
})();
