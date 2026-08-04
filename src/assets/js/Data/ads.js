(() => {
    'use strict';

    const SCRIPT_ID = 'clashtools-google-ads';
    const CLIENT_ID = 'ca-pub-7361256415342967';

    // Deliberately conservative during the next AdSense review. A route belongs
    // here only after its initial HTML is a useful, indexable public resource.
    const AD_ELIGIBLE_ROUTES = new Set(['/']);
    const ALWAYS_EXCLUDED_PREFIXES = ['/app/', '/api/', '/dashboard', '/subpages/'];

    function normalizedPath() {
        return (window.location.pathname.replace(/\/+$/, '') || '/').toLowerCase();
    }

    function navigationReturnedOk() {
        const navigation = performance.getEntriesByType?.('navigation')?.[0];
        return !navigation?.responseStatus || navigation.responseStatus === 200;
    }

    function hasMeaningfulPublisherContent() {
        const main = document.querySelector('main');
        if (!main || main.hidden || main.getAttribute('aria-busy') === 'true') return false;
        if (document.body.matches('.workspace-app, .auth-page, .error-page')) return false;
        if (main.matches('[data-loading="true"], [data-empty="true"], [data-error="true"]')) return false;
        return (main.textContent || '').replace(/\s+/g, ' ').trim().length >= 800;
    }

    function isIndexableCanonicalPage(path) {
        const robots = document.querySelector('meta[name="robots"]')?.content.toLowerCase() || '';
        const canonical = document.querySelector('link[rel="canonical"]')?.href;
        if (robots.includes('noindex') || !canonical) return false;
        try {
            const canonicalUrl = new URL(canonical);
            return canonicalUrl.origin === 'https://clashpanel.com'
                && (canonicalUrl.pathname.replace(/\/+$/, '') || '/').toLowerCase() === path;
        } catch {
            return false;
        }
    }

    function isRouteEligible() {
        const path = normalizedPath();
        if (!AD_ELIGIBLE_ROUTES.has(path)) return false;
        if (ALWAYS_EXCLUDED_PREFIXES.some(prefix => path === prefix || path.startsWith(prefix))) return false;
        if (!navigationReturnedOk() || !isIndexableCanonicalPage(path)) return false;
        return hasMeaningfulPublisherContent();
    }

    function hasAdvertisingConsent() {
        // A certified CMP must expose this explicit decision. Missing, pending
        // or rejected consent keeps advertising disabled without hiding content.
        return window.ClashToolsCMP?.hasAdvertisingConsent?.() === true;
    }

    function loadAds() {
        if (document.getElementById(SCRIPT_ID)) return;
        if (!isRouteEligible() || !hasAdvertisingConsent()) return;
        if (navigator.connection?.saveData || document.visibilityState === 'hidden') return;

        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.dataset.adClient = CLIENT_ID;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT_ID}`;
        document.head.append(script);
    }

    function loadAdsWhenIdle() {
        const run = () => loadAds();
        if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 1500 });
        else run();
    }

    function scheduleAds() {
        if (!isRouteEligible()) return;
        ['pointerdown', 'touchstart', 'keydown'].forEach(type => {
            window.addEventListener(type, loadAdsWhenIdle, { once: true, passive: true });
        });
        window.addEventListener('clashtools:ad-consent-changed', loadAdsWhenIdle);
        window.setTimeout(loadAdsWhenIdle, 12000);
    }

    if (document.readyState === 'complete') scheduleAds();
    else window.addEventListener('load', scheduleAds, { once: true });
})();
