(() => {
    'use strict';

    const SCRIPT_ID = 'clashtools-google-ads';
    const CLIENT_ID = 'ca-pub-7361256415342967';
    const AD_MANAGER_URL = '/assets/js/Data/adsterra-manager.js?v=20260910-adsterra-v2';
    const CONSENT_STATUSES = Object.freeze({
        GRANTED: 'GRANTED',
        DENIED: 'DENIED',
        NOT_APPLICABLE: 'NOT_APPLICABLE',
        NOT_CONFIGURED: 'NOT_CONFIGURED',
        UNKNOWN: 'UNKNOWN'
    });
    const consentState = {
        cmpLoaded: false,
        consentReady: false,
        consentValues: null,
        advertisingConsent: false,
        reason: 'cmp-not-ready'
    };
    let adsterraManagerPromise;

    function isTopLevelPage() {
        try {
            return window.top === window.self;
        } catch {
            return false;
        }
    }

    function statusName(value, statusEnum) {
        const enumValue = name => statusEnum?.[name]
            ?? statusEnum?.[`CONSENT_MODE_PURPOSE_STATUS_${name}`];
        if (value === enumValue('GRANTED')) return CONSENT_STATUSES.GRANTED;
        if (value === enumValue('DENIED')) return CONSENT_STATUSES.DENIED;
        if (value === enumValue('NOT_APPLICABLE')) return CONSENT_STATUSES.NOT_APPLICABLE;
        if (value === enumValue('NOT_CONFIGURED')) return CONSENT_STATUSES.NOT_CONFIGURED;
        if (value === enumValue('UNKNOWN')) return CONSENT_STATUSES.UNKNOWN;
        if (typeof value !== 'string') return CONSENT_STATUSES.UNKNOWN;

        const normalized = value.trim().toUpperCase().replaceAll('-', '_').replaceAll(' ', '_');
        return Object.values(CONSENT_STATUSES).includes(normalized)
            ? normalized
            : CONSENT_STATUSES.UNKNOWN;
    }

    function readConsentValues() {
        try {
            const googlefc = window.googlefc;
            const values = googlefc?.getGoogleConsentModeValues?.();
            if (!values) return null;

            const statusEnum = googlefc?.ConsentModePurposeStatusEnum;
            return {
                adStorage: statusName(values.adStoragePurposeConsentStatus, statusEnum),
                adUserData: statusName(values.adUserDataPurposeConsentStatus, statusEnum),
                adPersonalization: statusName(values.adPersonalizationPurposeConsentStatus, statusEnum)
            };
        } catch {
            return null;
        }
    }

    function consentReason(values) {
        if (!values) return 'consent-not-ready';
        const statuses = Object.values(values);
        if (statuses.includes(CONSENT_STATUSES.DENIED)) return 'consent-denied';
        if (statuses.includes(CONSENT_STATUSES.NOT_CONFIGURED)) return 'consent-not-configured';
        if (statuses.includes(CONSENT_STATUSES.UNKNOWN)) return 'consent-unknown';
        if (statuses.every(status => status === CONSENT_STATUSES.NOT_APPLICABLE)) {
            return 'consent-not-applicable';
        }
        if (statuses.every(status => status === CONSENT_STATUSES.GRANTED
            || status === CONSENT_STATUSES.NOT_APPLICABLE)) {
            return 'consent-granted';
        }
        return 'consent-incomplete';
    }

    function consentModeAllowsAdvertising(values = readConsentValues()) {
        if (!values) return false;
        return Object.values(values).every(status => status === CONSENT_STATUSES.GRANTED
            || status === CONSENT_STATUSES.NOT_APPLICABLE);
    }

    function initAdsterraAfterConsent() {
        if (!consentState.advertisingConsent || adsterraManagerPromise) return;

        adsterraManagerPromise = import(AD_MANAGER_URL).then(manager => {
            if (!manager.isAdRouteEligible?.()) return null;
            const init = manager.initAdsterraAds || manager.init;
            if (typeof init === 'function') init();
            return manager;
        }).catch(() => null);
    }

    function publishConsentState() {
        const values = readConsentValues();
        consentState.consentReady = Boolean(values);
        consentState.consentValues = values;
        consentState.advertisingConsent = consentModeAllowsAdvertising(values);
        consentState.reason = consentReason(values);
        const detail = {
            detail: {
                advertisingConsent: consentState.advertisingConsent,
                consentValues: values,
                reason: consentState.reason
            }
        };
        window.dispatchEvent(new CustomEvent('clashtools:ad-consent-changed', detail));
        window.dispatchEvent(new CustomEvent('ad-consent-changed', detail));
        if (consentState.advertisingConsent) initAdsterraAfterConsent();
    }

    function queueConsentRefresh() {
        window.googlefc.callbackQueue.push({ CONSENT_MODE_DATA_READY: publishConsentState });
    }

    function installGoogleCmpBridge() {
        window.googlefc = window.googlefc || {};
        if (!Array.isArray(window.googlefc.callbackQueue)) window.googlefc.callbackQueue = [];
        queueConsentRefresh();

        window.ClashToolsCMP = {
            hasAdvertisingConsent: () => consentState.advertisingConsent,
            debug: () => ({
                cmpLoaded: consentState.cmpLoaded,
                consentReady: consentState.consentReady,
                consentValues: consentState.consentValues,
                advertisingConsent: consentState.advertisingConsent,
                reason: consentState.reason
            }),
            openPreferences: () => {
                try {
                    queueConsentRefresh();
                    window.googlefc.callbackQueue.push({
                        CONSENT_API_READY: () => window.googlefc.showRevocationMessage?.()
                    });
                    return true;
                } catch {
                    consentState.reason = 'consent-api-unavailable';
                    return false;
                }
            }
        };
        window.dispatchEvent(new CustomEvent('clashtools:cmp-ready'));
    }

    function loadGoogleCmpAndAds() {
        if (!isTopLevelPage() || document.getElementById(SCRIPT_ID)) return;

        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.dataset.adClient = CLIENT_ID;
        script.addEventListener('load', () => {
            consentState.cmpLoaded = true;
        }, { once: true });
        script.addEventListener('error', () => {
            consentState.reason = 'cmp-load-failed';
        }, { once: true });
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT_ID}`;
        document.head?.append(script);
    }

    if (isTopLevelPage()) {
        installGoogleCmpBridge();
        loadGoogleCmpAndAds();
    }
})();
