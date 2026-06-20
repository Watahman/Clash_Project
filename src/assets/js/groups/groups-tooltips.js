import { applyI18n, t } from "../i18n/i18n.js";

export function initGroupsTooltips({ collapseBtn, main }) {
    applyI18n(document);
    updateCollapseTooltip(collapseBtn, main);

    window.addEventListener('clashtools:language-changed', () => {
        applyI18n(document);
        updateCollapseTooltip(collapseBtn, main);
    });
}

export function updateCollapseTooltip(collapseBtn, main) {
    if (!collapseBtn || !main) return;
    const collapsed = main.classList.contains('sidebar-collapsed');
    const key = collapsed ? 'groups.expandSidebar' : 'groups.collapseSidebar';
    collapseBtn.setAttribute('aria-label', t(key));
    collapseBtn.setAttribute('title', t(key));
}
