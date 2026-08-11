export function createBracketResetDialog({ dialog, cancel, reset }) {
    function open() {
        if (!dialog) return false;
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        cancel?.focus();
        return true;
    }

    function close() {
        if (!dialog) return;
        if (typeof dialog.close === 'function' && dialog.open) dialog.close();
        else dialog.removeAttribute('open');
        reset?.focus();
    }

    return Object.freeze({ open, close });
}
