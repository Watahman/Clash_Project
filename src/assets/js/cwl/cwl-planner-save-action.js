import * as config from '../Data/config.js';
import {
    getCurrentReturnPath,
    requireAuthForAction
} from '../auth/auth-client.js?v=20260829-public-auth-v1';
import { savePlan } from './cwl-plan-io.js?v=20260829-public-auth-v1';

export function initPlannerSaveAction({ button, onStateChange } = {}) {
    if (!button) return;
    let inFlight = false;
    let feedbackTimer;
    const guestSaveDialog = createGuestSaveDialog(button);

    button.addEventListener('click', async () => {
        onStateChange?.();
        if (button.disabled || inFlight) return;
        inFlight = true;
        try {
            const gate = await requireAuthForAction({
                reason: 'save-plan',
                returnTo: getCurrentReturnPath(),
                action: () => saveAuthenticatedPlan(button),
                onGuest: context => saveGuestPlan(context)
            });
            if (!gate.executed) return;
            const result = await gate.result;
            setFeedback(result ? 'saved' : 'error');
            feedbackTimer = window.setTimeout(() => {
                setFeedback('idle');
            }, result ? 900 : 1400);
        } catch {
            setFeedback('error');
            feedbackTimer = window.setTimeout(() => {
                setFeedback('idle');
            }, 1400);
        } finally {
            inFlight = false;
            onStateChange?.();
        }
    });

    async function saveGuestPlan(context) {
        const result = await savePlan({ immediate: true, skipHistory: true });
        if (!result?.local) {
            setFeedback('error');
            return;
        }
        setFeedback('guest');
        if (!guestSaveDialog.open(context.loginUrl)) navigateToLogin(context.loginUrl);
    }

    function setFeedback(state) {
        if (feedbackTimer) window.clearTimeout(feedbackTimer);
        setSaveButtonFeedback(button, state);
    }
}

function createGuestSaveDialog(button) {
    const dialog = document.querySelector('#cwl-guest-save-dialog');
    const login = dialog?.querySelector('[data-cwl-guest-save-login]');
    const close = dialog?.querySelector('[data-cwl-guest-save-close]');
    if (!dialog || !login) return { open: () => false };

    let loginUrl = '';
    let opener = button;
    const closeDialog = () => {
        if (typeof dialog.close === 'function' && dialog.open) dialog.close();
        else dialog.removeAttribute('open');
        opener?.focus?.({ preventScroll: true });
    };

    login.addEventListener('click', () => {
        if (!loginUrl) return;
        closeDialog();
        navigateToLogin(loginUrl);
    });
    close?.addEventListener('click', closeDialog);
    dialog.addEventListener('cancel', event => {
        event.preventDefault();
        closeDialog();
    });
    dialog.addEventListener('click', event => {
        if (event.target === dialog) closeDialog();
    });

    return {
        open(url) {
            loginUrl = String(url || '');
            if (!loginUrl) return false;
            opener = document.activeElement || button;
            if (typeof dialog.showModal === 'function') dialog.showModal();
            else dialog.setAttribute('open', '');
            login.focus({ preventScroll: true });
            return true;
        }
    };
}

function navigateToLogin(url) {
    if (typeof window === 'undefined') return;
    if (typeof window.location?.assign === 'function') window.location.assign(url);
    else if (window.location) window.location.href = url;
}

function setSaveButtonFeedback(button, state) {
    if (state === 'idle') delete button.dataset.saveFeedback;
    else button.dataset.saveFeedback = state;
    button.setAttribute('aria-busy', state === 'saving' ? 'true' : 'false');
}

async function saveAuthenticatedPlan(button) {
    config.setCanAutosave(true);
    button.dataset.saveFeedback = 'saving';
    button.setAttribute('aria-busy', 'true');
    const [result] = await Promise.all([savePlan({ immediate: true }), wait(500)]);
    return result;
}

function wait(milliseconds) {
    return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}
