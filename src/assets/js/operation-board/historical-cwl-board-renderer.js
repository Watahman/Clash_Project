import {
    clearBonusCalculator
} from './operation-board-bonus-renderer.js';
import { renderBoardContext } from './operation-board-context-renderer.js';
import {
    clearLeagueSections,
    renderLeagueSections
} from './operation-board-league-renderer.js';
import { clearLiveTab } from './operation-board-live-renderer.js';
import {
    renderEmptyRoster,
    renderRoster,
    renderRosterViewOptions,
    syncRosterMode
} from './operation-board-roster-renderer.js';
import { applyOperationTabState } from './operation-board-tabs.js';
import {
    clearHistoricalOverview,
    renderHistoricalOverview
} from './historical-cwl-overview-renderer.js';
import {
    clearHistoricalSummary,
    renderHistoricalSummary
} from './historical-cwl-summary-renderer.js';

export function renderHistoricalBoard(
    refs,
    report,
    selectedClan,
    {
        activeTab = 'summary',
        lastSyncAt = null,
        syncState = 'ready'
    } = {}
) {
    if (refs.exportBtn) refs.exportBtn.disabled = false;
    refs.historyOverview.hidden = true;
    clearHistoricalOverview(refs.historyOverview);
    syncRosterMode(refs, report, selectedClan);
    refs.phase.textContent = 'Historical';
    refs.phase.dataset.state = 'completed';
    refs.help.textContent = 'Completed CWL season loaded from ClashKing history.';
    refs.help.dataset.state = 'info';
    renderHistoricalSummary(refs.historySummary, report);
    clearLiveTab(refs);
    renderLeagueSections(refs, report);
    renderRosterViewOptions(refs, report, selectedClan);
    renderRoster(refs, report, selectedClan);
    clearBonusCalculator(refs);
    renderBoardContext(
        refs,
        report,
        selectedClan,
        { lastSyncAt, syncState }
    );
    applyOperationTabState(refs, activeTab, 'historical');
}

export function renderOverviewBoard(
    refs,
    overview,
    selectedClan,
    { selectSeason } = {}
) {
    if (refs.exportBtn) refs.exportBtn.disabled = true;
    clearHistoricalSummary(refs.historySummary);
    clearLeagueSections(refs);
    clearLiveTab(refs);
    refs.rosterBody.replaceChildren();
    renderEmptyRoster(refs, selectedClan);
    clearBonusCalculator(refs);
    refs.historyOverview.hidden = false;
    refs.phase.textContent = 'Overview';
    refs.phase.dataset.state = 'completed';
    refs.help.textContent = 'Multi-season CWL history from ClashKing. Seasons load in a controlled batch.';
    refs.help.dataset.state = 'info';
    renderHistoricalOverview(
        refs.historyOverview,
        overview,
        { selectSeason }
    );
    renderBoardContext(
        refs,
        {
            mode: 'overview',
            clan: selectedClan,
            wars: [],
            rounds: []
        },
        selectedClan
    );
    applyOperationTabState(refs, null, 'overview');
}

export function clearHistoricalBoard(refs) {
    if (refs.exportBtn) refs.exportBtn.disabled = false;
    if (refs.historyOverview) refs.historyOverview.hidden = true;
    clearHistoricalOverview(refs.historyOverview);
    clearHistoricalSummary(refs.historySummary);
}
