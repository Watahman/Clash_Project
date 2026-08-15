import { emptyAnalysisScopes, normalizeAnalysisScopes } from './advanced-stats-analysis-scopes.js?v=20260814-advanced-stats-v4';

const ACTIVE_PHASES = new Set(['QUEUED', 'FETCHING', 'PROCESSING', 'AGGREGATING']);
const PHASE_ALIASES = new Map([
    ['STARTING', 'QUEUED'],
    ['PENDING', 'QUEUED'],
    ['NOT_STARTED', 'QUEUED'],
    ['COLLECTING', 'FETCHING'],
    ['FETCH', 'FETCHING'],
    ['BOOTSTRAPPING', 'FETCHING'],
    ['PARSING', 'PROCESSING'],
    ['CALCULATING', 'PROCESSING'],
    ['RUNNING', 'PROCESSING'],
    ['AGGREGATE', 'AGGREGATING'],
    ['AGGREGATES', 'AGGREGATING'],
    ['COMPLETE', 'READY'],
    ['COMPLETED', 'READY'],
    ['DONE', 'READY'],
    ['INCREMENTAL', 'READY'],
    ['FAILED', 'ERROR']
]);
const COVERAGE_ALIASES = new Map([
    ['AVAILABLE', 'available'],
    ['SUPPORTED', 'available'],
    ['FULL', 'available'],
    ['COMPLETE', 'available'],
    ['TRUE', 'available'],
    ['UNAVAILABLE', 'unavailable'],
    ['UNSUPPORTED', 'unavailable'],
    ['FALSE', 'unavailable'],
    ['PARTIAL', 'partial'],
    ['LIMITED', 'partial']
]);
const SOURCE_LABELS = Object.freeze({
    CLASHKING: 'ClashKing',
    CLASHKING_V2: 'ClashKing',
    CLASHKINGV2: 'ClashKing',
    CLASHKING_LEGACY: 'ClashKing',
    V2: 'ClashKing',
    LEGACY: 'ClashKing',
    V2_WITH_LEGACY_FALLBACK: 'ClashKing',
    CLASHKING_V2_WITH_CLASHKING_LEGACY_FALLBACK: 'ClashKing',
    OFFICIAL_BATTLELOG: 'Official battle log',
    OFFICIAL_BATTLE_LOG: 'Official battle log',
    COC_BATTLELOG: 'Official battle log',
    COC_BATTLE_LOG: 'Official battle log',
    RANKED_BATTLELOG: 'Ranked battle log',
    RANKED_BATTLE_LOG: 'Ranked battle log',
    CLASH_OF_CLANS: 'Clash of Clans'
});

function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function normalizePhase(value) {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return '';
    return PHASE_ALIASES.get(raw) || raw;
}

function analysisPayload(tracking) {
    return tracking?.analysis || tracking?.historyAnalysis || tracking?.bootstrap || {};
}

function explicitPhase(tracking) {
    return normalizePhase(
        tracking?.analysisPhase
        || tracking?.analysisStatus
        || tracking?.bootstrapPhase
        || tracking?.analysisBootstrapStatus
        || tracking?.bootstrapStatus
        || tracking?.historyPhase
        || tracking?.historyStatus
        || analysisPayload(tracking).phase
        || analysisPayload(tracking).status
    );
}

function completedAt(tracking) {
    const analysis = analysisPayload(tracking);
    return tracking?.bootstrapCompletedAt
        || tracking?.analysisCompletedAt
        || tracking?.historyCompletedAt
        || analysis.completedAt
        || tracking?.dataCompleteSince;
}

function inferPhase(tracking, phase) {
    if (phase) return phase;
    const status = String(tracking?.status || '').trim().toUpperCase();
    if (status === 'INITIALIZING') return 'PROCESSING';
    if (status === 'ERROR' && !completedAt(tracking)) return 'ERROR';
    if (tracking?.trackingExists || completedAt(tracking)) return 'READY';
    return 'IDLE';
}

function progressValue(tracking, phase) {
    const analysis = analysisPayload(tracking);
    const explicit = numberOrNull(
        tracking?.phaseProgress
        ?? tracking?.analysisProgress
        ?? tracking?.bootstrapProgress
        ?? analysis.progress
    );
    if (explicit !== null) {
        if (phase === 'UNSUPPORTED') return null;
        const terminalWithoutFullHistory = ['PARTIAL', 'UNSUPPORTED'].includes(phase) && explicit >= 100;
        return terminalWithoutFullHistory ? null : Math.max(0, Math.min(100, explicit));
    }
    return phase === 'READY' ? 100 : null;
}

function coverageValue(value) {
    if (typeof value === 'boolean') return value ? 'available' : 'unavailable';
    if (value && typeof value === 'object') {
        if (typeof value.available === 'boolean') return value.available ? 'available' : 'unavailable';
        if (typeof value.supported === 'boolean') return value.supported ? 'available' : 'unavailable';
        return coverageValue(value.coverageStatus || value.state || value.status || value.coverage || value.capabilityStatus);
    }
    const normalized = String(value || '').trim().toUpperCase();
    return COVERAGE_ALIASES.get(normalized) || 'unknown';
}

export function normalizeCoverage(source) {
    return Object.fromEntries(Object.entries(normalizeCoverageDetails(source)).map(([kind, detail]) => [kind, detail.state]));
}

