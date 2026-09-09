(() => {
    'use strict';

    const SCRIPT_ID = 'clashtools-google-ads';
    const CLIENT_ID = 'ca-pub-7361256415342967';
    const AD_MANAGER_URL = '/assets/js/Data/adsterra-manager.js?v=20260909-adsterra-v1';
    let advertisingConsent = false;
    let adsterraManagerPromise;
    let adsterraManager;

    function loadAdsterraManager() {
        if (adsterraManagerPromise) return adsterraManagerPromise;
        adsterraManagerPromise = import(AD_MANAGER_URL).then(manager => {
            if (!manager.isAdRouteEligible()) return null;
            adsterraManager = manager;
            manager.initAdsterraAds();
            return manager;
        }).catch(() => null);
        return adsterraManagerPromise;
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
        const detail = {
            detail: { advertisingConsent }
        };
        window.dispatchEvent(new CustomEvent('clashtools:ad-consent-changed', detail));
        window.dispatchEvent(new CustomEvent('ad-consent-changed', detail));
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
        if (!adsterraManager?.isAdRouteEligible()) return;

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
        loadAdsterraManager().then(manager => {
            if (!manager) return;
            installGoogleCmpBridge();
            loadGoogleCmpWhenIdle();
        }).catch(() => {});
    }

    if (document.readyState === 'complete') scheduleGoogleCmp();
    else window.addEventListener('load', scheduleGoogleCmp, { once: true });
})();
