(() => {
    'use strict';

    const MEASUREMENT_ID = 'G-78TY2WB7CS';
    const SCRIPT_ID = 'clashtools-google-analytics';

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() {
        window.dataLayer.push(arguments);
    };

    // Keep optional storage disabled until the configured CMP provides a choice.
    window.gtag('consent', 'default', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
        wait_for_update: 2000
    });
    window.gtag('js', new Date());
    window.gtag('config', MEASUREMENT_ID);

    function loadAnalytics() {
        if (document.getElementById(SCRIPT_ID)) return;
        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
        document.head.append(script);
    }

    function loadAnalyticsWhenIdle() {
        const run = () => loadAnalytics();
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(run, { timeout: 1500 });
        } else {
            run();
        }
    }

    function scheduleAnalytics() {
        ['pointerdown', 'touchstart', 'keydown'].forEach(type => {
            window.addEventListener(type, loadAnalyticsWhenIdle, { once: true, passive: true });
        });
        window.setTimeout(loadAnalyticsWhenIdle, 12000);
    }

    if (document.readyState === 'complete') scheduleAnalytics();
    else window.addEventListener('load', scheduleAnalytics, { once: true });
})();
