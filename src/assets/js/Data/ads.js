(() => {
    'use strict';

    const SCRIPT_ID = 'clashtools-google-ads';
    const CLIENT_ID = 'ca-pub-7361256415342967';
    let advertisingConsent = false;

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

    function consentModeAllowsAdvertising() {
        const googlefc = window.googlefc;
        const status = googlefc?.getGoogleConsentModeValues?.();
        const statusEnum = googlefc?.ConsentModePurposeStatusEnum;
        if (!status || !statusEnum) return false;

        const permitsPurpose = value => value === statusEnum.GRANTED || value === statusEnum.NOT_APPLICABLE;
        return permitsPurpose(status.adStoragePurposeConsentStatus)
            && permitsPurpose(status.adUserDataPurposeConsentStatus)
            && permitsPurpose(status.adPersonalizationPurposeConsentStatus);
    }

    function publishConsentState() {
        advertisingConsent = consentModeAllowsAdvertising();
        window.dispatchEvent(new CustomEvent('clashtools:ad-consent-changed', {
            detail: { advertisingConsent }
        }));
    }

    function queueConsentRefresh() {
        window.googlefc.callbackQueue.push({ CONSENT_MODE_DATA_READY: publishConsentState });
    }

    function installGoogleCmpBridge() {
        window.googlefc = window.googlefc || {};
        window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
        queueConsentRefresh();

        window.ClashToolsCMP = {
            hasAdvertisingConsent: () => advertisingConsent,
            openPreferences: () => {
                queueConsentRefresh();
                window.googlefc.callbackQueue.push({
                    CONSENT_API_READY: () => window.googlefc.showRevocationMessage?.()
                });
            }
        };
        window.dispatchEvent(new CustomEvent('clashtools:cmp-ready'));
    }

    function loadGoogleCmpAndAds() {
        if (document.getElementById(SCRIPT_ID)) return;
        if (!isRouteEligible()) return;

        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.dataset.adClient = CLIENT_ID;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT_ID}`;
        document.head.append(script);
    }

    function loadGoogleCmpWhenIdle() {
        const run = () => loadGoogleCmpAndAds();
        if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 1500 });
        else run();
    }

    function scheduleGoogleCmp() {
        if (!isRouteEligible()) return;
        installGoogleCmpBridge();
        loadGoogleCmpWhenIdle();
    }

    if (document.readyState === 'complete') scheduleGoogleCmp();
    else window.addEventListener('load', scheduleGoogleCmp, { once: true });
})();
