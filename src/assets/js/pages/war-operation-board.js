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
import { buildWarHistory } from '../war-operation-board/war-history-model.js';
import { renderWarHistory } from '../war-operation-board/war-history-renderer.js';
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

async function init() {
    collectRefs();
    initI18n();
    await Promise.resolve(syncAuthSession()).catch(() => null);
    profileHTML();
    bindEvents();
    initPlayerPerformancePopover({
        getCurrentContext: tag => currentWarPlayerContext(report, tag)
    });
    await loadClanOptions();
    const queryTag = normalizeTag(new URLSearchParams(location.search).get('clan') || '');
    if (queryTag) {
        refs.tagInput.value = queryTag;
        await selectClan(queryTag);
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
        const clans = await loadLinkedWarClans();
        refs.clanSelect.insertAdjacentHTML('beforeend', clans.map(clan =>
            `<option value="${clan.tag}">${escapeOption(clan.name)} · ${clan.tag}</option>`
        ).join(''));
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
    window.history.replaceState(null, '', `?clan=${encodeURIComponent(selectedTag)}`);
    await loadWar();
}

async function loadWar(forceRefresh = false) {
    if (!selectedTag) return;
    controller?.abort();
    controller = new AbortController();
    const token = ++requestToken;
    refs.refresh.disabled = true;
    refs.content.classList.toggle('is-refreshing', Boolean(report));
    setStatus(forceRefresh ? 'Refreshing live war data…' : 'Loading current war…');
    try {
        const [rawWar, rawHistory] = await Promise.all([
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
        assignments = report.warKey
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
        const enriched = await enrichWithHistoricalPerformance(report);
        if (token !== requestToken) return;
        report = enriched;
        renderCurrent();
    } catch (error) {
        if (error?.name === 'AbortError') return;
        refs.empty.hidden = Boolean(report);
        refs.content.hidden = !report;
        if (error instanceof ActiveCwlWarError) {
            setStatus(`${error.message} `, true, true);
        } else {
            setStatus(error?.message || 'The current war could not be loaded.', true);
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
    document.querySelectorAll('[data-war-tab]').forEach(button =>
        button.setAttribute('aria-selected', String(button.dataset.warTab === tab))
    );
    document.querySelectorAll('[data-war-panel]').forEach(panel => {
        panel.hidden = panel.dataset.warPanel !== tab;
    });
}

function setStatus(message, error = false, cwlLink = false) {
    refs.status.classList.toggle('is-error', error);
    refs.status.innerHTML = `${escapeOption(message)}${cwlLink
        ? '<a href="./cwl-operation-board.html">Open CWL operation board →</a>'
        : ''}`;
}

function escapeOption(value) {
    return String(value || '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

const initialPageLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialPageLoad);
