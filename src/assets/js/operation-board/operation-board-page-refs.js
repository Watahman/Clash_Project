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
        totalStars: '#op-total-stars',
        avgDestruction: '#op-avg-destruction',
        completedRounds: '#op-completed-rounds',
        currentPosition: '#op-current-position',
        projectedFinish: '#op-projected-finish',
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
        bonusList: '#op-bonus-list'
    };
    const refs = Object.fromEntries(
        Object.entries(selectors).map(([key, selector]) => [
            key,
            root.querySelector(selector)
        ])
    );
    refs.tabButtons = Array.from(root.querySelectorAll('[data-op-tab]'));
    refs.tabPanels = Object.fromEntries(
        refs.tabButtons.map(button => [
            button.dataset.opTab,
            root.querySelector(`#${button.getAttribute('aria-controls')}`)
        ])
    );
    return refs;
}
