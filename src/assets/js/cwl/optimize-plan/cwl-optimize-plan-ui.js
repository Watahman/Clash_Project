import { t } from '../../i18n/i18n.js?v=20260829-public-auth-v1';
import {
    applyAutoPlanResult,
    collectAutoPlanInput
} from '../auto-plan/cwl-auto-plan-source.js?v=20260829-public-auth-v1';
import {
    buildAcceptedOptimization,
    buildOptimizePlan
} from './cwl-optimize-planner.js';
import { renderOptimizePlanPreview } from './cwl-optimize-plan-renderer.js?v=20260829-public-auth-v1';

let refs;
let currentResult;
let acceptedIds = new Set();
let ignoredIds = new Set();
let generationId = 0;

export function initOptimizePlan() {
    refs = {
        open: document.querySelector('#cwl-optimize-plan-button'),
        panel: document.querySelector('#cwl-optimize-plan-panel'),
        status: document.querySelector('#cwl-optimize-plan-status'),
        preview: document.querySelector('#cwl-optimize-plan-preview'),
        applyAccepted: document.querySelector('#cwl-optimize-plan-apply-accepted'),
        applyAll: document.querySelector('#cwl-optimize-plan-apply-all'),
        cancel: document.querySelector('#cwl-optimize-plan-cancel')
    };
    if (!refs.open || !refs.panel) return;
    refs.open.addEventListener('click', generatePreview);
    refs.cancel.addEventListener('click', closePreview);
    refs.applyAccepted.addEventListener('click', () => applySuggestions([...acceptedIds]));
    refs.applyAll.addEventListener('click', () =>
        applySuggestions(currentResult?.suggestions.map(item => item.id) || [])
    );
    refs.preview.addEventListener('click', handleSuggestionAction);
    window.addEventListener('clashtools:cwl-plan-loaded', closePreview);
    window.addEventListener('clashtools:language-changed', renderCurrent);
    window.addEventListener('clashtools:cwl-planner-tool-open', event => {
        if (event.detail?.tool !== 'optimize') closePreview();
    });
}

async function generatePreview() {
    const id = ++generationId;
    acceptedIds = new Set();
    ignoredIds = new Set();
    window.dispatchEvent(new CustomEvent('clashtools:cwl-planner-tool-open', {
        detail: { tool: 'optimize' }
    }));
    refs.panel.classList.remove('hidden');
    refs.panel.focus({ preventScroll: true });
    refs.panel.scrollIntoView({
        behavior: reducedMotion() ? 'auto' : 'smooth',
        block: 'start'
    });
    setBusy(true, t('optimizePlan.loading'));
    try {
        const input = await collectAutoPlanInput();
        if (id !== generationId) return;
        if (!input.clans.length) throw new Error(t('optimizePlan.needsClan'));
        if (!input.players.length) throw new Error(t('optimizePlan.needsPlayers'));
        currentResult = buildOptimizePlan(input);
        renderCurrent();
    } catch (error) {
        if (id !== generationId) return;
        currentResult = null;
        refs.preview.replaceChildren();
        setStatus(error?.message || t('optimizePlan.error'), 'error');
    } finally {
        if (id === generationId) setBusy(false);
    }
}

function renderCurrent() {
    if (!currentResult || !refs?.preview) return;
    renderOptimizePlanPreview({
        container: refs.preview,
        result: currentResult,
        acceptedIds,
        ignoredIds
    });
    setStatus(
        currentResult.suggestions.length
            ? t(
                currentResult.suggestions.length === 1
                    ? 'optimizePlan.readyOne'
                    : 'optimizePlan.ready',
                { count: currentResult.suggestions.length }
            )
            : t('optimizePlan.noChanges'),
        currentResult.suggestions.length ? 'ready' : 'neutral'
    );
    syncActions();
}

function handleSuggestionAction(event) {
    const button = event.target.closest('[data-optimize-action]');
    if (!button || !currentResult) return;
    const id = button.dataset.suggestionId;
    if (button.dataset.optimizeAction === 'accept') {
        acceptedIds.add(id);
        ignoredIds.delete(id);
    } else {
        ignoredIds.add(id);
        acceptedIds.delete(id);
    }
    renderCurrent();
}

async function applySuggestions(ids) {
    if (!currentResult || !ids.length) return;
    setBusy(true, t('optimizePlan.applying'));
    try {
        const accepted = buildAcceptedOptimization(currentResult, ids);
        await applyAutoPlanResult(accepted.plan);
        closePreview();
    } catch {
        setStatus(t('optimizePlan.applyError'), 'error');
    } finally {
        setBusy(false);
    }
}

function syncActions() {
    const hasSuggestions = Boolean(currentResult?.suggestions.length);
    refs.applyAccepted.disabled = !acceptedIds.size;
    refs.applyAll.disabled = !hasSuggestions;
}

function setBusy(busy, message = '') {
    refs.open.disabled = busy;
    refs.cancel.disabled = busy;
    refs.applyAccepted.disabled = busy || !acceptedIds.size;
    refs.applyAll.disabled = busy || !currentResult?.suggestions.length;
    refs.panel.setAttribute('aria-busy', String(busy));
    if (message) setStatus(message, busy ? 'loading' : 'ready');
}

function setStatus(message, state) {
    refs.status.textContent = message;
    refs.status.dataset.state = state;
}

function closePreview() {
    const restoreFocus = refs?.panel && (
        document.activeElement === refs.panel || refs.panel.contains(document.activeElement)
    );
    generationId += 1;
    currentResult = null;
    acceptedIds = new Set();
    ignoredIds = new Set();
    refs?.preview?.replaceChildren();
    refs?.panel?.classList.add('hidden');
    if (refs?.applyAccepted) refs.applyAccepted.disabled = true;
    if (refs?.applyAll) refs.applyAll.disabled = true;
    if (restoreFocus) refs.open?.focus({ preventScroll: true });
}

function reducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function getOptimizePlanPreview() {
    return currentResult;
}
