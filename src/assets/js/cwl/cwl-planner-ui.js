import { initPlayerInspector } from './cwl-player-inspector.js?v=20260829-public-auth-v1';

export function initPlannerSurface({ root = document } = {}) {
    if (!root) return { openPlayer: () => {}, closePlayer: () => {} };
    const inspector = initPlayerInspector({ root });
    initMobileView(root);
    initToolKeyboard(root);
    initToolsMenu(root);
    initPlannerFixtureBoundary(root);
    return { openPlayer: inspector.open, closePlayer: inspector.close };
}

function initMobileView(root) {
    const planner = root.querySelector('.cwl-planner-layout');
    const tabs = root.querySelectorAll('[data-planner-mobile-view]');
    if (!planner || !tabs.length) return;
    const setView = view => {
        planner.dataset.mobileView = view;
        tabs.forEach(tab => {
            const active = tab.dataset.plannerMobileView === view;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', String(active));
        });
    };
    tabs.forEach(tab => tab.addEventListener('click', () => (
        setView(tab.dataset.plannerMobileView)
    )));
    setView('players');
}

function initToolKeyboard(root) {
    document.addEventListener('keydown', event => {
        const panel = root.querySelector(
            '.cwl-auto-plan-panel:not(.hidden), .cwl-optimize-plan-panel:not(.hidden)'
        );
        if (!panel) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            panel.querySelector('#cwl-auto-plan-cancel, #cwl-optimize-plan-cancel')?.click();
            return;
        }
        if (event.key === 'Tab') trapFocus(event, panel);
    });
}

function initToolsMenu(root) {
    const menu = root.querySelector('[data-cwl-tools-menu]');
    if (!menu) return;

    const close = restoreFocus => {
        if (!menu.open) return;
        menu.removeAttribute('open');
        if (restoreFocus) menu.querySelector('summary')?.focus();
    };

    document.addEventListener('click', event => {
        if (!menu.contains(event.target)) close(false);
    });
    menu.addEventListener('click', event => {
        if (event.target?.closest?.('.cwl-tools-menu-content button')) close(false);
    });
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        close(true);
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
