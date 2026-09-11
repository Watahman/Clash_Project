import { initI18n, t } from '../i18n/i18n.js?v=20260831-master-live-v1';
import {
    getAuthState,
    syncAuthSession
} from "../auth/auth-client.js?v=20260829-public-auth-v1";
import { initOverlayHide, initAddPlayersOverlay, initAddClanButton, applyCwlSizeRestriction } from "../cwl/cwl-overlay.js?v=20260830-player-drag-v3";
import { initPlanIO, savePlan, loadAllPlans, loadPlanListener, startNewPlan, undoLastPlanChange } from "../cwl/cwl-plan-io.js?v=20260830-player-drag-v3";
import { initFreeRosterFilter } from "../cwl/cwl-roster-filter.js?v=20260829-public-auth-v1";
import { initClanVisibilityFilter } from "../cwl/cwl-clan-visibility-filter.js?v=20260829-public-auth-v1";
import { refreshPlannerPriorityLabels } from "../cwl/cwl-priority-labels.js?v=20260829-public-auth-v1";
import { initSpreadsheetImport } from "../cwl/cwl-spreadsheet-import.js?v=20260830-player-drag-v3";
import { getClanInfoRequest } from "../API/API-Clan.js?v=20260829-public-auth-v1";
import * as conf from "../Data/config.js";
import { initPlayerPerformanceClient } from "../cwl/player-performance-client.js?v=20260829-public-auth-v1";
import { initPlayerPerformancePopover } from "../cwl/cwl-player-performance-popover.js?v=20260829-public-auth-v1";
import { initAutoPlan } from "../cwl/auto-plan/cwl-auto-plan-ui.js?v=20260829-public-auth-v1";
import { initOptimizePlan } from "../cwl/optimize-plan/cwl-optimize-plan-ui.js?v=20260829-public-auth-v1";
import { initCwlPlanExport } from "../cwl/export/cwl-export-ui.js?v=20260829-public-auth-v1";
import { initPlannerSurface } from "../cwl/cwl-planner-ui.js?v=20260829-public-auth-v1";
import { initPlannerSaveAction } from "../cwl/cwl-planner-save-action.js?v=20260829-public-auth-v1";
import * as plannerStorage from "../cwl/cwl-planner-guest-storage.js?v=20260829-public-auth-v1";
import {
    applyPlannerFixture,
    getRequestedPlannerFixture
} from '../fixtures/planner-fixtures.js?v=20260830-player-drag-v3';
import { isRedesignFixtureRequested } from '../fixtures/redesign-fixture-mode.js';

export { savePlan };

let addClanBtn, overlayAddClanBtn;
let cwlInputTag, cwlInputClanCode, selectAmountPlayers;
let savePlanBtn, newPlanBtn, undoPlanBtn, planName, loadPlan;
let plannerAuthState = null;
let availablePlayers, allClans, totalPlayerAmount;
let pageTitle;
let addPlayersBtn, overlayConfirmTagBtn, accountList,
    addSelectedBtn, segBtns, selectGroup, groupPreview,
    groupPreviewList, loadGroupBtn, modalTabBtn, modalAccountListEmpty,
    selectGroupPoll, groupLinkedClans, rosterPollSelect;

function labelInit() {
    addClanBtn             = document.querySelector("#cwl-add-clan-button");
    overlayAddClanBtn      = document.querySelector("#cwl-overlay-add-clan-button");
    cwlInputTag            = document.querySelector("#cwl-input-tag");
    cwlInputClanCode       = document.querySelector("#cwl-input-clan-clancode");
    selectAmountPlayers    = document.querySelector("#cwl-overlay-select-amount-players-in-clan");
    savePlanBtn            = document.querySelector("#cwl-save-plan-button");
    newPlanBtn             = document.querySelector("#cwl-new-plan-button");
    undoPlanBtn            = document.querySelector("#cwl-undo-plan-button");
    planName               = document.querySelector("#cwl-plan-name");
    loadPlan               = document.querySelector("#cwl-load-plan");
    availablePlayers       = document.querySelector("#cwl-available-players");
    allClans               = document.querySelector("#cwl-all-clans");
    totalPlayerAmount      = document.querySelector("#cwl-total-player-amount");
    pageTitle              = document.querySelector("#cwl-page-title");
    addPlayersBtn          = document.querySelector("#cwl-add-players-button");
    overlayConfirmTagBtn   = document.querySelector("#cwl-overlay-confirm-tag-button");
    accountList            = document.querySelector("#cwl-account-list");
    addSelectedBtn         = document.querySelector("#cwl-overlay-add-selected-button");
    segBtns                = document.querySelectorAll(".modal-seg-btn");
    modalTabBtn            = document.querySelectorAll(".modal-tab-btn");
    selectGroup            = document.querySelector("#cwl-select-group");
    groupPreview           = document.querySelector("#cwl-group-preview");
    groupPreviewList       = document.querySelector("#cwl-group-preview-list");
    loadGroupBtn           = document.querySelector("#cwl-overlay-load-group-button");
    modalAccountListEmpty  = document.querySelector("#modal-account-list-empty");
    selectGroupPoll        = document.querySelector("#cwl-select-group-poll");
    groupLinkedClans       = document.querySelector("#cwl-group-linked-clans");
    rosterPollSelect       = document.querySelector("#cwl-roster-poll-select");
}

