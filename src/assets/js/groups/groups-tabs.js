export const VALID_GROUP_TABS = new Set(['members', 'availability', 'polls', 'clans']);

export function activateGroupTab(root, tabName) {
    const safeTab = VALID_GROUP_TABS.has(tabName) ? tabName : 'members';
    root.querySelectorAll('[data-group-tab]').forEach(button => {
        const active = button.dataset.groupTab === safeTab;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
    });
    root.querySelectorAll('[data-group-panel]').forEach(panel => {
        panel.classList.toggle('is-visible', panel.dataset.groupPanel === safeTab);
    });
    return safeTab;
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
    return true;
}
