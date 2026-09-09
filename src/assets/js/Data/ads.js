(() => {
    'use strict';

    const AD_MANAGER_URL = '/assets/js/Data/adsterra-manager.js?v=20260910-adsterra-v3';
    const STYLE_ID = 'clashpanel-ad-consent-css';
    const STYLE_URL = '/assets/css/ad-consent.css?v=20260910-ad-consent-v1';
    const STORAGE_KEY = 'clashpanel:advertising-consent:v1';
    const STORAGE_VERSION = 'v1';
    const DECISIONS = Object.freeze({ ACCEPTED: 'accepted', REJECTED: 'rejected' });
    const COPY = Object.freeze({
        en: { title: 'Advertising choice', body: 'Allow Adsterra and its partners to use cookies or device data to show and measure ads. You can change this choice at any time.', privacy: 'Read the privacy policy', accept: 'Accept advertising', reject: 'Reject advertising', cancel: 'Cancel' },
        nl: { title: 'Keuze voor advertenties', body: 'Sta Adsterra en partners toe cookies of apparaatgegevens te gebruiken om advertenties te tonen en te meten. Je kunt deze keuze altijd wijzigen.', privacy: 'Lees het privacybeleid', accept: 'Advertenties toestaan', reject: 'Advertenties weigeren', cancel: 'Annuleren' },
        fr: { title: 'Choix publicitaire', body: 'Autorisez Adsterra et ses partenaires à utiliser des cookies ou des données de l’appareil pour afficher et mesurer les publicités. Vous pouvez modifier ce choix à tout moment.', privacy: 'Lire la politique de confidentialité', accept: 'Accepter la publicité', reject: 'Refuser la publicité', cancel: 'Annuler' },
        de: { title: 'Werbeauswahl', body: 'Erlaube Adsterra und Partnern, Cookies oder Gerätedaten zum Anzeigen und Messen von Werbung zu verwenden. Du kannst diese Auswahl jederzeit ändern.', privacy: 'Datenschutzerklärung lesen', accept: 'Werbung akzeptieren', reject: 'Werbung ablehnen', cancel: 'Abbrechen' },
        es: { title: 'Elección de publicidad', body: 'Permite que Adsterra y sus socios usen cookies o datos del dispositivo para mostrar y medir anuncios. Puedes cambiar esta elección cuando quieras.', privacy: 'Leer la política de privacidad', accept: 'Aceptar publicidad', reject: 'Rechazar publicidad', cancel: 'Cancelar' }
    });
    const state = {
        cmpLoaded: false, regionReady: false, classification: 'unknown', consentRequired: true,
        decision: null, advertisingConsent: false, consentReady: false, consentValues: null,
        reason: 'region-not-ready', managerPromise: null, panel: null, editing: false,
        restoreFocus: null
    };

    function isTopLevelPage() {
        try { return window.top === window.self; } catch { return false; }
    }

    function language() {
        const code = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
        return COPY[code] ? code : 'en';
    }

    function appendStylesheet() {
        if (document.getElementById(STYLE_ID) || document.querySelector(`link[href*="${STYLE_URL.split('?')[0]}"]`)) return;
        const link = document.createElement('link');
        link.id = STYLE_ID;
        link.rel = 'stylesheet';
        link.href = STYLE_URL;
        document.head?.append(link);
    }

    function readDecision() {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY) || '';
            const prefix = `${STORAGE_VERSION}:`;
            const decision = stored.startsWith(prefix) ? stored.slice(prefix.length) : '';
            return Object.values(DECISIONS).includes(decision) ? decision : null;
        } catch { return null; }
    }

    function saveDecision(decision) {
        try { window.localStorage.setItem(STORAGE_KEY, `${STORAGE_VERSION}:${decision}`); }
        catch { /* A session-only decision still protects this page. */ }
    }

    function normalizeClassification(value) {
        const classification = String(value || '').trim().toLowerCase();
        return classification === 'protected' || classification === 'non-protected' ? classification : 'unknown';
    }

    function contextFromPayload(payload) {
        const source = payload?.context && typeof payload.context === 'object' ? payload.context : payload || {};
        const classification = normalizeClassification(source.classification);
        const ready = source.regionReady === false || source.ready === false ? false : classification !== 'unknown';
        return {
            regionReady: ready,
            classification: ready ? classification : 'unknown',
            consentRequired: classification !== 'non-protected'
        };
    }

    async function loadRegionContext() {
        try {
            const response = await fetch('/api/ads-context', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error(`ads-context:${response.status}`);
            return contextFromPayload(await response.json());
        } catch { return { regionReady: false, classification: 'unknown', consentRequired: true }; }
    }

    function copyNode(selector, key) {
        const node = state.panel?.querySelector(selector);
        if (node) node.textContent = COPY[language()][key];
    }

    function renderPanelCopy() {
        copyNode('[data-consent-title]', 'title'); copyNode('[data-consent-body]', 'body');
        copyNode('[data-consent-privacy]', 'privacy'); copyNode('[data-consent-accept]', 'accept');
        copyNode('[data-consent-reject]', 'reject'); copyNode('[data-consent-cancel]', 'cancel');
    }

    function hidePanel(restore = true) {
        if (!state.panel) return;
        state.panel.hidden = true;
        if (restore && state.restoreFocus?.isConnected) state.restoreFocus.focus();
        state.restoreFocus = null;
    }

    function showPanel(editing = false) {
        if (!state.panel) {
            const panel = document.createElement('aside');
            panel.id = 'clashpanel-ad-consent';
            panel.className = 'cp-ad-consent';
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-modal', 'false');
            panel.setAttribute('aria-labelledby', 'clashpanel-ad-consent-title');
            panel.setAttribute('aria-describedby', 'clashpanel-ad-consent-body');
            panel.innerHTML = '<div class="cp-ad-consent__panel"><div class="cp-ad-consent__copy"><h2 id="clashpanel-ad-consent-title" data-consent-title></h2><p id="clashpanel-ad-consent-body" data-consent-body></p><a href="/privacy#advertising" data-consent-privacy></a></div><div class="cp-ad-consent__actions"><button type="button" class="button button-primary" data-consent-accept></button><button type="button" class="button button-secondary" data-consent-reject></button><button type="button" class="button button-quiet" data-consent-cancel hidden></button></div></div>';
            panel.querySelector('[data-consent-accept]').addEventListener('click', () => choose(DECISIONS.ACCEPTED));
            panel.querySelector('[data-consent-reject]').addEventListener('click', () => choose(DECISIONS.REJECTED));
            panel.querySelector('[data-consent-cancel]').addEventListener('click', () => hidePanel());
            panel.addEventListener('keydown', event => { if (event.key === 'Escape' && state.editing) hidePanel(); });
            state.panel = panel;
            document.body?.append(panel);
        }
        state.editing = editing; state.restoreFocus = document.activeElement;
        state.panel.querySelector('[data-consent-cancel]').hidden = !editing;
        state.panel.hidden = false; renderPanelCopy();
        state.panel.querySelector(editing ? '[data-consent-cancel]' : '[data-consent-accept]')?.focus();
        return true;
    }

    function dispatchConsentChange() {
        state.consentReady = state.regionReady
            ? (!state.consentRequired || Boolean(state.decision))
            : Boolean(state.decision);
        state.consentValues = { classification: state.classification, decision: state.decision };
        const detail = { advertisingConsent: state.advertisingConsent, consentRequired: state.consentRequired, classification: state.classification, regionReady: state.regionReady, decision: state.decision, reason: state.reason };
        window.dispatchEvent(new CustomEvent('clashtools:ad-consent-changed', { detail }));
        window.dispatchEvent(new CustomEvent('ad-consent-changed', { detail }));
        if (state.advertisingConsent) initAdsterraAfterConsent();
    }

    function choose(decision) {
        state.decision = decision; saveDecision(decision);
        state.advertisingConsent = state.consentRequired ? decision === DECISIONS.ACCEPTED : decision !== DECISIONS.REJECTED;
        state.reason = decision === DECISIONS.ACCEPTED ? 'consent-accepted' : 'consent-rejected';
        hidePanel(); dispatchConsentChange();
    }

    function updateFromContext(context) {
        Object.assign(state, context, { decision: readDecision() });
        if (!state.regionReady) {
            state.advertisingConsent = state.decision === DECISIONS.ACCEPTED;
            state.reason = state.decision ? `consent-${state.decision}` : 'region-unavailable';
            if (!state.decision) showPanel();
        } else if (state.consentRequired) {
            state.advertisingConsent = state.decision === DECISIONS.ACCEPTED;
            state.reason = state.decision ? `consent-${state.decision}` : 'consent-required';
            if (!state.decision) showPanel();
        } else {
            state.advertisingConsent = state.decision !== DECISIONS.REJECTED;
            state.reason = state.decision === DECISIONS.REJECTED ? 'previously-denied' : 'non-protected-region';
        }
        dispatchConsentChange();
    }

    function initAdsterraAfterConsent() {
        if (!state.advertisingConsent || state.managerPromise) return;
        state.managerPromise = import(AD_MANAGER_URL).then(manager => {
            if (!manager.isAdRouteEligible?.()) return null;
            const init = manager.initAdsterraAds || manager.init;
            if (typeof init === 'function') init();
            return manager;
        }).catch(() => null);
    }

    function bindPreferenceControls() {
        document.querySelectorAll('[data-cookie-preferences]').forEach(control => {
            control.hidden = false;
            control.onclick = () => window.ClashToolsCMP?.openPreferences?.();
        });
    }

    function installFacade() {
        state.cmpLoaded = true;
        const api = {
            hasAdvertisingConsent: () => state.advertisingConsent === true,
            openPreferences: () => showPanel(Boolean(state.decision)),
            debug: () => ({ provider: 'clashpanel', cmpLoaded: state.cmpLoaded, regionReady: state.regionReady, classification: state.classification, consentRequired: state.consentRequired, consentReady: state.consentReady, consentValues: state.consentValues, decision: state.decision, advertisingConsent: state.advertisingConsent, reason: state.reason })
        };
        window.ClashToolsAdvertisingConsent = api;
        window.ClashToolsCMP = api;
        bindPreferenceControls();
        window.dispatchEvent(new CustomEvent('clashtools:cmp-ready'));
    }

    async function start() {
        appendStylesheet(); installFacade();
        updateFromContext(await loadRegionContext());
    }

    if (isTopLevelPage()) {
        window.addEventListener('clashtools:language-changed', renderPanelCopy);
        void start();
    }
})();
