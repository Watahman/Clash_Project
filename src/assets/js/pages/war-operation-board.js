import { syncAuthSession } from '../auth/auth-client.js';
import { initPlayerPerformancePopover } from '../cwl/cwl-player-performance-popover.js';
import { initI18n } from '../i18n/i18n.js';
import { looksLikeClashTag, normalizeTag } from '../operation-board/operation-board-utils.js';
import {
    competeT,
    findCompeteKey,
    initCompeteI18n
} from '../operation-board/compete-locales.js';
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
let mapSide = 'own';
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
    const { report, historyData } = warLoader?.getState() || {};
    if (!report) return;
    renderWarMap(refs.liveMap, report, mapSide, selectedPosition);
    renderBaseDetail(refs.detail, report, mapSide, selectedPosition);
    renderScoreStrip(refs.score, report);
    renderStats(refs.stats, report);
    renderRoster(refs.roster, report, refs.rosterFilter.value);
    renderWarHistory(refs.historySummary, refs.historyList, historyData);
}

function handleBoardClick(event) {
    const { report } = warLoader?.getState() || {};
    const base = event.target.closest('[data-base-position]');
    if (!base || !report) return;
    selectedPosition = Number(base.dataset.basePosition);
    renderCurrent();
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
