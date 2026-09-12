export function createAdvancedStatsPageUi({ elements, state, renderAccountSelector }) {
    function setPageStatus(message = '', type = '') {
        if (!elements.pageStatus) return;
        elements.pageStatus.textContent = message;
        elements.pageStatus.dataset.state = type;
        elements.pageStatus.hidden = !message;
    }

    function setDataStatus(message = '', type = '') {
        if (!elements.dataStatus) return;
        elements.dataStatus.textContent = message;
        elements.dataStatus.dataset.state = type;
    }

    function setBusy(busy) {
        state.busy = busy;
        document.querySelectorAll('.advanced-stats button, .advanced-stats select').forEach(control => {
            control.disabled = busy || (control === elements.account && state.accounts.length < 2);
        });
        renderAccountSelector(elements, state);
    }

    return { setDataStatus, setBusy, setPageStatus };
}
