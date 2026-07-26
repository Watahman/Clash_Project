import { t } from '../i18n/i18n.js';
import { renderBonusAdvice } from './operation-board-bonus-renderer.js';
import { renderBoardContext } from './operation-board-context-renderer.js';
import {
    clearLeagueSections,
    renderLeagueSections
} from './operation-board-league-renderer.js';
import {
    clearLiveTab,
    renderLiveTab
} from './operation-board-live-renderer.js';
import {
    clearRosterMetrics,
    renderEmptyRoster,
    renderRoster,
    renderRosterMetrics,
    renderRosterViewOptions,
    syncRosterMode
} from './operation-board-roster-renderer.js';
import { stateText } from './operation-board-render-utils.js';
import { applyOperationTabState } from './operation-board-tabs.js';

export function renderBoard(
    refs,
    report,
    selectedClan = null,
    { activeTab = null, lastSyncAt = null, syncState = 'idle' } = {}
) {
    syncRosterMode(refs, report, selectedClan);
    renderPhase(refs, report.phase);
    setHelp(refs, report.wars.length ? t('op.liveLoaded') : t('op.noLeagueData'));
    renderRosterViewOptions(refs, report, selectedClan);
    renderLiveTab(refs, report);
    renderLeagueSections(refs, report);
    renderRosterMetrics(refs, report);
    renderRoster(refs, report, selectedClan);
    renderBonusAdvice(refs, report.roster);
    renderBoardContext(
        refs,
        report,
        selectedClan,
        { lastSyncAt, syncState }
    );
    applyOperationTabState(refs, activeTab);
}

export function clearBoard(refs, selectedClan = null, resetPhase = true) {
    clearLeagueSections(refs);
    clearLiveTab(refs);
    clearRosterMetrics(refs);
    refs.rosterBody.replaceChildren();
    renderEmptyRoster(refs, selectedClan);
    refs.bonusList.replaceChildren();
    refs.rosterCount.textContent = `0 ${t('op.players')}`;
    renderRosterViewOptions(refs, null, selectedClan);
    syncRosterMode(refs, null, selectedClan);
    renderBoardContext(refs, null, selectedClan);
    applyOperationTabState(refs, null);
    if (resetPhase) renderPhase(refs, 'unknown');
}

export function renderFilteredRoster(refs, report, selectedClan = null) {
    renderRoster(refs, report, selectedClan);
}

export function renderPhase(refs, phase = 'unknown') {
    refs.phase.textContent = stateText(phase);
    refs.phase.dataset.state = phase;
}

export function setHelp(refs, text, isError = false) {
    refs.help.textContent = text;
    refs.help.dataset.state = isError ? 'error' : 'info';
}

export function renderSyncState(refs, syncState, lastSyncAt = null) {
    refs.liveState.dataset.state = syncState;
    refs.refresh.disabled = syncState === 'loading';
    refs.refresh.setAttribute('aria-busy', String(syncState === 'loading'));
    if (syncState === 'loading') refs.liveState.textContent = t('op.syncing');
    else if (syncState === 'error') refs.liveState.textContent = t('op.syncError');
    else if (syncState === 'imported') {
        refs.liveState.textContent = t('op.importedState');
    } else if (syncState === 'ready' && lastSyncAt) {
        const time = new Intl.DateTimeFormat(
            document.documentElement.lang || undefined,
            { hour: '2-digit', minute: '2-digit' }
        ).format(lastSyncAt);
        refs.liveState.textContent = t('op.syncedAt', { time });
    } else refs.liveState.textContent = t('op.syncIdle');
}

export function refreshBoardLabels(
    refs,
    report,
    selectedClan,
    syncState,
    lastSyncAt,
    activeTab = null
) {
    refs.roundsList.dataset.emptyLabel = t('op.noPlayedRounds');
    refs.standingsList.dataset.emptyLabel = t('op.standingsFallback');
    refs.bonusList.dataset.emptyLabel = t('op.noRoster');
    renderSyncState(refs, syncState, lastSyncAt);
    if (report) {
        renderBoard(
            refs,
            report,
            selectedClan,
            { activeTab, lastSyncAt, syncState }
        );
    }
    else {
        renderPhase(refs, 'unknown');
        clearBoard(refs, selectedClan, false);
    }
}
