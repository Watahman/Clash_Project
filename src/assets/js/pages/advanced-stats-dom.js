const ELEMENT_IDS = Object.freeze({
    account: 'advanced-stats-account', noAccounts: 'advanced-stats-no-accounts', openProfile: 'advanced-stats-open-profile',
    profileError: 'advanced-stats-profile-error', profileRetry: 'advanced-stats-profile-retry', trackingError: 'advanced-stats-tracking-error', trackingRetry: 'advanced-stats-tracking-retry', pageStatus: 'advanced-stats-page-status',
    notTracking: 'advanced-stats-not-tracking', start: 'advanced-stats-start', initializing: 'advanced-stats-initializing', content: 'advanced-stats-content',
    analysisLoading: 'advanced-stats-initializing', analysisTitle: 'advanced-stats-analysis-title', analysisText: 'advanced-stats-analysis-text', analysisStatus: 'advanced-stats-analysis-status',
    analysisProgress: 'advanced-stats-analysis-progress', analysisProcessed: 'advanced-stats-analysis-processed', analysisAvailable: 'advanced-stats-analysis-available', analysisError: 'advanced-stats-analysis-error', analysisRetry: 'advanced-stats-analysis-retry',
    analysisCoverageNormal: 'advanced-stats-analysis-coverage-normal', analysisCoverageNormalMeta: 'advanced-stats-analysis-coverage-normal-meta', analysisCoverageWar: 'advanced-stats-analysis-coverage-war', analysisCoverageWarMeta: 'advanced-stats-analysis-coverage-war-meta', analysisCoverageRanked: 'advanced-stats-analysis-coverage-ranked', analysisCoverageRankedMeta: 'advanced-stats-analysis-coverage-ranked-meta',
    dashboardCoverageNormal: 'advanced-stats-dashboard-coverage-normal', dashboardCoverageNormalMeta: 'advanced-stats-dashboard-coverage-normal-meta', dashboardCoverageWar: 'advanced-stats-dashboard-coverage-war', dashboardCoverageWarMeta: 'advanced-stats-dashboard-coverage-war-meta', dashboardCoverageRanked: 'advanced-stats-dashboard-coverage-ranked', dashboardCoverageRankedMeta: 'advanced-stats-dashboard-coverage-ranked-meta',
    trackingBar: '.advanced-stats__tracking-bar', trackingTitle: 'advanced-stats-tracking-title', playerLine: 'advanced-stats-player-line',
    startedAt: 'advanced-stats-started-at', updatedAt: 'advanced-stats-updated-at', battlesProcessed: 'advanced-stats-battles-processed',
    refresh: 'advanced-stats-refresh', pause: 'advanced-stats-pause', resume: 'advanced-stats-resume', stop: 'advanced-stats-stop', delete: 'advanced-stats-delete',
    warning: 'advanced-stats-warning', warningTitle: 'advanced-stats-warning-title', warningText: 'advanced-stats-warning-text', completeSince: 'advanced-stats-complete-since',
    periods: 'advanced-stats-periods', attackCategories: 'advanced-stats-categories', trendMetrics: 'advanced-stats-trend-metrics', dataStatus: 'advanced-stats-data-status', kpiAttacks: 'advanced-stats-kpi-attacks', kpiStars: 'advanced-stats-kpi-stars',
    kpiThreeStar: 'advanced-stats-kpi-three-star', kpiDestruction: 'advanced-stats-kpi-destruction', favoriteTroop: 'advanced-stats-favorite-troop',
    favoriteTroopMeta: 'advanced-stats-favorite-troop-meta', favoriteTroopImage: 'advanced-stats-favorite-troop-image', favoriteSpell: 'advanced-stats-favorite-spell',
    favoriteSpellMeta: 'advanced-stats-favorite-spell-meta', favoriteSpellImage: 'advanced-stats-favorite-spell-image', favoriteSiege: 'advanced-stats-favorite-siege',
    favoriteSiegeMeta: 'advanced-stats-favorite-siege-meta', favoriteSiegeImage: 'advanced-stats-favorite-siege-image', favoriteArmy: 'advanced-stats-favorite-army',
    favoriteArmyMeta: 'advanced-stats-favorite-army-meta', favoriteArmyImage: 'advanced-stats-favorite-army-image', lifetimeSection: 'advanced-stats-lifetime-section', lifetimeAvailability: 'advanced-stats-lifetime-availability', lifetimeTotalStars: 'advanced-stats-lifetime-total-stars', lifetimeTotalDestruction: 'advanced-stats-lifetime-total-destruction', lifetimePerfectAttacks: 'advanced-stats-lifetime-perfect-attacks', lifetimeBestStreak: 'advanced-stats-lifetime-best-streak', lifetimeTripleCount: 'advanced-stats-lifetime-triple-count', lifetimeTrackedDays: 'advanced-stats-lifetime-tracked-days', lifetimeCurrentStreak: 'advanced-stats-lifetime-current-streak', lifetimeMostActiveMonth: 'advanced-stats-lifetime-most-active-month', lifetimeBestPerformanceMonth: 'advanced-stats-lifetime-best-performance-month', lifetimeStarZero: 'advanced-stats-lifetime-star-zero', lifetimeStarOne: 'advanced-stats-lifetime-star-one', lifetimeStarTwo: 'advanced-stats-lifetime-star-two', lifetimeStarThree: 'advanced-stats-lifetime-star-three', lifetimeStarUnknown: 'advanced-stats-lifetime-star-unknown', lifetimeCategory: 'advanced-stats-lifetime-category-comparison', lifetimeFavorites: 'advanced-stats-lifetime-favorites', lifetimeSuccessfulArmy: 'advanced-stats-lifetime-successful-army', lootCards: 'advanced-stats-loot-cards', lootAttackCount: 'advanced-stats-loot-attack-count', lootTrend: 'advanced-stats-loot-trend', trendChart: 'advanced-stats-trend-chart',
    trendEmpty: 'advanced-stats-trend-empty', armies: 'advanced-stats-armies', armiesEmpty: 'advanced-stats-armies-empty', unitCategory: 'advanced-stats-unit-category',
    units: 'advanced-stats-units', unitsMobile: 'advanced-stats-units-mobile', unitsTableWrap: 'advanced-stats-units-table-wrap', unitsEmpty: 'advanced-stats-units-empty',
    battles: 'advanced-stats-battles', battlesEmpty: 'advanced-stats-battles-empty', loadMore: 'advanced-stats-load-more', dialog: 'advanced-stats-confirm-dialog',
    dialogForm: 'advanced-stats-confirm-form', dialogTitle: 'advanced-stats-dialog-title', dialogCopy: 'advanced-stats-dialog-copy', dialogCancel: 'advanced-stats-dialog-cancel',
    dialogConfirm: 'advanced-stats-dialog-confirm', dialogError: 'advanced-stats-dialog-error', deleteField: 'advanced-stats-delete-field', deleteInput: 'advanced-stats-delete-input'
});

export function cacheAdvancedStatsElements() {
    return Object.fromEntries(Object.entries(ELEMENT_IDS).map(([key, id]) => [
        key,
        id.startsWith('.') ? document.querySelector(id) : document.getElementById(id)
    ]));
}

export function emptyAdvancedStatsSectionStates() {
    return { overview: 'idle', units: 'idle', armies: 'idle', trends: 'idle', battles: 'idle' };
}

export function readAdvancedStatsPreference(key) {
    try {
        return localStorage.getItem(key) || '';
    } catch {
        return '';
    }
}

export function writeAdvancedStatsPreference(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Preferences are optional when storage is unavailable.
    }
}
