import { t } from '../i18n/i18n.js';

const STORAGE_KEY = 'clashtools_op_auto_refresh_paused';
const DEFAULT_INTERVAL_MS = 60_000;

export function createOperationBoardAutoRefresh({
    refs,
    getSelectedClan,
    getHistoryMode,
    getSyncState,
    getLastSyncAt,
    refresh,
    storage = localStorage,
    documentRef = document,
    windowRef = window,
    intervalMs = DEFAULT_INTERVAL_MS
}) {
    let paused = storage.getItem(STORAGE_KEY) === 'true';

    function sync() {
        if (!refs?.autoRefresh) return;
        refs.autoRefresh.setAttribute('aria-pressed', String(paused));
        refs.autoRefresh.textContent = t(
            paused ? 'op.resumeAutoRefresh' : 'op.pauseAutoRefresh'
        );
    }

    function toggle() {
        paused = !paused;
        storage.setItem(STORAGE_KEY, String(paused));
        sync();
    }

    function refreshIfEligible() {
        if (paused || documentRef.visibilityState !== 'visible') return;
        if (getSyncState() === 'loading') return;
        if (!getSelectedClan() || getHistoryMode() !== 'current') return;
        refresh();
    }

    function start() {
        windowRef.setInterval(refreshIfEligible, intervalMs);
        documentRef.addEventListener('visibilitychange', refreshWhenStale);
    }

    function refreshWhenStale() {
        if (documentRef.visibilityState !== 'visible' || !getLastSyncAt()) return;
        if (Date.now() - getLastSyncAt().getTime() >= intervalMs) {
            refreshIfEligible();
        }
    }

    return { refreshIfEligible, start, sync, toggle };
}