async function init() {
    initI18n();
    const fixture = isRedesignFixtureRequested() ? await getRequestedPlannerFixture() : null;
    plannerAuthState = fixture
        ? { status: 'guest', session: null }
        : getAuthState();
    const authSync = fixture ? Promise.resolve(null) : syncAuthSession().catch(() => null);
    window.addEventListener('clashtools:planner-auth-state-changed', event => {
        plannerAuthState = event.detail || { status: 'guest', session: null };
        updateSaveButtonState();
    });
    const restoreFixtureStorage = fixture ? preservePlannerStorage() : null;
    if (fixture) {
        conf.setCanAutosave(false);
        window.addEventListener('clashtools:cwl-plan-loaded', () => restoreFixtureStorage(), { passive: true });
    }
    labelInit();
    initOverlayHide();
    initPlanIO({ availablePlayers, allClans, totalPlayerAmount, planName, loadPlan, authState: plannerAuthState });
    restoreFixtureStorage?.();
    initAddPlayersOverlay({
        addPlayersBtn, modalTabBtn, segBtns, selectGroup, overlayConfirmTagBtn,
        cwlInputTag, addSelectedBtn, accountList, modalAccountListEmpty,
        groupPreview, groupPreviewList, loadGroupBtn, selectGroupPoll, groupLinkedClans,
        rosterPollSelect, authState: plannerAuthState
    });
    initAddClanButton({ addClanBtn, overlayAddClanBtn, cwlInputClanCode, selectAmountPlayers });
    initSpreadsheetImport();
    initPlannerSaveAction({ button: savePlanBtn, onStateChange: updateSaveButtonState });
    initSaveButtonState();
    newPlanBtn?.addEventListener('click', startNewPlan);
    undoPlanBtn?.addEventListener('click', () => void undoLastPlanChange());
    window.addEventListener('clashtools:cwl-undo-state', event => {
        if (undoPlanBtn) undoPlanBtn.disabled = !event.detail?.canUndo;
    });
    initFreeRosterFilter({
        container: availablePlayers,
        input: document.querySelector('#cwl-roster-search'),
        status: document.querySelector('#cwl-roster-filter-status'),
        sourceSelect: document.querySelector('#cwl-roster-source-clan'),
        performanceMin: document.querySelector('#cwl-roster-performance-min'),
        performanceMax: document.querySelector('#cwl-roster-performance-max'),
        availabilitySelect: document.querySelector('#cwl-roster-availability'),
        sorting: document.querySelector('#cwl-player-sorting')
    });
    initClanVisibilityFilter({
        container: allClans,
        select: document.querySelector('#cwl-clan-visibility')
    });
    initPlayerPerformanceClient();
    initPlayerPerformancePopover();
    initAutoPlan();
    initOptimizePlan();
    initCwlPlanExport();
    initPlannerSurface({ root: document });
    initPlanNameSync();
    initPlannerHeaderState();
    window.addEventListener('clashtools:cwl-active-poll-changed', () => savePlan());
    guessCwlSize(fixture);
    if (fixture) {
        applyPlannerFixture(fixture);
    } else {
        await loadAllPlans();
    }
    await authSync;
    loadPlanListener();
}

function preservePlannerStorage() {
    const keys = ['planner_id', 'clashtools_planner_cache', 'clashtools_planner_recovery_v1', 'clashtools_last_planner_players'];
    const values = keys.map(key => localStorage.getItem(key));
    return () => keys.forEach((key, index) => {
        if (values[index] === null) localStorage.removeItem(key);
        else localStorage.setItem(key, values[index]);
    });
}

function initPlanNameSync() {
    if (!planName) return;
    planName.addEventListener('input', () => {
        syncPlanTitle();
        savePlan();
    });
    window.addEventListener('clashtools:cwl-plan-loaded', () => {
        syncPlanTitle();
        updateSaveButtonState();
    });
    window.addEventListener('clashtools:cwl-plan-name-defaulted', () => {
        syncPlanTitle();
        updateSaveButtonState();
    });
    window.addEventListener('clashtools:language-changed', refreshPlannerLabels);
    refreshPlannerLabels();
    syncPlanTitle();
}

