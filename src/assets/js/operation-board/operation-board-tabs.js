import { normalizeWarState } from '../cwl/cwl-war-state.js';
import { normalizeTag } from './operation-board-utils.js';

export const OPERATION_TABS = Object.freeze([
    'live',
    'league',
    'roster',
    'bonuses'
]);

export function getBoardIdentity(report, selectedClan = null) {
    const clan = report?.clan || selectedClan;
    const tag = normalizeTag(clan?.tag);
    if (!tag) return '';
    const mode = clan?.standalone ? 'standalone' : report?.plan?.id || 'planning';
    return `${mode}:${tag}`;
}

export function getDefaultOperationTab(report) {
    if (!hasUsableBoardData(report)) return null;
    const activeWar = (report.wars || []).some(war =>
        ['live', 'preparation'].includes(normalizeWarState(war))
    );
    const activeRound = (report.rounds || []).some(round =>
        ['live', 'preparation'].includes(round.state)
    );
    if (activeWar || activeRound) return 'live';
    if (report.phase === 'completed' || hasLeagueData(report)) return 'league';
    if (report.roster?.length) return 'roster';
    return null;
}

export function hasUsableBoardData(report) {
    return Boolean(
        report
        && (
            report.roster?.length
            || report.wars?.length
            || report.standings?.rows?.length
            || hasLeagueData(report)
        )
    );
}

export function applyOperationTabState(refs, activeTab) {
    const validTab = OPERATION_TABS.includes(activeTab) ? activeTab : null;
    refs.boardTabs.hidden = !validTab;
    refs.tabButtons.forEach(button => {
        const selected = button.dataset.opTab === validTab;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
    });
    Object.entries(refs.tabPanels).forEach(([tab, panel]) => {
        panel.hidden = tab !== validTab;
    });
}

export function getAdjacentOperationTab(currentTab, key) {
    const currentIndex = Math.max(0, OPERATION_TABS.indexOf(currentTab));
    if (key === 'Home') return OPERATION_TABS[0];
    if (key === 'End') return OPERATION_TABS[OPERATION_TABS.length - 1];
    if (key === 'ArrowRight') {
        return OPERATION_TABS[(currentIndex + 1) % OPERATION_TABS.length];
    }
    if (key === 'ArrowLeft') {
        return OPERATION_TABS[
            (currentIndex - 1 + OPERATION_TABS.length) % OPERATION_TABS.length
        ];
    }
    return null;
}

function hasLeagueData(report) {
    return (report?.rounds || []).some(round =>
        ['live', 'completed'].includes(round.state)
    ) || Boolean(report?.standings?.rows?.length);
}
