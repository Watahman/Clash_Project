export const VALID_GROUP_TABS = new Set(['overview', 'members', 'clans', 'polls', 'settings']);

const TAB_ALIASES = Object.freeze({ availability: 'polls' });

export function activateGroupTab(root, tabName) {
    const safeTab = normalizeGroupTab(tabName);
    root.querySelectorAll('[data-group-tab]').forEach(button => {
        const active = button.dataset.groupTab === safeTab;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
    });
    root.querySelectorAll('[data-group-panel]').forEach(panel => {
        panel.classList.toggle('is-visible', panel.dataset.groupPanel === safeTab);
        panel.hidden = panel.dataset.groupPanel !== safeTab;
    });
    return safeTab;
}

export function normalizeGroupTab(tabName) {
    const requested = String(tabName || '').trim().toLowerCase();
    const safeTab = TAB_ALIASES[requested] || requested;
    return VALID_GROUP_TABS.has(safeTab) ? safeTab : 'overview';
}

export function bindGroupTabs(root, onSelect) {
    const tabs = root.querySelector('.groups-detail-tabs');
    if (!tabs || tabs.dataset.listenerBound === 'true') return false;
    tabs.dataset.listenerBound = 'true';
    tabs.addEventListener('click', event => {
        const button = event.target.closest('[data-group-tab]');
        if (!button || !tabs.contains(button)) return;
        onSelect(button.dataset.groupTab);
    });
    tabs.addEventListener('keydown', event => {
        if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        const buttons = [...tabs.querySelectorAll('[data-group-tab]')];
        if (!buttons.length) return;
        const current = Math.max(0, buttons.indexOf(document.activeElement));
        const next = event.key === 'Home'
            ? 0
            : event.key === 'End'
                ? buttons.length - 1
                : (current + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
        event.preventDefault();
        buttons[next].focus();
        onSelect(buttons[next].dataset.groupTab);
    });
    return true;
}
