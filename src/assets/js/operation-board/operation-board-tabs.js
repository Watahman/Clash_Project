import { normalizeWarState } from '../cwl/cwl-war-state.js';
import { normalizeTag } from './operation-board-utils.js';

export const OPERATION_TABS = Object.freeze([
    'live',
    'league',
    'roster',
    'bonuses'
]);
export const HISTORICAL_OPERATION_TABS = Object.freeze([
    'summary',
    'league',
    'roster'
]);

export function getBoardIdentity(report, selectedClan = null) {
    const clan = report?.clan || selectedClan;
    const tag = normalizeTag(clan?.tag);
    if (!tag) return '';
    const mode = clan?.standalone ? 'standalone' : report?.plan?.id || 'planning';
    const boardMode = report?.mode || 'current';
    const season = report?.season || report?.leagueGroup?.season || '';
    return boardMode === 'current'
        ? `${mode}:${tag}`
        : `${mode}:${tag}:${boardMode}:${season}`;
}

export function getDefaultOperationTab(report) {
    if (!hasUsableBoardData(report)) return null;
    if (report.mode === 'historical') return 'summary';
    if (report.mode === 'overview') return null;
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
            report.mode === 'historical'
            || report.roster?.length
            || report.wars?.length
            || report.standings?.rows?.length
            || hasLeagueData(report)
        )
    );
}

export function applyOperationTabState(
    refs,
    activeTab,
    mode = 'current'
) {
    const tabs = tabsForMode(mode);
    const validTab = tabs.includes(activeTab) ? activeTab : null;
    refs.boardTabs.hidden = !validTab;
    refs.tabButtons.forEach(button => {
        const available = tabs.includes(button.dataset.opTab);
        button.hidden = !available;
        const selected = button.dataset.opTab === validTab;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
    });
    Object.entries(refs.tabPanels).forEach(([tab, panel]) => {
        panel.hidden = tab !== validTab;
    });
}

export function getAdjacentOperationTab(currentTab, key, mode = 'current') {
    const tabs = tabsForMode(mode);
    const currentIndex = Math.max(0, tabs.indexOf(currentTab));
    if (key === 'Home') return tabs[0];
    if (key === 'End') return tabs[tabs.length - 1];
    if (key === 'ArrowRight') {
        return tabs[(currentIndex + 1) % tabs.length];
    }
    if (key === 'ArrowLeft') {
        return tabs[
            (currentIndex - 1 + tabs.length) % tabs.length
        ];
    }
    return null;
}

function tabsForMode(mode) {
    return mode === 'historical'
        ? HISTORICAL_OPERATION_TABS
        : mode === 'overview' ? [] : OPERATION_TABS;
}

function hasLeagueData(report) {
    return (report?.rounds || []).some(round =>
        ['live', 'completed'].includes(round.state)
    ) || Boolean(report?.standings?.rows?.length);
}
