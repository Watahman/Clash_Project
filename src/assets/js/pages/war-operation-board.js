import * as authClient from '../auth/auth-client.js?v=20260829-public-auth-v1';
import { initPlayerPerformancePopover } from '../cwl/cwl-player-performance-popover.js?v=20260829-public-auth-v1';
import { initI18n, t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { looksLikeClashTag, normalizeTag } from '../operation-board/operation-board-utils.js';
import {
    competeT,
    findCompeteKey,
    initCompeteI18n
} from '../operation-board/compete-locales.js?v=20260829-public-auth-v1';
import {
    createWarSourceGuard,
    loadLinkedWarClans
} from '../war-operation-board/war-clan-source.js?v=20260829-public-auth-v1';
import { createWarLoadController } from '../war-operation-board/war-page-loader.js?v=20260829-public-auth-v1';
import { bindWarPageEvents } from '../war-operation-board/war-page-events.js';
import { renderWarHistory } from '../war-operation-board/war-history-renderer.js?v=20260829-public-auth-v1';
import {
    createWarAuthLifecycle,
    createWarUnavailableState,
    resolveWarAuthState
} from '../war-operation-board/war-page-auth.js?v=20260829-public-auth-v1';
import {
    renderGuestWarClanOption,
    resetWarSourceState
} from '../war-operation-board/war-page-source-reset.js?v=20260829-public-auth-v1';
import { loadWarFixture } from '../operation-board/operation-board-fixtures.js';
import { currentWarPlayerContext } from '../war-operation-board/war-report-model.js?v=20260829-public-auth-v1';
import {
    renderBaseDetail,
    renderRoster,
    renderScoreStrip,
    renderStats,
    renderWarMap
} from '../war-operation-board/war-renderer.js?v=20260829-public-auth-v1';

const refs = {};
let selectedTag = '';
let mapSide = 'own';
let selectedPosition = 1;
let activeFixture = null;
let warLoader;
let lastStatusCopy = null;
let authState = null;
let linkedClans = [];
let authLifecycleReady = false;
const warSourceGuard = createWarSourceGuard();

const warAuth = createWarAuthLifecycle({
    authClient,
    sourceGuard: warSourceGuard,
    getAuthState: () => authState,
    setAuthState: state => { authState = state; },
    isReady: () => authLifecycleReady,
    onReset: () => {
        linkedClans = [];
        resetWarSourceState({
            refs,
            loader: warLoader,
            createLoader: createWarLoader,
            setLoader: loader => { warLoader = loader; },
            setSelectedTag: value => { selectedTag = value; },
            setMapSide: value => { mapSide = value; },
            setSelectedPosition: value => { selectedPosition = value; },
            competeT,
            setStatus
        });
    },
    onAuthenticated: nextState => loadClanOptions({
        allowLinked: true,
        authState: nextState
    }),
    onGuest: () => renderGuestWarClanOption({
        refs,
        competeT,
        loginLabel: t('auth.login')
    })
});

async function init() {
    collectRefs();
    activeFixture = await loadWarFixture().catch(error => {
        console.error(error);
        return null;
    });
    initI18n();
    authState = await resolveWarAuthState(authClient, {
        fixture: Boolean(activeFixture)
    }).catch(error => createWarUnavailableState(authClient, error));
    warAuth.initialize(authState);
    warLoader = createWarLoader();
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
    warAuth.bind();
    authLifecycleReady = true;
    await loadClanOptions({
        allowLinked: warAuth.isAuthenticated() || Boolean(activeFixture)
    });
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

async function loadClanOptions({
    allowLinked = false,
    authState: sourceState = authState
} = {}) {
    const sourceRequest = warSourceGuard.begin(sourceState);
    refs.clanSelect.replaceChildren();
    refs.clanSelect.disabled = true;
    const loadingOption = document.createElement('option');
    loadingOption.value = '';
    loadingOption.disabled = true;
    loadingOption.selected = true;
    loadingOption.textContent = competeT('war.selectLinkedClan');
    refs.clanSelect.appendChild(loadingOption);
    if (!allowLinked) {
        renderGuestWarClanOption({
            refs,
            competeT,
            loginLabel: t('auth.login')
        });
        return;
    }
    try {
        const fixtureClan = activeFixture?.data?.clan;
        const clans = fixtureClan
            ? [fixtureClan]
            : await loadLinkedWarClans({ authState: sourceState });
        if (!warSourceGuard.isCurrent(sourceRequest, authState)) return;
        linkedClans = clans;
        clans.forEach(clan => {
            const option = document.createElement('option');
            option.value = clan.tag;
            option.textContent = `${clan.name || clan.tag} · ${clan.tag}`;
            refs.clanSelect.appendChild(option);
        });
        refs.clanSelect.disabled = false;
    } catch {
        if (!warSourceGuard.isCurrent(sourceRequest, authState)) return;
        refs.clanSelect.options[0].textContent = competeT('war.enterClanTag');
    }
}

function createWarLoader() {
    return createWarLoadController({
        refs,
        getSelectedTag: () => selectedTag,
        getFixture: () => activeFixture,
        setStatus,
        renderCurrent,
        selectHistoryTab: () => selectTab('history')
    });
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
