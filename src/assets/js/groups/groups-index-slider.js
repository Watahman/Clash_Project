import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';

const GROUP_INDEX_COLLAPSED_KEY = 'clashtools_groups_index_collapsed';
const COLLAPSED_CLASS = 'is-group-index-collapsed';

function readCollapsedState() {
    try {
        return localStorage.getItem(GROUP_INDEX_COLLAPSED_KEY) === 'true';
    } catch {
        return false;
    }
}

function storeCollapsedState(collapsed) {
    try {
        localStorage.setItem(GROUP_INDEX_COLLAPSED_KEY, String(collapsed));
    } catch {
        // The slider still works when browser storage is unavailable.
    }
}

export function initGroupIndexSlider(workspace, toggle) {
    if (!workspace || !toggle || toggle.dataset.groupsIndexSliderBound === 'true') {
        return false;
    }

    const applyState = (collapsed, { persist = true } = {}) => {
        workspace.classList.toggle(COLLAPSED_CLASS, collapsed);
        toggle.setAttribute('aria-expanded', String(!collapsed));
        const label = t(collapsed ? 'groups.expandFamilyList' : 'groups.collapseFamilyList');
        toggle.setAttribute('aria-label', label);
        toggle.title = label;
        if (persist) storeCollapsedState(collapsed);
    };

    toggle.dataset.groupsIndexSliderBound = 'true';
    applyState(readCollapsedState(), { persist: false });

    toggle.addEventListener('click', () => {
        applyState(!workspace.classList.contains(COLLAPSED_CLASS));
    });

    window.addEventListener('clashtools:language-changed', () => {
        applyState(workspace.classList.contains(COLLAPSED_CLASS), { persist: false });
    });

    return true;
}
