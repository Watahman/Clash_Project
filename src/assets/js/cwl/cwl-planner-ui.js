import { initPlannerSchedule } from './cwl-planner-schedule.js';
import { initPlayerInspector } from './cwl-player-inspector.js';
import { getPlayerAvailability } from './cwl-availability.js';
import { getCardTag } from './cwl-utils.js';

export function initPlannerSurface({ root = document } = {}) {
    if (!root) return { refresh: () => {} };
    const inspector = initPlayerInspector({ root });
    const schedule = initPlannerSchedule({
        root,
        onPlayerSelect: inspector.open,
        onRender: state => updatePlannerSummary(root, state)
    });
    initMobilePool(root);
    initDropFeedback(root);
    initToolKeyboard(root);
    initPlannerFixtureBoundary(root);
    return {
        refresh: schedule.refresh,
        openPlayer: inspector.open,
        closePlayer: inspector.close
    };
}

function updatePlannerSummary(root, state) {
    const clanCount = root.querySelector('#cwl-summary-clans');
    const playerCount = root.querySelector('#cwl-summary-players');
    const issueCount = root.querySelector('#cwl-summary-issues');
    if (clanCount) clanCount.textContent = String(state.clans.length);
    if (playerCount) playerCount.textContent = String(state.players.length);
    if (issueCount) {
        const unavailable = state.players.filter(card => (
            getPlayerAvailability(getCardTag(card)).state === 'no'
        )).length;
        issueCount.textContent = String(unavailable);
        issueCount.closest('.cwl-summary-item')?.toggleAttribute('hidden', unavailable === 0);
    }
}

function initMobilePool(root) {
    const panel = root.querySelector('.cwl-roster-panel');
    const openButton = root.querySelector('#cwl-mobile-open-pool');
    const closeButton = root.querySelector('#cwl-mobile-close-pool');
    if (!panel || !openButton) return;
    const setOpen = open => {
        panel.classList.toggle('is-open', open);
        panel.setAttribute('aria-hidden', String(!open));
        if (open) closeButton?.focus({ preventScroll: true });
    };
    if (window.innerWidth <= 900) setOpen(false);
    openButton.addEventListener('click', () => setOpen(true));
    closeButton?.addEventListener('click', () => setOpen(false));
    panel.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        setOpen(false);
        openButton.focus({ preventScroll: true });
    });
    window.addEventListener('resize', () => {
        if (window.innerWidth > 900) panel.removeAttribute('aria-hidden');
        else if (!panel.classList.contains('is-open')) panel.setAttribute('aria-hidden', 'true');
    });
}

function initDropFeedback(root) {
    const live = root.querySelector('#cwl-drop-feedback');
    if (!live) return;
    window.addEventListener('clashtools:cwl-drop-feedback', event => {
        live.textContent = event.detail?.message || '';
    });
}

function initToolKeyboard(root) {
    document.addEventListener('keydown', event => {
        const panel = root.querySelector(
            '.cwl-auto-plan-panel:not(.hidden), .cwl-optimize-plan-panel:not(.hidden)'
        );
        if (!panel) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            panel.querySelector('[data-i18n="autoPlan.cancel"], #cwl-auto-plan-cancel, #cwl-optimize-plan-cancel')?.click();
            return;
        }
        if (event.key === 'Tab') trapFocus(event, panel);
    });
}

function initPlannerFixtureBoundary(root) {
    const applyFixture = fixture => {
        if (fixture?.module !== 'planner') return;
        root.querySelector('.workspace-planner')?.setAttribute('data-fixture-scenario', fixture.id);
        root.documentElement?.setAttribute('data-planner-fixture', fixture.id);
    };
    const existing = document.documentElement.dataset.redesignFixture;
    if (existing?.startsWith('planner-')) applyFixture({ id: existing, module: 'planner' });
    window.addEventListener('clashpanel:fixture-ready', event => applyFixture(event.detail));
}

function trapFocus(event, container) {
    const focusable = Array.from(container.querySelectorAll(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    ));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}
