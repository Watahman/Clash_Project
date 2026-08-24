import { t } from '../i18n/i18n.js?v=20260811-2';

export function createTrackingActions({
    state,
    elements,
    setBusy,
    setDataStatus,
    refreshTrackingAndData,
    onStartRequested = () => {},
    onStartFailed = () => {}
}) {
    async function runTrackingAction(action) {
        if (!state.playerTag || state.busy) return;

        if (action === 'startTracking') onStartRequested();
        setBusy(true);
        setDataStatus(t('advancedStats.loadingTracking'));
        try {
            await state.api[action](state.playerTag);
            await refreshTrackingAndData({ preserveBusy: true });
        } catch (error) {
            console.error('advanced_stats_action_failed', error);
            if (action === 'startTracking') onStartFailed(error);
            const message = error?.code === 'ADVANCED_STATS_ROLLOUT_RESTRICTED'
                ? t('advancedStats.rolloutRestricted')
                : t('advancedStats.actionFailed');
            setDataStatus(message, 'error');
        } finally {
            setBusy(false);
        }
    }

    function openConfirmation(action) {
        const deleting = action === 'deleteTracking';
        state.confirmAction = action;
        elements.dialogTitle.textContent = t(deleting ? 'advancedStats.delete' : 'advancedStats.stop');
        elements.dialogCopy.textContent = t(deleting ? 'advancedStats.confirmDelete' : 'advancedStats.confirmStop');
        elements.dialogConfirm.textContent = t(deleting ? 'advancedStats.delete' : 'advancedStats.stop');
        elements.dialogConfirm.dataset.action = action;
        elements.deleteField.hidden = !deleting;
        elements.deleteInput.value = '';
        elements.dialogError.hidden = true;
        elements.dialog.showModal();
        (deleting ? elements.deleteInput : elements.dialogCancel).focus();
    }

    function submitConfirmation(event) {
        if (event.submitter?.value !== 'confirm') return;
        event.preventDefault();
        const deleting = state.confirmAction === 'deleteTracking';
        if (deleting && elements.deleteInput.value.trim() !== t('advancedStats.deleteKeyword')) {
            elements.dialogError.textContent = t('advancedStats.deletePrompt');
            elements.dialogError.hidden = false;
            elements.deleteInput.focus();
            return;
        }
        const action = state.confirmAction;
        elements.dialog.close();
        void runTrackingAction(action);
    }

    return {
        runTrackingAction,
        submitConfirmation,
        start: () => void runTrackingAction('startTracking'),
        pause: () => void runTrackingAction('pauseTracking'),
        resume: () => void runTrackingAction('resumeTracking'),
        openStopConfirmation: () => openConfirmation('stopTracking'),
        openDeleteConfirmation: () => openConfirmation('deleteTracking')
    };
}
