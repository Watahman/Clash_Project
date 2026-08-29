import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { formatNumber } from './advanced-stats-formatters.js?v=20260829-public-auth-v1';
import {
    normalizeCoverage,
    normalizeCoverageDetails
} from './advanced-stats-analysis.js?v=20260814-advanced-stats-v4';

const PHASE_ORDER = ['QUEUED', 'FETCHING', 'PROCESSING', 'READY'];
const PHASE_COPY = Object.freeze({
    QUEUED: ['advancedStats.analysisQueuedTitle', 'advancedStats.analysisQueuedText'],
    FETCHING: ['advancedStats.analysisFetchingTitle', 'advancedStats.analysisFetchingText'],
    PROCESSING: ['advancedStats.analysisProcessingTitle', 'advancedStats.analysisProcessingText'],
    READY: ['advancedStats.analysisReadyTitle', 'advancedStats.analysisReadyText'],
    ERROR: ['advancedStats.analysisErrorTitle', 'advancedStats.analysisErrorText']
});
const COVERAGE_COPY = Object.freeze({
    available: 'advancedStats.coverageAvailable',
    unavailable: 'advancedStats.coverageUnavailable',
    partial: 'advancedStats.coveragePartial',
    unknown: 'advancedStats.coverageUnknown'
});

function setVisibility(element, visible) {
    if (element) element.hidden = !visible;
}

function setText(element, value) {
    if (element) element.textContent = value;
}

function coverageLabel(value) {
    return t(COVERAGE_COPY[value] || COVERAGE_COPY.unknown);
}

function coverageElements(elements, prefix) {
    return ['normal', 'war', 'ranked'].map(kind => ({
        kind,
        value: elements[`${prefix}Coverage${kind[0].toUpperCase()}${kind.slice(1)}`],
        meta: elements[`${prefix}Coverage${kind[0].toUpperCase()}${kind.slice(1)}Meta`]
    }));
}

function coverageMeta(detail) {
    const source = detail.source ? t('advancedStats.coverageSource', { source: detail.source }) : '';
    if (source && detail.reason) return `${source} · ${detail.reason}`;
    return source || detail.reason;
}

export function renderCoverageStatus(elements, coverage, prefix, details = coverage) {
    const normalizedCoverage = normalizeCoverage(coverage);
    const normalizedDetails = normalizeCoverageDetails(details);
    coverageElements(elements, prefix).forEach(({ kind, value, meta }) => {
        if (!value) return;
        const state = normalizedCoverage[kind];
        const detail = normalizedDetails[kind];
        const metadata = coverageMeta(detail);
        value.textContent = coverageLabel(state);
        value.dataset.state = state;
        value.setAttribute('aria-label', `${t(`advancedStats.coverage${kind[0].toUpperCase()}${kind.slice(1)}`)}: ${coverageLabel(state)}`);
        setText(meta, metadata);
        setVisibility(meta, Boolean(metadata));
    });
}

function phaseCopy(phase) {
    if (phase === 'AGGREGATING') return PHASE_COPY.PROCESSING;
    if (phase === 'UNKNOWN') return PHASE_COPY.ERROR;
    return PHASE_COPY[phase] || (['PARTIAL', 'UNSUPPORTED'].includes(phase)
        ? PHASE_COPY.READY : PHASE_COPY.PROCESSING);
}

function renderPhaseSteps(root, phase) {
    const displayPhase = phase === 'AGGREGATING' ? 'PROCESSING' : phase;
    const currentIndex = PHASE_ORDER.indexOf(displayPhase);
    const terminal = ['READY', 'PARTIAL', 'UNSUPPORTED'].includes(phase);
    root?.querySelectorAll('[data-analysis-step]').forEach(step => {
        const stepIndex = PHASE_ORDER.indexOf(step.dataset.analysisStep);
        const complete = terminal || (currentIndex >= 0 && stepIndex >= 0 && stepIndex < currentIndex);
        const current = !terminal && step.dataset.analysisStep === displayPhase;
        step.classList.toggle('is-complete', complete);
        step.classList.toggle('is-current', current);
        step.setAttribute('aria-current', current ? 'step' : 'false');
    });
}

function scopePhaseCopy(phase) {
    if (phase === 'ERROR') return PHASE_COPY.ERROR;
    if (phase === 'UNKNOWN') return ['advancedStats.coverageUnknown', 'advancedStats.coverageText'];
    if (phase === 'PARTIAL') return ['advancedStats.coveragePartial', 'advancedStats.analysisReadyText'];
    if (phase === 'UNSUPPORTED') return ['advancedStats.coverageUnavailable', 'advancedStats.coverageText'];
    if (phase === 'READY') return PHASE_COPY.READY;
    return PHASE_COPY[phase] || PHASE_COPY.PROCESSING;
}

function renderScopeProgress(progress, value) {
    if (!progress) return;
    progress.max = 100;
    if (value === null || value === undefined) {
        progress.removeAttribute('value');
        progress.removeAttribute('aria-valuenow');
        progress.setAttribute('aria-valuetext', t('advancedStats.analysisProgressUnknown'));
        return;
    }
    progress.value = value;
    progress.setAttribute('aria-valuenow', String(value));
    progress.setAttribute('aria-valuetext', t('advancedStats.analysisProgress', { progress: Math.round(value) }));
}

