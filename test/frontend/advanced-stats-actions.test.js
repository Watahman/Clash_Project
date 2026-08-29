import { describe, expect, it, vi } from 'vitest';
import { createTrackingActions } from '../../src/assets/js/pages/advanced-stats-actions.js?v=20260829-public-auth-v1';

function actionContext() {
    const state = {
        playerTag: '#CPSTAT01',
        busy: false,
        confirmAction: '',
        api: {
            startTracking: vi.fn().mockResolvedValue({}),
            pauseTracking: vi.fn().mockResolvedValue({}),
            resumeTracking: vi.fn().mockResolvedValue({}),
            stopTracking: vi.fn().mockResolvedValue({}),
            deleteTracking: vi.fn().mockResolvedValue({})
        }
    };
    const dialog = document.createElement('dialog');
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    const elements = {
        dialog,
        dialogTitle: document.createElement('h2'),
        dialogCopy: document.createElement('p'),
        dialogConfirm: document.createElement('button'),
        dialogCancel: document.createElement('button'),
        deleteField: document.createElement('label'),
        deleteInput: document.createElement('input'),
        dialogError: document.createElement('p')
    };
    const setBusy = vi.fn(value => { state.busy = value; });
    const setDataStatus = vi.fn();
    const refreshTrackingAndData = vi.fn().mockResolvedValue(undefined);
    return {
        state,
        elements,
        setBusy,
        setDataStatus,
        refreshTrackingAndData,
        actions: createTrackingActions({ state, elements, setBusy, setDataStatus, refreshTrackingAndData })
    };
}

describe('Advanced Stats tracking actions', () => {
    it('keeps start, pause, resume, stop and delete API actions distinct', async () => {
        const context = actionContext();

        for (const action of ['startTracking', 'pauseTracking', 'resumeTracking', 'stopTracking', 'deleteTracking']) {
            await context.actions.runTrackingAction(action);
        }

        expect(context.state.api.startTracking).toHaveBeenCalledWith('#CPSTAT01');
        expect(context.state.api.pauseTracking).toHaveBeenCalledWith('#CPSTAT01');
        expect(context.state.api.resumeTracking).toHaveBeenCalledWith('#CPSTAT01');
        expect(context.state.api.stopTracking).toHaveBeenCalledWith('#CPSTAT01');
        expect(context.state.api.deleteTracking).toHaveBeenCalledWith('#CPSTAT01');
        expect(context.refreshTrackingAndData).toHaveBeenCalledTimes(5);
    });

    it('requires the delete confirmation keyword and keeps stop confirmation separate', async () => {
        const context = actionContext();
        context.actions.openStopConfirmation();
        expect(context.state.confirmAction).toBe('stopTracking');
        expect(context.elements.deleteField.hidden).toBe(true);

        context.actions.openDeleteConfirmation();
        expect(context.state.confirmAction).toBe('deleteTracking');
        expect(context.elements.deleteField.hidden).toBe(false);
        const event = {
            submitter: { value: 'confirm' },
            preventDefault: vi.fn()
        };
        context.elements.deleteInput.value = 'remove';
        context.actions.submitConfirmation(event);
        expect(context.elements.dialogError.hidden).toBe(false);
        expect(context.state.api.deleteTracking).not.toHaveBeenCalled();

        context.elements.deleteInput.value = 'DELETE';
        context.actions.submitConfirmation(event);
        await vi.waitFor(() => expect(context.state.api.deleteTracking).toHaveBeenCalledWith('#CPSTAT01'));
        expect(context.elements.dialog.close).toHaveBeenCalled();
    });
});
