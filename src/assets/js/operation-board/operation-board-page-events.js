import { getAdjacentOperationTab } from './operation-board-tabs.js';

export function bindOperationBoardEvents(refs, handlers) {
    refs.planSelect.onchange = () => handlers.selectPlan(refs.planSelect.value);
    refs.clanSelect.onchange = () => handlers.selectClan(refs.clanSelect.value);
    refs.refresh.onclick = handlers.refresh;
    refs.rosterFilter.oninput = handlers.filterRoster;
    refs.rosterView.onchange = handlers.filterRoster;
    refs.exportBtn.onclick = handlers.exportReport;
    refs.importBtn.onclick = () => refs.importFile.click();
    refs.importFile.onchange = () => handlers.importFile(refs.importFile.files?.[0]);
    refs.standaloneLoad.onclick = handlers.loadStandalone;
    refs.standaloneInput.onkeydown = event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        handlers.loadStandalone();
    };
    refs.tabButtons.forEach(button => {
        button.onclick = () => handlers.selectTab(button.dataset.opTab);
        button.onkeydown = event => {
            const tab = getAdjacentOperationTab(button.dataset.opTab, event.key);
            if (!tab) return;
            event.preventDefault();
            handlers.selectTab(tab, true);
        };
    });
    window.addEventListener('clashtools:language-changed', handlers.refreshLabels);
}