function refreshPlannerLabels() {
    availablePlayers.dataset.emptyLabel = t('planner.emptyRoster');
    allClans.dataset.emptyLabel = t('planner.emptyClans');
    refreshPlannerPriorityLabels();
    document.querySelectorAll('.cwl-clan-format > span').forEach(label => {
        label.textContent = t('planner.format');
    });
    document.querySelectorAll('.cwl-clan-capacity').forEach(select => {
        select.setAttribute('aria-label', t('planner.format'));
    });
    document.querySelectorAll('.cwl-delete-clan').forEach(button => {
        button.title = t('cwl.deleteClan');
        button.setAttribute('aria-label', t('cwl.deleteClan'));
    });
    syncPlanTitle();
}

function syncPlanTitle() {
    if (!pageTitle) return;
    pageTitle.textContent = planName?.value.trim() || t('cwl.unnamedPlan');
}

function initPlannerHeaderState() {
    const state = document.querySelector('.cwl-plan-state');
    const saveStatus = document.querySelector('#cwl-save-status');
    const limitFeedback = document.querySelector('#cwl-plan-limit-feedback');
    if (!state || !saveStatus) return;
    const sync = () => {
        const saveState = saveStatus.dataset.state;
        const label = limitFeedback && !limitFeedback.hidden
            ? t('cwl.planLimitReached')
            : saveState === 'saving'
                ? t('cwl.saving')
                : saveState === 'error' || saveState === 'conflict'
                    ? t(saveState === 'conflict' ? 'cwl.saveConflict' : 'cwl.saveError')
                    : loadPlan?.value
                        ? t('cwl.saved')
                        : t('planner.draft');
        state.textContent = label;
        state.dataset.state = saveState || 'draft';
    };
    const observer = new MutationObserver(sync);
    observer.observe(saveStatus, { attributes: true, attributeFilter: ['data-state'] });
    if (limitFeedback) observer.observe(limitFeedback, { attributes: true, attributeFilter: ['hidden'] });
    window.addEventListener('clashtools:cwl-plan-loaded', sync);
    window.addEventListener('clashtools:cwl-plan-name-defaulted', sync);
    window.addEventListener('clashtools:language-changed', sync);
    sync();
}

function initSaveButtonState() {
    if (!savePlanBtn || !planName) return;
    updateSaveButtonState();
    planName.addEventListener('input', updateSaveButtonState);
    window.addEventListener('clashtools:cwl-player-added', updateSaveButtonState);
    window.addEventListener('clashtools:cwl-player-removed', updateSaveButtonState);
    window.addEventListener('clashtools:cwl-plan-loaded', updateSaveButtonState);
    const observer = new MutationObserver(updateSaveButtonState);
    if (availablePlayers) observer.observe(availablePlayers, { childList: true, subtree: true });
    if (allClans) observer.observe(allClans, { childList: true, subtree: true });
}

function updateSaveButtonState() {
    if (!savePlanBtn || !planName) return;
    const hasPlayers = Boolean(availablePlayers?.querySelector('.cwl-player-article'));
    const hasClans = Boolean(allClans?.querySelector('.cwl-clan-article'));
    const canSave = hasPlayers || hasClans;
    savePlanBtn.disabled = !canSave;
    const saveKey = plannerStorage.hasCloudPlannerAccess()
        ? 'cwl.save'
        : 'planner.saveToAccount';
    savePlanBtn.textContent = t(saveKey);
    savePlanBtn.title = canSave ? t(saveKey) : t('cwl.saveDisabledReason');
}

function guessCwlSize(fixture = null) {
    if (fixture) return;
    let timer;
    cwlInputClanCode.addEventListener("input", (event) => {
        clearTimeout(timer);
        const clanTag = event.target.value.trim();
        timer = setTimeout(() => {
            if (!clanTag.startsWith("#") || clanTag.length < 4) {
                applyCwlSizeRestriction(selectAmountPlayers, true);
                return;
            }
            getClanInfoRequest(clanTag).then(data => {
                const league = data?.warLeague?.name || "";
                const championLeague = [
                    "Champion League I",
                    "Champion League II",
                    "Champion League III"
                ].includes(league);
                applyCwlSizeRestriction(selectAmountPlayers, !championLeague);
            }).catch(() => applyCwlSizeRestriction(selectAmountPlayers, true));
        }, 500);
    });
}

const initialPageLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialPageLoad);
