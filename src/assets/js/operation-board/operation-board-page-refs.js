export function initOperationBoardRefs(root = document) {
    const selectors = {
        planSelect: '#op-plan-select',
        clanSelect: '#op-clan-select',
        refresh: '#op-refresh',
        exportBtn: '#op-export',
        importBtn: '#op-import-json',
        importFile: '#op-import-file',
        standaloneInput: '#op-standalone-clan-tag',
        standaloneLoad: '#op-standalone-load',
        liveState: '#op-live-state',
        phase: '#op-cwl-phase',
        help: '#op-help',
        boardContext: '#op-board-context',
        boardTabs: '#op-board-tabs',
        liveContent: '#op-live-content',
        completedRounds: '#op-completed-rounds',
        currentPosition: '#op-current-position',
        projectedFinish: '#op-projected-finish',
        finishProbabilities: '#op-finish-probabilities',
        record: '#op-record',
        starsChart: '#op-stars-chart',
        starsChartState: '#op-stars-chart-state',
        positionChart: '#op-position-chart',
        positionChartState: '#op-position-chart-state',
        roundsList: '#op-rounds-list',
        roundState: '#op-round-state',
        roundCount: '#op-round-count',
        standingsState: '#op-standings-state',
        standingsList: '#op-standings-list',
        standingsNote: '#op-standings-note',
        rosterCount: '#op-roster-count',
        rosterBody: '#op-roster-body',
        rosterPlanningHeader: '[data-op-roster-column="planning"]',
        rosterFilter: '#op-roster-filter',
        rosterView: '#op-roster-view',
        bonusPanel: '#op-bonus-calculator',
        bonusRecipientCount: '#op-bonus-recipient-count',
        bonusRecipientSource: '#op-bonus-recipient-source',
        bonusCustomWeights: '#op-bonus-custom-weights',
        bonusWeightTotal: '#op-bonus-weight-total',
        bonusProvisional: '#op-bonus-provisional',
        bonusList: '#op-bonus-list',
        bonusDetail: '#op-bonus-detail'
    };
    const refs = Object.fromEntries(
        Object.entries(selectors).map(([key, selector]) => [
            key,
            root.querySelector(selector)
        ])
    );
    refs.tabButtons = Array.from(root.querySelectorAll('[data-op-tab]'));
    refs.bonusStrategyButtons = Array.from(
        root.querySelectorAll('[data-bonus-strategy]')
    );
    refs.bonusWeightInputs = Object.fromEntries(
        Array.from(root.querySelectorAll('[data-bonus-weight]')).map(input => [
            input.dataset.bonusWeight,
            input
        ])
    );
    refs.tabPanels = Object.fromEntries(
        refs.tabButtons.map(button => [
            button.dataset.opTab,
            root.querySelector(`#${button.getAttribute('aria-controls')}`)
        ])
    );
    return refs;
}
