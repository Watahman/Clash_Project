import { syncAuthSession } from '../auth/auth-client.js';
import { initPlayerPerformancePopover } from '../cwl/cwl-player-performance-popover.js';
import { initI18n } from '../i18n/i18n.js';
import { looksLikeClashTag, normalizeTag } from '../operation-board/operation-board-utils.js';
import {
    competeT,
    findCompeteKey,
    initCompeteI18n
} from '../operation-board/compete-locales.js';
import { profileHTML } from '../profile/profile_popup.js';
import {
    deleteWarAssignment,
    setWarAssignment
} from '../Supabase/Supabase-WarAssignments.js';
import { loadLinkedWarClans } from '../war-operation-board/war-clan-source.js';
import { createWarLoadController } from '../war-operation-board/war-page-loader.js';
import { bindWarPageEvents } from '../war-operation-board/war-page-events.js';
import { renderWarHistory } from '../war-operation-board/war-history-renderer.js';
import { loadWarFixture } from '../operation-board/operation-board-fixtures.js';
import { currentWarPlayerContext } from '../war-operation-board/war-report-model.js';
import {
    renderBaseDetail,
    renderRoster,
    renderScoreStrip,
    renderStats,
    renderWarMap
} from '../war-operation-board/war-renderer.js';

const refs = {};
let selectedTag = '';
let mapSide = 'enemy';
let selectedPosition = 1;
let activeFixture = null;
let warLoader;
let lastStatusCopy = null;

async function init() {
    collectRefs();
    activeFixture = await loadWarFixture().catch(error => {
        console.error(error);
        return null;
    });
    initI18n();
    if (!activeFixture) await Promise.resolve(syncAuthSession()).catch(() => null);
    profileHTML();
    warLoader = createWarLoadController({
        refs,
        getSelectedTag: () => selectedTag,
        getFixture: () => activeFixture,
        setStatus,
        renderCurrent,
        selectHistoryTab: () => selectTab('history')
    });
    initCompeteI18n(document, refreshLabels);
    bindWarPageEvents({
        refs,
        selectClan,
        submitClan,
        loadWar,
        selectTab,
        onMapSide: side => {
            mapSide = side;
            selectedPosition = 1;
        },
        renderCurrent,
        getReport: () => warLoader?.getState().report,
        handleBoardClick,
        handleAssignmentSubmit,
        renderRoster
    });
    initPlayerPerformancePopover({
        getCurrentContext: tag => currentWarPlayerContext(
            warLoader.getState().report,
            tag
        )
    });
    await loadClanOptions();
    const queryTag = normalizeTag(new URLSearchParams(location.search).get('clan') || '');
    const fixtureTag = normalizeTag(activeFixture?.data?.clan?.tag || '');
    const initialTag = queryTag || fixtureTag;
    if (initialTag) {
        refs.tagInput.value = initialTag;
        await selectClan(initialTag);
    }
}

function collectRefs() {
    Object.assign(refs, {
        clanSelect: document.querySelector('#war-clan-select'),
        tagForm: document.querySelector('#war-tag-form'),
        tagInput: document.querySelector('#war-tag-input'),
        refresh: document.querySelector('#war-refresh'),
        empty: document.querySelector('#war-empty-state'),
        content: document.querySelector('#war-board-content'),
        score: document.querySelector('#war-score-strip'),
        status: document.querySelector('#war-status-line'),
        liveMap: document.querySelector('#war-live-map'),
        fullMap: document.querySelector('#war-full-map'),
        detail: document.querySelector('#war-base-detail'),
        stats: document.querySelector('#war-stats-grid'),
        roster: document.querySelector('#war-roster'),
        rosterFilter: document.querySelector('#war-roster-filter'),
        historySummary: document.querySelector('#war-history-summary'),
        historyList: document.querySelector('#war-history-list')
    });
}

async function loadClanOptions() {
    try {
        const fixtureClan = activeFixture?.data?.clan;
        const clans = fixtureClan ? [fixtureClan] : await loadLinkedWarClans();
        clans.forEach(clan => {
            const option = document.createElement('option');
            option.value = clan.tag;
            option.textContent = `${clan.name || clan.tag} · ${clan.tag}`;
            refs.clanSelect.appendChild(option);
        });
    } catch {
        refs.clanSelect.options[0].textContent = competeT('war.enterClanTag');
    }
}

