import {
    findPlannerCard,
    getPlannerPlayers,
    keepClanSelection,
    PLANNER_DAYS
} from './cwl-planner-schedule-model.js';
import {
    renderClanSchedule,
    renderMobileSequence
} from './cwl-planner-schedule-view.js';

const SCHEDULE_EVENTS = [
    'clashtools:cwl-player-added',
    'clashtools:cwl-player-removed',
    'clashtools:cwl-plan-loaded',
    'clashtools:cwl-plan-meta-loaded',
    'clashtools:cwl-planner-schedule-changed',
    'clashtools:language-changed'
];

export function createPlannerScheduleController({ root = document, onPlayerSelect, onRender } = {}) {
    const elements = getScheduleElements(root);
    if (!elements.clansRoot) return createNoopController();
    const document = getOwnerDocument(root);
    const view = document.defaultView || globalThis;
    const state = createScheduleState();
    const refresh = () => renderSchedule({ elements, state, onRender, root });
    const queueRender = createRenderQueue(state, refresh);
    wireScheduleEvents({ root, view, elements, state, queueRender, onPlayerSelect });
    observeScheduleChanges(elements.clansRoot, queueRender, view);
    refresh();
    return createScheduleApi(state, refresh, queueRender);
}

function getScheduleElements(root) {
    return {
        clansRoot: root.querySelector('#cwl-all-clans'),
        mobile: root.querySelector('#cwl-mobile-planner-sequence'),
        mobileList: root.querySelector('#cwl-mobile-day-list'),
        mobileClanSelect: root.querySelector('#cwl-mobile-clan-select'),
        mobileDaySelect: root.querySelector('#cwl-mobile-day-select')
    };
}

function getOwnerDocument(root) {
    return root?.nodeType === 9 ? root : root?.ownerDocument || document;
}

function createScheduleState() {
    return { selectedClanId: '', selectedDay: 1, renderQueued: false, rendering: false };
}

function createNoopController() {
    return { refresh: () => {}, selectClan: () => {}, selectDay: () => {} };
}

function renderSchedule({ root, elements, state, onRender }) {
    if (state.rendering) return;
    state.rendering = true;
    try {
        const clans = getClans(elements.clansRoot);
        state.selectedClanId = keepClanSelection(state.selectedClanId, clans);
        clans.forEach(clan => renderClanSchedule(clan));
        renderMobileSequence(elements.mobile, clans, state.selectedClanId, state.selectedDay);
        onRender?.({
            clans,
            players: getPlannerPlayers(root),
            selectedClanId: state.selectedClanId,
            selectedDay: state.selectedDay
        });
    } finally {
        state.rendering = false;
    }
}

function getClans(clansRoot) {
    return Array.from(clansRoot.querySelectorAll(':scope > .cwl-clan-article'));
}

function createRenderQueue(state, refresh) {
    return () => {
        if (state.renderQueued) return;
        state.renderQueued = true;
        queueMicrotask(() => {
            state.renderQueued = false;
            refresh();
        });
    };
}

function wireScheduleEvents({ root, view, elements, state, queueRender, onPlayerSelect }) {
    elements.clansRoot.addEventListener('click', event => handlePlayerClick(event, root, onPlayerSelect));
    elements.mobileList?.addEventListener('click', event => handleMobilePlayerClick(event, root, onPlayerSelect));
    elements.mobileClanSelect?.addEventListener('change', event => {
        state.selectedClanId = event.target.value;
        queueRender();
    });
    elements.mobileDaySelect?.addEventListener('change', event => {
        state.selectedDay = normalizeDay(event.target.value);
        queueRender();
    });
    SCHEDULE_EVENTS.forEach(eventName => view.addEventListener(eventName, queueRender));
}

function handlePlayerClick(event, root, onPlayerSelect) {
    const chip = event.target.closest?.('.cwl-day-player');
    const card = chip && findPlannerCard(root, chip.dataset.playerTag);
    if (card) onPlayerSelect?.(card);
}

function handleMobilePlayerClick(event, root, onPlayerSelect) {
    const row = event.target.closest?.('[data-mobile-player-tag]');
    const card = row && findPlannerCard(root, row.dataset.mobilePlayerTag);
    if (card) onPlayerSelect?.(card);
}

function normalizeDay(day) {
    const value = Number(day);
    return PLANNER_DAYS.includes(value) ? value : 1;
}

function observeScheduleChanges(clansRoot, queueRender, view) {
    const observer = new view.MutationObserver(records => {
        if (!records.length || records.some(record => !isCanvasMutation(record))) queueRender();
    });
    observer.observe(clansRoot, { childList: true, subtree: true });
}

function isCanvasMutation(record) {
    return Boolean(record.target.closest?.('.cwl-seven-day-canvas'));
}

function createScheduleApi(state, refresh, queueRender) {
    return {
        refresh,
        selectClan: id => {
            state.selectedClanId = id || '';
            queueRender();
        },
        selectDay: day => {
            state.selectedDay = normalizeDay(day);
            queueRender();
        }
    };
}
