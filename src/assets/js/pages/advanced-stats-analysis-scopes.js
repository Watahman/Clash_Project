const ACTIVE_PHASES = new Set(['QUEUED', 'FETCHING', 'PROCESSING', 'AGGREGATING']);
const PHASE_ALIASES = new Map([
    ['STARTING', 'QUEUED'], ['PENDING', 'QUEUED'], ['NOT_STARTED', 'QUEUED'],
    ['COLLECTING', 'FETCHING'], ['FETCH', 'FETCHING'],
    ['BOOTSTRAPPING', 'FETCHING'],
    ['PARSING', 'PROCESSING'], ['CALCULATING', 'PROCESSING'], ['RUNNING', 'PROCESSING'],
    ['AGGREGATE', 'AGGREGATING'], ['AGGREGATES', 'AGGREGATING'],
    ['COMPLETE', 'READY'], ['COMPLETED', 'READY'], ['DONE', 'READY'], ['INCREMENTAL', 'READY'], ['FAILED', 'ERROR']
]);
const SCOPE_ALIASES = Object.freeze({
    normal: ['normal', 'NORMAL'],
    war: ['war', 'WAR'],
    ranked: ['ranked', 'rankedLegend', 'ranked_legend', 'RANKED', 'RANKED_LEGEND']
});

function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function normalizePhase(value) {
    const raw = String(value || '').trim().toUpperCase();
    return raw ? PHASE_ALIASES.get(raw) || raw : 'QUEUED';
}

function scopeValue(source, kind) {
    if (!source || typeof source !== 'object') return null;
    if (Array.isArray(source)) {
        const aliases = SCOPE_ALIASES[kind].map(key => key.toLowerCase());
        return source.find(entry => aliases.includes(String(entry?.scope || '').trim().toLowerCase())) || null;
    }
    return SCOPE_ALIASES[kind].map(key => source[key]).find(value => value !== undefined) || null;
}

function phaseValue(entry, fallbackPhase) {
    if (typeof entry === 'string') return normalizePhase(entry);
    const capability = String(entry?.capabilityStatus || '').trim().toUpperCase();
    const coverage = String(entry?.coverage || '').trim().toUpperCase();
    const lifecycleValue = entry?.phase || entry?.status || entry?.analysisPhase;
    const bootstrapValue = entry?.bootstrapPhase || entry?.bootstrapStatus;
    const lifecycle = lifecycleValue ? normalizePhase(lifecycleValue) : '';
    const bootstrap = bootstrapValue ? normalizePhase(bootstrapValue) : '';
    if (ACTIVE_PHASES.has(bootstrap)
        && !(bootstrap === 'QUEUED' && (capability === 'UNSUPPORTED' || coverage === 'UNSUPPORTED'))) {
        return bootstrap;
    }
    if (ACTIVE_PHASES.has(lifecycle)) return lifecycle;
    if (bootstrap === 'ERROR' || lifecycle === 'ERROR') return 'ERROR';
    if (capability === 'UNSUPPORTED' || coverage === 'UNSUPPORTED') return 'UNSUPPORTED';
    if (capability === 'PARTIAL' || coverage === 'PARTIAL') return 'PARTIAL';
    return lifecycle || bootstrap || normalizePhase(fallbackPhase);
}

function progressValue(entry, phase) {
    if (!entry || typeof entry !== 'object') return phase === 'READY' ? 100 : null;
    const explicit = numberOrNull(entry.progress ?? entry.phaseProgress ?? entry.analysisProgress
        ?? entry.bootstrapProgress);
    if (explicit !== null) {
        if (phase === 'UNSUPPORTED') return null;
        return phase === 'PARTIAL' && explicit >= 100 ? null : Math.max(0, Math.min(100, explicit));
    }
    return phase === 'READY' ? 100 : null;
}

function scopeStatus(entry, fallbackPhase) {
    if (entry === null || entry === undefined) {
        return {
            phase: 'UNKNOWN', progress: null, active: false, ready: false, error: false,
            processed: null, available: null, coverage: null, source: '', errorCode: null
        };
    }
    const phase = phaseValue(entry, fallbackPhase);
    return {
        phase,
        progress: progressValue(entry, phase),
        active: ACTIVE_PHASES.has(phase),
        ready: ['READY', 'PARTIAL', 'UNSUPPORTED'].includes(phase),
        error: phase === 'ERROR',
        processed: numberOrNull(entry?.processed ?? entry?.battlesProcessed ?? entry?.historyBattlesProcessed),
        available: numberOrNull(entry?.available ?? entry?.total ?? entry?.battlesAvailable ?? entry?.historyBattlesAvailable),
        coverage: entry?.coverage || entry?.coverageStatus || null,
        source: entry?.source || entry?.sourceLabel || entry?.providerLabel || entry?.provider || '',
        errorCode: entry?.errorCode || entry?.analysisErrorCode || entry?.bootstrapErrorCode || null
    };
}

function scopePayload(tracking) {
    const analysis = tracking?.analysis || tracking?.historyAnalysis || tracking?.bootstrap || {};
    return tracking?.analysisScopes || tracking?.scopeStates || tracking?.scopes
        || analysis.scopes || analysis.scopeStates || null;
}

function aggregationPayload(tracking) {
    const analysis = tracking?.analysis || tracking?.historyAnalysis || tracking?.bootstrap || {};
    const explicit = tracking?.analysisAggregation || tracking?.aggregation
        || analysis.aggregation || analysis.aggregate;
    if (explicit) return explicit;
    const overall = normalizePhase(tracking?.analysisPhase || analysis.phase);
    const terminal = ['READY', 'PARTIAL', 'UNSUPPORTED', 'ERROR'].includes(overall);
    const aggregatePhase = overall === 'AGGREGATING' || terminal ? overall : 'QUEUED';
    return {
        phase: aggregatePhase,
        progress: terminal ? tracking?.analysisProgress ?? analysis.progress : null,
        processed: terminal ? tracking?.battlesProcessed ?? analysis.battlesProcessed : null,
        available: terminal ? tracking?.battlesAvailable ?? analysis.battlesAvailable : null
    };
}

export function emptyAnalysisScopes() {
    return { available: false, normal: null, war: null, ranked: null, aggregate: null };
}

export function normalizeAnalysisScopes(tracking, fallbackPhase = 'QUEUED') {
    const payload = scopePayload(tracking);
    const hasScopes = Array.isArray(payload)
        ? payload.some(entry => Boolean(entry?.scope))
        : Boolean(payload && typeof payload === 'object'
            && Object.values(SCOPE_ALIASES).flat().some(key => Object.prototype.hasOwnProperty.call(payload, key)));
    if (!hasScopes) return emptyAnalysisScopes();
    const scopes = Object.fromEntries(Object.keys(SCOPE_ALIASES).map(kind => [
        kind, scopeStatus(scopeValue(payload, kind), fallbackPhase)
    ]));
    const aggregate = aggregationPayload(tracking);
    return {
        available: true,
        ...scopes,
        aggregate: scopeStatus(aggregate, tracking?.analysisPhase || tracking?.bootstrapStatus || fallbackPhase)
    };
}