function submitClan(value) {
    const tag = normalizeTag(value);
    if (!looksLikeClashTag(tag)) {
        setStatus(competeT('war.invalidTag'), true);
        return;
    }
    void selectClan(tag);
}

async function selectClan(tag) {
    selectedTag = normalizeTag(tag);
    refs.tagInput.value = selectedTag;
    refs.clanSelect.value = Array.from(refs.clanSelect.options)
        .some(option => option.value === selectedTag) ? selectedTag : '';
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('clan', selectedTag);
    window.history.replaceState(null, '', nextUrl);
    await loadWar();
}

function loadWar(forceRefresh = false) {
    return warLoader?.load(forceRefresh);
}

function renderCurrent() {
    const { report, historyData, assignments } = warLoader?.getState() || {};
    if (!report) return;
    renderScoreStrip(refs.score, report);
    renderWarMap(refs.liveMap, report, mapSide, selectedPosition, assignments);
    renderWarMap(refs.fullMap, report, 'enemy', selectedPosition, assignments);
    renderBaseDetail(refs.detail, report, mapSide, selectedPosition, assignments);
    renderStats(refs.stats, report);
    renderRoster(refs.roster, report, refs.rosterFilter.value);
    renderWarHistory(refs.historySummary, refs.historyList, historyData);
}

function handleBoardClick(event) {
    const { report } = warLoader?.getState() || {};
    const base = event.target.closest('[data-base-position]');
    if (base && report) {
        selectedPosition = Number(base.dataset.basePosition);
        renderCurrent();
        return;
    }
    const remove = event.target.closest('[data-remove-assignment]');
    if (remove && report) {
        void removeAssignment(remove.dataset.removeAssignment);
    }
}

async function handleAssignmentSubmit(event) {
    const { report } = warLoader?.getState() || {};
    const form = event.target.closest('.war-assignment-form');
    if (!form || !report) return;
    event.preventDefault();
    const data = new FormData(form);
    try {
        const saved = await setWarAssignment(report.clan.tag, report.warKey, {
            playerTag: data.get('playerTag'),
            attackSlot: Number(data.get('attackSlot')),
            type: data.get('type'),
            targetPosition: ['base', 'cleanup'].includes(data.get('type'))
                ? Number(form.dataset.assignmentPosition)
                : null
        });
        warLoader.replaceAssignment(saved);
        renderCurrent();
        setStatus(competeT('war.assignmentSaved'));
    } catch {
        setStatus(competeT('war.assignmentSaveFailed'), true);
    }
}

async function removeAssignment(assignmentId) {
    try {
        await deleteWarAssignment(assignmentId);
        warLoader.removeAssignment(assignmentId);
        renderCurrent();
        setStatus(competeT('war.assignmentRemoved'));
    } catch {
        setStatus(competeT('war.assignmentRemoveFailed'), true);
    }
}

function selectTab(tab) {
    document.querySelectorAll('[data-war-tab]').forEach(button => {
        const selected = button.dataset.warTab === tab;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll('[data-war-panel]').forEach(panel => {
        panel.hidden = panel.dataset.warPanel !== tab;
    });
}

function setStatus(message, error = false, cwlLink = false) {
    const key = findCompeteKey(String(message || ''));
    lastStatusCopy = key ? { key, error, cwlLink } : null;
    renderStatus(message, error, cwlLink);
}

function renderStatus(message, error = false, cwlLink = false) {
    refs.status.classList.toggle('is-error', error);
    refs.status.replaceChildren(document.createTextNode(String(message || '')));
    if (cwlLink) {
        const link = document.createElement('a');
        link.href = '/app/cwl-tracker';
        link.textContent = competeT('war.openCwlTracker');
        refs.status.append(' ', link);
    }
}

function refreshLabels() {
    warLoader?.refreshLabels();
    if (lastStatusCopy) {
        renderStatus(
            competeT(lastStatusCopy.key),
            lastStatusCopy.error,
            lastStatusCopy.cwlLink
        );
    }
    renderCurrent();
}

const initialPageLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialPageLoad);
