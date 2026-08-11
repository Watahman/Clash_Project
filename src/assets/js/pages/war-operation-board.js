import { getClanCurrentWarRequest, getClanWarLogRequest } from '../API/API-Clan.js';
import { syncAuthSession } from '../auth/auth-client.js';
import { initPlayerPerformancePopover } from '../cwl/cwl-player-performance-popover.js';
import { initI18n } from '../i18n/i18n.js';
import { enrichWithHistoricalPerformance } from '../operation-board/operation-board-performance.js?v=20260729-2';
import { looksLikeClashTag, normalizeTag } from '../operation-board/operation-board-utils.js';
import { profileHTML } from '../profile/profile_popup.js';
import {
    deleteWarAssignment,
    getWarAssignments,
    setWarAssignment
} from '../Supabase/Supabase-WarAssignments.js';
import { loadLinkedWarClans } from '../war-operation-board/war-clan-source.js';
import {
    fixtureWar,
    setEmptyState
} from '../war-operation-board/war-page-utils.js';
import { buildWarHistory } from '../war-operation-board/war-history-model.js';
import { renderWarHistory } from '../war-operation-board/war-history-renderer.js';
import { loadWarFixture } from '../operation-board/operation-board-fixtures.js';
import {
    ActiveCwlWarError,
    buildWarBoardReport,
    currentWarPlayerContext
} from '../war-operation-board/war-report-model.js';
import {
    renderBaseDetail,
    renderRoster,
    renderScoreStrip,
    renderStats,
    renderWarMap
} from '../war-operation-board/war-renderer.js';

const refs = {};
let selectedTag = '';
let report = null;
let historyData = null;
let assignments = [];
let mapSide = 'enemy';
let selectedPosition = 1;
let controller = null;
let requestToken = 0;
let activeFixture = null;

