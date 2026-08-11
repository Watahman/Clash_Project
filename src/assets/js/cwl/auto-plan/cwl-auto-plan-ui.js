import { t } from '../../i18n/i18n.js';
import { buildAutoPlan } from './cwl-auto-planner.js';
import { renderAutoPlanPreview } from './cwl-auto-plan-renderer.js';
import {
    applyAutoPlanResult,
    collectAutoPlanInput
} from './cwl-auto-plan-source.js';

let refs;
let baseInput;
let currentResult;
let guidedOverrides = new Map();
let generationId = 0;

export function initAutoPlan() {
    refs = {
        open: document.querySelector('#cwl-auto-plan-button'),
        panel: document.querySelector('#cwl-auto-plan-panel'),
        mode: document.querySelector('#cwl-auto-plan-mode'),
        status: document.querySelector('#cwl-auto-plan-status'),
        preview: document.querySelector('#cwl-auto-plan-preview'),
        apply: document.querySelector('#cwl-auto-plan-apply'),
        cancel: document.querySelector('#cwl-auto-plan-cancel')
    };
    if (!refs.open || !refs.panel) return;
    refs.open.addEventListener('click', generatePreview);
    refs.cancel.addEventListener('click', closePreview);
    refs.apply.addEventListener('click', applyPreview);
    refs.mode.addEventListener('change', () => {
        guidedOverrides.clear();
        rebuildPreview();
    });
    refs.preview.addEventListener('click', handleGuidedAction);
    window.addEventListener('clashtools:cwl-plan-loaded', closePreview);
    window.addEventListener('clashtools:language-changed', () => {
        if (currentResult) renderPreview(currentResult);
    });
    window.addEventListener('clashtools:cwl-planner-tool-open', event => {
        if (event.detail?.tool !== 'auto') closePreview();
    });
}

async function generatePreview() {
    const id = ++generationId;
    guidedOverrides.clear();
    window.dispatchEvent(new CustomEvent('clashtools:cwl-planner-tool-open', {
        detail: { tool: 'auto' }
    }));
    setBusy(true, t('autoPlan.loading'));
    refs.panel.classList.remove('hidden');
    refs.panel.focus({ preventScroll: true });
    refs.panel.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    try {
        baseInput = await collectAutoPlanInput();
        if (id !== generationId) return;
        if (!baseInput.clans.length) throw new Error(t('autoPlan.needsClan'));
        if (!baseInput.players.length) throw new Error(t('autoPlan.needsPlayers'));
        rebuildPreview();
    } catch (error) {
        if (id !== generationId) return;
        currentResult = null;
        refs.preview.replaceChildren();
        setStatus(error?.message || t('autoPlan.error'), 'error');
    } finally {
        if (id === generationId) setBusy(false);
    }
}

function rebuildPreview() {
    if (!baseInput) return;
    const locks = mergeLocks(baseInput.locks, guidedOverrides);
    currentResult = buildAutoPlan({
        ...baseInput,
        mode: refs.mode.value,
        locks
    });
    renderPreview(currentResult);
}

function renderPreview(result) {
    refs.panel.dataset.mode = result.mode;
    setStatus(
        result.warnings.length
            ? t('autoPlan.previewWarnings', { count: result.warnings.length })
            : t('autoPlan.previewReady'),
        result.warnings.length ? 'warning' : 'ready'
    );
    renderAutoPlanPreview({
        container: refs.preview,
        result,
        guidedOverrides,
        registrationReasons: baseInput?.locks?.reasons
    });
    refs.apply.disabled = false;
}

function handleGuidedAction(event) {
    const button = event.target.closest('[data-auto-plan-action]');
    if (!button || !baseInput || refs.mode.value !== 'guided') return;
    const clanId = button.dataset.clanId;
    const container = button.closest('.cwl-auto-plan-guided');
    if (button.dataset.autoPlanAction === 'clear') {
        guidedOverrides.delete(clanId);
        rebuildPreview();
        return;
    }
    if (button.dataset.autoPlanAction === 'role') {
        const tag = container.querySelector('[data-auto-role-player]')?.value;
        const role = container.querySelector('[data-auto-role]')?.value;
        if (!tag || !role) return;
        guidedOverrides.set(clanId, {
            assignments: { [tag]: clanId },
            roles: { [tag]: role },
            reasons: { [tag]: 'guided-role-lock' }
        });
    } else if (button.dataset.autoPlanAction === 'swap') {
        const outgoing = container.querySelector('[data-auto-swap-out]')?.value;
        const incoming = container.querySelector('[data-auto-swap-in]')?.value;
        const outgoingPlayer = currentResult.clans
            .find(clan => clan.id === clanId)?.players
            .find(player => player.tag === outgoing);
        if (!outgoing || !incoming || !outgoingPlayer) return;
        guidedOverrides.set(clanId, {
            assignments: { [outgoing]: null, [incoming]: clanId },
            roles: { [incoming]: outgoingPlayer.role },
            reasons: {
                [outgoing]: 'guided-swap-lock',
                [incoming]: 'guided-swap-lock'
            }
        });
    }
    rebuildPreview();
}

async function applyPreview() {
    if (!currentResult) return;
    setBusy(true, t('autoPlan.applying'));
    try {
        await applyAutoPlanResult(currentResult);
        closePreview();
    } catch {
        setStatus(t('autoPlan.applyError'), 'error');
    } finally {
        setBusy(false);
    }
}

function closePreview() {
    const restoreFocus = refs?.panel && (
        document.activeElement === refs.panel || refs.panel.contains(document.activeElement)
    );
    generationId += 1;
    baseInput = null;
    currentResult = null;
    guidedOverrides.clear();
    refs?.preview?.replaceChildren();
    refs?.panel?.classList.add('hidden');
    if (refs?.apply) refs.apply.disabled = true;
    if (restoreFocus) refs.open?.focus({ preventScroll: true });
}

function mergeLocks(base, overrides) {
    const result = {
        assignments: { ...(base?.assignments || {}) },
        roles: { ...(base?.roles || {}) },
        reasons: { ...(base?.reasons || {}) }
    };
    overrides.forEach(override => {
        Object.assign(result.assignments, override.assignments);
        Object.assign(result.roles, override.roles);
        Object.assign(result.reasons, override.reasons);
    });
    return result;
}

function setBusy(busy, message = '') {
    refs.open.disabled = busy;
    refs.apply.disabled = busy || !currentResult;
    refs.cancel.disabled = busy;
    refs.panel.setAttribute('aria-busy', String(busy));
    if (message) setStatus(message, busy ? 'loading' : 'ready');
}

function setStatus(message, state) {
    refs.status.textContent = message;
    refs.status.dataset.state = state;
}

function reducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function getAutoPlanPreview() {
    return currentResult;
}
