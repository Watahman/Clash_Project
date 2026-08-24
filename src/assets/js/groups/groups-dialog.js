const FOCUSABLE_SELECTOR = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
    'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
].join(',');

const dialogState = new WeakMap();
const dialogStack = [];
const DIALOG_Z_INDEX = 90;

export function openGroupDialog(dialog, preferredFocus) {
    if (!dialog) return false;
    portalDialog(dialog);
    const previousState = dialogState.get(dialog);
    if (previousState?.onKeydown) document.removeEventListener('keydown', previousState.onKeydown, true);
    const previousFocus = document.activeElement;
    const state = { previousFocus, preferredFocus, onKeydown: null };
    state.onKeydown = event => handleDialogKeydown(event, dialog);
    dialogState.set(dialog, state);
    const existingIndex = dialogStack.indexOf(dialog);
    if (existingIndex >= 0) dialogStack.splice(existingIndex, 1);
    dialogStack.push(dialog);
    dialog.classList.remove('hidden');
    dialog.setAttribute('aria-hidden', 'false');
    syncDialogLayer();
    document.addEventListener('keydown', state.onKeydown, true);
    const target = preferredFocus || dialog.querySelector(FOCUSABLE_SELECTOR);
    window.requestAnimationFrame?.(() => target?.focus());
    return true;
}

export function closeGroupDialog(dialog, { restoreFocus = true } = {}) {
    if (!dialog) return false;
    const state = dialogState.get(dialog);
    dialog.classList.add('hidden');
    dialog.setAttribute('aria-hidden', 'true');
    if (state?.onKeydown) document.removeEventListener('keydown', state.onKeydown, true);
    dialogState.delete(dialog);
    const stackIndex = dialogStack.indexOf(dialog);
    if (stackIndex >= 0) dialogStack.splice(stackIndex, 1);
    dialog.style.removeProperty('z-index');
    syncDialogLayer();
    if (restoreFocus && state?.previousFocus?.isConnected) state.previousFocus.focus();
    return true;
}

function portalDialog(dialog) {
    if (dialog.parentElement !== document.body) document.body.appendChild(dialog);
}

function syncDialogLayer() {
    dialogStack.forEach((dialog, index) => {
        dialog.style.zIndex = String(DIALOG_Z_INDEX + index * 2);
    });
    const hasDialog = dialogStack.length > 0;
    document.body.classList.toggle('cf-overlay-open', hasDialog);
    document.querySelectorAll('.workspace-sidebar, .workspace-area').forEach(region => {
        region.inert = hasDialog;
    });
}

export function bindGroupDialog(dialog, close) {
    if (!dialog || typeof close !== 'function' || dialog.dataset.dialogBound === 'true') return false;
    dialog.dataset.dialogBound = 'true';
    dialog.addEventListener('click', event => {
        if (event.target === dialog) close();
    });
    dialog.querySelector('[data-dialog-close]')?.addEventListener('click', close);
    return true;
}

function handleDialogKeydown(event, dialog) {
    if (dialogStack.at(-1) !== dialog) return;
    if (event.key === 'Escape') {
        event.preventDefault();
        const close = dialog.querySelector('[data-dialog-close]');
        close?.click();
        return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}
