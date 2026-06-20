let loadingCounter = 0;
let overlay;
let messageNode;
let keyLockInstalled = false;

function blockKeysWhileLoading(event) {
    if (loadingCounter <= 0) return;
    event.preventDefault();
    event.stopPropagation();
}

function ensureOverlay() {
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'global-loading-overlay';
    overlay.className = 'global-loading-overlay hidden';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
        <div class="global-loading-card">
            <div class="global-loading-spinner" aria-hidden="true"></div>
            <p id="global-loading-message">Laden...</p>
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

export function startGlobalLoading(message = 'Laden...') {
    loadingCounter += 1;
    ensureOverlay();
    messageNode.textContent = message || 'Laden...';
    overlay.classList.remove('hidden');
    setInteractionLock(true);
}

export function stopGlobalLoading() {
    loadingCounter = Math.max(0, loadingCounter - 1);
    if (loadingCounter > 0) return;
    ensureOverlay();
    overlay.classList.add('hidden');
    setInteractionLock(false);
}

export async function withGlobalLoading(asyncFn, message = 'Laden...') {
    startGlobalLoading(message);
    try {
        return await asyncFn();
    } finally {
        stopGlobalLoading();
    }
}
