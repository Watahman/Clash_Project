let lifecycleInstalled = false;

export function installPlannerLifecycle({ shouldWarnBeforeUnload, flushPendingSave } = {}) {
    if (lifecycleInstalled) return;
    lifecycleInstalled = true;

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushPendingSave?.();
    });
    window.addEventListener('pagehide', flushPendingSave);
    window.addEventListener('beforeunload', event => {
        if (!shouldWarnBeforeUnload?.()) return;
        event.preventDefault();
        event.returnValue = '';
    });
}