function scopeCountText(scope) {
    const counts = [];
    if (scope?.processed !== null && scope?.processed !== undefined) {
        counts.push(`${formatNumber(scope.processed)} ${t('advancedStats.analysisProcessed')}`);
    }
    if (scope?.available !== null && scope?.available !== undefined) {
        counts.push(`${formatNumber(scope.available)} ${t('advancedStats.analysisAvailable')}`);
    }
    return counts.join(' · ');
}

function renderScopeSteps(root, analysis) {
    const scopeRoot = root?.querySelector('[data-analysis-scopes]');
    const genericRoot = root?.querySelector('.advanced-stats__analysis-steps');
    const scopes = analysis.scopes;
    setVisibility(scopeRoot, Boolean(scopes?.available));
    setVisibility(genericRoot, !scopes?.available);
    if (!scopes?.available) return;
    scopeRoot.querySelectorAll('[data-analysis-scope]').forEach(item => {
        const key = item.dataset.analysisScope;
        const scope = scopes[key] || { phase: 'QUEUED', progress: null };
        const [titleKey] = scopePhaseCopy(scope.phase);
        const status = item.querySelector('[data-scope-status]');
        const progress = item.querySelector('[data-scope-progress]');
        const count = item.querySelector('[data-scope-count]');
        const terminal = scope.ready;
        item.dataset.phase = scope.phase;
        item.dataset.state = scope.error ? 'error' : terminal ? 'ready' : scope.phase === 'UNKNOWN' ? 'unknown' : 'loading';
        item.classList.toggle('is-complete', terminal);
        item.classList.toggle('is-current', Boolean(scope.active));
        item.setAttribute('aria-current', scope.active ? 'step' : 'false');
        setText(status, t(titleKey));
        setVisibility(progress, scope.phase !== 'UNKNOWN' && !(scope.ready && scope.progress === null));
        renderScopeProgress(progress, scope.progress);
        setText(count, scopeCountText(scope));
        setVisibility(count, Boolean(count?.textContent));
    });
}

function renderProgress(elements, analysis) {
    const progress = elements.analysisProgress;
    if (!progress) return;
    setVisibility(progress, !(analysis.ready && analysis.progress === null));
    if (analysis.ready && analysis.progress === null) return;
    progress.max = 100;
    if (analysis.progress === null) {
        progress.removeAttribute('value');
        progress.removeAttribute('aria-valuenow');
        progress.setAttribute('aria-valuetext', t('advancedStats.analysisProgressUnknown'));
        return;
    }
    progress.value = analysis.progress;
    progress.setAttribute('aria-valuenow', String(analysis.progress));
    progress.setAttribute('aria-valuetext', t('advancedStats.analysisProgress', { progress: Math.round(analysis.progress) }));
}

function renderCounts(elements, analysis) {
    const processed = analysis.battlesProcessed;
    const available = analysis.battlesAvailable;
    setText(elements.analysisProcessed, processed === null ? t('advancedStats.pending') : formatNumber(processed));
    setText(elements.analysisAvailable, available === null ? t('advancedStats.pending') : formatNumber(available));
}

function analysisCoverageDetails(analysis) {
    return analysis.coverageDetails || analysis.coverage;
}

export function renderHistoryAnalysis(elements, state) {
    const root = elements.analysisLoading;
    if (!root) return;
    const analysis = state.analysis || {};
    const visible = Boolean(state.analysisRequested || analysis.active || analysis.error);
    setVisibility(root, visible);
    if (!visible) return;

    const phase = analysis.phase || 'QUEUED';
    const [titleKey, textKey] = phaseCopy(phase);
    root.dataset.phase = phase;
    root.dataset.state = analysis.error ? 'error' : analysis.ready ? 'ready' : 'loading';
    root.setAttribute('aria-busy', String(!analysis.ready && !analysis.error));
    setText(elements.analysisTitle, t(titleKey));
    setText(elements.analysisText, t(textKey));
    const terminal = analysis.ready && !analysis.error;
    setText(elements.analysisStatus, analysis.error
        ? t('advancedStats.analysisErrorText')
        : terminal ? t('advancedStats.analysisReadyText') : t('advancedStats.analysisLiveStatus'));
    renderProgress(elements, analysis);
    renderPhaseSteps(root, phase);
    renderScopeSteps(root, analysis);
    renderCounts(elements, analysis);
    renderCoverageStatus(elements, analysis.coverage, 'analysis', analysisCoverageDetails(analysis));
    setVisibility(elements.analysisError, analysis.error);
    setVisibility(elements.analysisRetry, analysis.error && analysis.retryable !== false);
}

export function renderDashboardCoverage(elements, state) {
    const tracking = state.tracking || {};
    const overview = state.overview?.data || state.overview || {};
    const coverage = tracking.coverage
        || tracking.analysisCoverage
        || tracking.dataCoverage
        || overview.coverage
        || state.analysis?.coverage;
    const details = tracking.coverageDetails
        || tracking.analysisCoverageDetails
        || tracking.dataCoverageDetails
        || overview.coverageDetails
        || state.analysis?.coverageDetails
        || coverage;
    renderCoverageStatus(elements, coverage, 'dashboard', details);
}
