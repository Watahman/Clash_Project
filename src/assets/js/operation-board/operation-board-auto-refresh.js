import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';

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
    let importedDataPaused = false;

    function isPaused() {
        return paused || importedDataPaused;
    }

    function sync() {
        if (!refs?.autoRefresh) return;
        refs.autoRefresh.setAttribute('aria-pressed', String(isPaused()));
        refs.autoRefresh.textContent = t(
            isPaused() ? 'op.resumeAutoRefresh' : 'op.pauseAutoRefresh'
        );
    }

    function toggle() {
        paused = !isPaused();
        importedDataPaused = false;
        storage.setItem(STORAGE_KEY, String(paused));
        sync();
    }

    function pauseForImportedData() {
        importedDataPaused = true;
        sync();
    }

    function resumeForLiveSource() {
        importedDataPaused = false;
        sync();
    }

    function refreshIfEligible() {
        if (isPaused() || documentRef.visibilityState !== 'visible') return;
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

    return {
        pauseForImportedData,
        refreshIfEligible,
        resumeForLiveSource,
        start,
        sync,
        toggle
    };
}
