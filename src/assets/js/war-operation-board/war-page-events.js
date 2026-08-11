export function bindWarPageEvents({
    refs,
    root = document,
    selectClan,
    submitClan,
    loadWar,
    selectTab,
    onMapSide,
    renderCurrent,
    getReport,
    handleBoardClick,
    handleAssignmentSubmit,
    renderRoster
}) {
    bindSourceControls(refs, selectClan, submitClan);
    bindWarTabs(root, selectTab);
    bindMapControls(root, onMapSide, renderCurrent);
    root.addEventListener('click', handleBoardClick);
    root.addEventListener('submit', handleAssignmentSubmit);
    refs.rosterFilter.addEventListener('change', () =>
        renderRoster(refs.roster, getReport(), refs.rosterFilter.value)
    );
    refs.refresh.addEventListener('click', () => void loadWar(true));
}

function bindSourceControls(refs, selectClan, submitClan) {
    refs.clanSelect.addEventListener('change', () => {
        if (refs.clanSelect.value) void selectClan(refs.clanSelect.value);
    });
    refs.tagForm.addEventListener('submit', event => {
        event.preventDefault();
        submitClan(refs.tagInput.value);
    });
}

function bindWarTabs(root, selectTab) {
    root.querySelector('.war-tabs').addEventListener('click', event => {
        const button = event.target.closest('[data-war-tab]');
        if (button) selectTab(button.dataset.warTab);
    });
    root.querySelectorAll('[data-war-tab]').forEach(button => {
        button.addEventListener('keydown', event => {
            const tabs = Array.from(root.querySelectorAll('[data-war-tab]'));
            const index = tabs.indexOf(button);
            const next = tabFromKey(event.key, tabs, index);
            if (!next) return;
            event.preventDefault();
            selectTab(next.dataset.warTab);
            next.focus();
        });
    });
}

function bindMapControls(root, onMapSide, renderCurrent) {
    root.querySelector('.war-side-switch').addEventListener('click', event => {
        const button = event.target.closest('[data-map-side]');
        if (!button) return;
        onMapSide(button.dataset.mapSide);
        root.querySelectorAll('[data-map-side]').forEach(item =>
            item.setAttribute('aria-pressed', String(item === button))
        );
        renderCurrent();
    });
}

function tabFromKey(key, tabs, index) {
    if (key === 'ArrowRight') return tabs[(index + 1) % tabs.length];
    if (key === 'ArrowLeft') return tabs[(index - 1 + tabs.length) % tabs.length];
    if (key === 'Home') return tabs[0];
    if (key === 'End') return tabs[tabs.length - 1];
    return null;
}
