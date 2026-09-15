const AUTH_EVENT_REGISTRY_KEY = '__CLASHTOOLS_AUTH_EVENT_REGISTRY__';

export function installAuthEventListeners({
    onSessionExpired,
    onPersistedPageShow
} = {}) {
    if (typeof window === 'undefined') return;
    const registry = globalThis[AUTH_EVENT_REGISTRY_KEY] || {};
    registry.authSessionExpired = onSessionExpired;
    registry.persistedPageShow = onPersistedPageShow;
    globalThis[AUTH_EVENT_REGISTRY_KEY] = registry;
    if (registry.window === window) return;
    window.addEventListener('clashtools:auth-session-expired', event => {
        registry.authSessionExpired?.(event);
    });
    window.addEventListener('pageshow', event => {
        registry.persistedPageShow?.(event);
    });
    registry.window = window;
}
