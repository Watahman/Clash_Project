import { t } from '../i18n/i18n.js';

let loadingCounter = 0;
let overlay;
let messageNode;
let keyLockInstalled = false;
let showTimer;
const SHOW_DELAY_MS = 180;

function blockKeysWhileLoading(event) {
    if (loadingCounter <= 0) return;
    event.preventDefault();
    event.stopPropagation();
}

function ensureOverlay() {
    if (overlay?.isConnected) return overlay;
    overlay = null;
    messageNode = null;

    overlay = document.createElement('div');
    overlay.id = 'global-loading-overlay';
    overlay.className = 'global-loading-overlay hidden';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
        <div class="global-loading-card">
            <div class="global-loading-spinner" aria-hidden="true"></div>
            <p id="global-loading-message">${t('common.loading')}</p>
        </div>`;
    messageNode = overlay.querySelector('#global-loading-message');
    document.body.appendChild(overlay);
    if (!keyLockInstalled) {
        document.addEventListener('keydown', blockKeysWhileLoading, true);
        document.addEventListener('keyup', blockKeysWhileLoading, true);
        keyLockInstalled = true;
    }
    return overlay;
}

function setInteractionLock(active) {
    document.documentElement.classList.toggle('global-loading-active', active);
    document.body.classList.toggle('global-loading-active', active);
    document.body.setAttribute('aria-busy', active ? 'true' : 'false');
}

export function startGlobalLoading(message = t('common.loading')) {
    loadingCounter += 1;
    const currentOverlay = ensureOverlay();
    messageNode.textContent = message || t('common.loading');
    if (showTimer || !currentOverlay.classList.contains('hidden')) return;
    showTimer = window.setTimeout(() => {
        showTimer = null;
        if (loadingCounter <= 0) return;
        currentOverlay.classList.remove('hidden');
        setInteractionLock(true);
    }, SHOW_DELAY_MS);
}

export function stopGlobalLoading() {
    loadingCounter = Math.max(0, loadingCounter - 1);
    if (loadingCounter > 0) return;
    if (showTimer) {
        window.clearTimeout(showTimer);
        showTimer = null;
    }
    ensureOverlay();
    overlay.classList.add('hidden');
    setInteractionLock(false);
}

export async function withGlobalLoading(asyncFn, message = t('common.loading')) {
    startGlobalLoading(message);
    try {
        return await asyncFn();
    } finally {
        stopGlobalLoading();
    }
}