function sourceKey(value) {
    return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function sourceLabel(value) {
    return SOURCE_LABELS[sourceKey(value)] || '';
}

function coverageSource(value) {
    if (!value || typeof value !== 'object') return '';
    const nested = value.source && typeof value.source === 'object' ? value.source : {};
    const candidates = [
        value.sourceLabel, value.sourceName, value.providerLabel, value.provider,
        nested.sourceLabel, nested.sourceName, nested.providerLabel, nested.provider,
        typeof value.source === 'string' ? value.source : ''
    ];
    return candidates.map(sourceLabel).find(Boolean) || '';
}

function coverageReason(value) {
    if (!value || typeof value !== 'object') return '';
    return String(value.reasonLabel || value.displayReason || '').trim();
}

function coverageDetail(value) {
    return { state: coverageValue(value), source: coverageSource(value), reason: coverageReason(value) };
}

export function normalizeCoverageDetails(source) {
    return Object.fromEntries(['normal', 'war', 'ranked'].map(kind => {
        const value = coverageEntry(source, kind);
        return [kind, coverageDetail(value)];
    }));
}

function coverageEntry(source, kind) {
    if (!source || typeof source !== 'object') return null;
    if (Array.isArray(source)) {
        const aliases = kind === 'ranked' ? ['ranked', 'rankedLegend', 'ranked_legend'] : [kind];
        return source.find(entry => aliases.includes(String(entry?.scope || '').trim().toLowerCase())) || null;
    }
    if (kind === 'ranked') {
        return source.ranked ?? source.rankedLegend ?? source.ranked_legend
            ?? source.RANKED ?? source.RANKED_LEGEND;
    }
    return source[kind] ?? source[kind.toUpperCase()];
}

function hasCoverageEntries(source) {
    if (Array.isArray(source)) return source.some(entry => Boolean(entry?.scope));
    return Boolean(source && typeof source === 'object'
        && ['normal', 'war', 'ranked', 'rankedLegend', 'ranked_legend', 'NORMAL', 'WAR', 'RANKED', 'RANKED_LEGEND']
            .some(key => Object.prototype.hasOwnProperty.call(source, key)));
}

function coveragePayload(tracking) {
    const analysis = analysisPayload(tracking);
    const candidates = [
        tracking?.coverage,
        tracking?.analysisCoverage,
        tracking?.dataCoverage,
        tracking?.scopeCoverage,
        tracking?.analysisScopes,
        tracking?.scopes,
        analysis.coverage,
        analysis.scopeCoverage,
        analysis.coverageDetails,
        tracking
    ];
    return candidates.find(hasCoverageEntries) || {};
}

function analysisCoverage(tracking) {
    return normalizeCoverage(coveragePayload(tracking));
}

function analysisCoverageDetails(tracking) {
    return normalizeCoverageDetails(coveragePayload(tracking));
}

export function normalizeAnalysis(tracking) {
    const analysis = analysisPayload(tracking);
    const phase = inferPhase(tracking, explicitPhase(tracking));
    const status = String(tracking?.status || '').trim().toUpperCase();
    const errorCode = tracking?.analysisErrorCode || tracking?.errorCode || analysis.errorCode || null;
    const error = phase === 'ERROR' || (status === 'ERROR' && !completedAt(tracking))
        || (phase === 'UNKNOWN' && Boolean(errorCode));
    return {
        phase,
        progress: progressValue(tracking, phase),
        active: ACTIVE_PHASES.has(phase),
        ready: ['READY', 'PARTIAL', 'UNSUPPORTED'].includes(phase),
        terminal: ['READY', 'PARTIAL', 'UNSUPPORTED'].includes(phase),
        error,
        retryable: tracking?.retryable !== false && analysis.retryable !== false,
        errorCode,
        coverage: analysisCoverage(tracking),
        coverageDetails: analysisCoverageDetails(tracking),
        scopes: normalizeAnalysisScopes(tracking, phase),
        battlesAvailable: numberOrNull(tracking?.battlesAvailable ?? tracking?.historyBattlesAvailable
            ?? tracking?.analysisTotal ?? analysis.battlesAvailable ?? analysis.total),
        battlesProcessed: numberOrNull(tracking?.battlesProcessed ?? tracking?.historyBattlesProcessed
            ?? tracking?.analysisProcessed ?? analysis.battlesProcessed ?? analysis.processed),
        lastProcessedAt: tracking?.lastProcessedAt || tracking?.historyLastProcessedAt || analysis.lastProcessedAt || null,
        updatedAt: tracking?.updatedAt || tracking?.analysisUpdatedAt || tracking?.lastPollAt || analysis.updatedAt || null
    };
}

export function queuedAnalysis() {
    return {
        phase: 'QUEUED',
        progress: 0,
        active: true,
        ready: false,
        error: false,
        retryable: true,
        errorCode: null,
        coverage: normalizeCoverage(),
        coverageDetails: normalizeCoverageDetails(),
        scopes: emptyAnalysisScopes(),
        battlesAvailable: null,
        battlesProcessed: null,
        lastProcessedAt: null,
        updatedAt: null
    };
}

function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export async function pollHistoryAnalysis({
    fetchStatus,
    initial,
    onUpdate,
    isStale = () => false,
    interval = 1500,
    maxAttempts = 240
}) {
    let current = normalizeAnalysis(initial);
    for (let attempt = 0; attempt < maxAttempts && current.active; attempt += 1) {
        if (interval > 0) await wait(interval);
        if (isStale()) return null;
        let tracking;
        try {
            tracking = await fetchStatus();
        } catch (error) {
            return {
                ...current,
                phase: 'ERROR',
                active: false,
                ready: false,
                error: true,
                retryable: true,
                errorCode: error?.code || 'ANALYSIS_STATUS_UNAVAILABLE'
            };
        }
        current = normalizeAnalysis(tracking);
        await onUpdate?.(tracking, current);
    }
    return current;
}