async function init() {
    collectRefs();
    activeFixture = await loadWarFixture().catch(error => {
        console.error(error);
        return null;
    });
    initI18n();
    if (!activeFixture) await Promise.resolve(syncAuthSession()).catch(() => null);
    profileHTML();
    bindEvents();
    initPlayerPerformancePopover({
        getCurrentContext: tag => currentWarPlayerContext(report, tag)
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
        refs.clanSelect.options[0].textContent = 'Enter a clan tag';
    }
}

function bindEvents() {
    refs.clanSelect.addEventListener('change', () => {
        if (refs.clanSelect.value) void selectClan(refs.clanSelect.value);
    });
    refs.tagForm.addEventListener('submit', event => {
        event.preventDefault();
        const tag = normalizeTag(refs.tagInput.value);
        if (!looksLikeClashTag(tag)) {
            setStatus('Enter a valid Clash of Clans clan tag.', true);
            return;
        }
        void selectClan(tag);
    });
    refs.refresh.addEventListener('click', () => void loadWar(true));
    document.querySelector('.war-tabs').addEventListener('click', event => {
        const button = event.target.closest('[data-war-tab]');
        if (button) selectTab(button.dataset.warTab);
    });
    document.querySelectorAll('[data-war-tab]').forEach(button => {
        button.addEventListener('keydown', event => {
            const tabs = Array.from(document.querySelectorAll('[data-war-tab]'));
            const index = tabs.indexOf(button);
            const next = event.key === 'ArrowRight'
                ? tabs[(index + 1) % tabs.length]
                : event.key === 'ArrowLeft'
                    ? tabs[(index - 1 + tabs.length) % tabs.length]
                    : event.key === 'Home' ? tabs[0]
                        : event.key === 'End' ? tabs[tabs.length - 1] : null;
            if (!next) return;
            event.preventDefault();
            selectTab(next.dataset.warTab);
            next.focus();
        });
    });
    document.querySelector('.war-side-switch').addEventListener('click', event => {
        const button = event.target.closest('[data-map-side]');
        if (!button) return;
        mapSide = button.dataset.mapSide;
        document.querySelectorAll('[data-map-side]').forEach(item =>
            item.setAttribute('aria-pressed', String(item === button))
        );
        selectedPosition = 1;
        renderCurrent();
    });
    document.addEventListener('click', handleBoardClick);
    document.addEventListener('submit', handleAssignmentSubmit);
    refs.rosterFilter.addEventListener('change', () =>
        renderRoster(refs.roster, report, refs.rosterFilter.value)
    );
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

async function loadWar(forceRefresh = false) {
    if (!selectedTag) return;
    controller?.abort();
    controller = new AbortController();
    const token = ++requestToken;
    report = null;
    historyData = null;
    assignments = [];
    refs.refresh.disabled = true;
    refs.content.classList.remove('is-refreshing');
    refs.content.hidden = true;
    refs.empty.hidden = false;
    setEmptyState(refs.empty,
        forceRefresh ? 'Refreshing current war' : 'Loading current war',
        'The board will show the latest official state when it is ready.'
    );
    setStatus(forceRefresh ? 'Refreshing live war data…' : 'Loading current war…');
    try {
        const [rawWar, rawHistory] = activeFixture
            ? [fixtureWar(activeFixture), activeFixture.data?.warLog || []]
            : await Promise.all([
                getClanCurrentWarRequest(selectedTag, {
                    signal: controller.signal,
                    forceRefresh
                }),
                getClanWarLogRequest(selectedTag, {
                    signal: controller.signal,
                    forceRefresh
                })
            ]);
        if (token !== requestToken) return;
        report = buildWarBoardReport(rawWar, selectedTag);
        historyData = buildWarHistory(rawHistory, selectedTag);
        assignments = !activeFixture && report.warKey
            ? await getWarAssignments(report.clan.tag, report.warKey).catch(() => [])
            : [];
        refs.empty.hidden = true;
        refs.content.hidden = false;
        renderCurrent();
        if (!report.wars.length) {
            setStatus('This clan is not in a public regular Clan War. Recent history is still available.');
            selectTab('history');
            return;
        }
        setStatus('Live war data synced from the official Clash of Clans API.');
        if (activeFixture) return;
        const enriched = await enrichWithHistoricalPerformance(report);
        if (token !== requestToken) return;
        report = enriched;
        renderCurrent();
    } catch (error) {
        if (error?.name === 'AbortError') return;
        if (token !== requestToken) return;
        report = null;
        historyData = null;
        assignments = [];
        refs.empty.hidden = false;
        refs.content.hidden = true;
        if (error instanceof ActiveCwlWarError) {
            setStatus(`${error.message} `, true, true);
            setEmptyState(refs.empty,
                'This clan is in an active CWL war',
                'Regular War Board is for regular wars. Continue in CWL Tracker for the active league war.',
                true
            );
        } else {
            setStatus(error?.message || 'The current war could not be loaded.', true);
            setEmptyState(refs.empty,
                'The current war is unavailable',
                error?.message || 'Try refreshing when the official API is available.'
            );
        }
    } finally {
        if (token === requestToken) {
            refs.refresh.disabled = false;
            refs.content.classList.remove('is-refreshing');
        }
    }
}

function renderCurrent() {
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
        assignments = assignments.filter(item =>
            !(item.playerTag === saved.playerTag
                && item.attackSlot === saved.attackSlot)
        ).concat(saved);
        renderCurrent();
        setStatus('Assignment saved.');
    } catch (error) {
        setStatus(error?.message || 'Assignment could not be saved.', true);
    }
}

async function removeAssignment(assignmentId) {
    try {
        await deleteWarAssignment(assignmentId);
        assignments = assignments.filter(item => item.id !== assignmentId);
        renderCurrent();
        setStatus('Assignment removed.');
    } catch (error) {
        setStatus(error?.message || 'Assignment could not be removed.', true);
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
    refs.status.classList.toggle('is-error', error);
    refs.status.replaceChildren(document.createTextNode(String(message || '')));
    if (cwlLink) {
        const link = document.createElement('a');
        link.href = '/app/cwl-tracker';
        link.textContent = 'Open CWL Tracker';
        refs.status.append(' ', link);
    }
}

const initialPageLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialPageLoad);
