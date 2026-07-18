import { initI18n, t } from '../i18n/i18n.js';
import { profileHTML } from "../profile/profile_popup.js";
import { syncAuthSession } from "../auth/auth-client.js";
import { initOverlayHide, initAddPlayersOverlay, initAddClanButton, applyCwlSizeRestriction } from "../cwl/cwl-overlay.js";
import { initPlanIO, savePlan, loadAllPlans, loadPlanListener, startNewPlan } from "../cwl/cwl-plan-io.js";
import { initFreeRosterFilter } from "../cwl/cwl-roster-filter.js";
import { getClanInfoRequest } from "../API/API-Clan.js";
import * as conf from "../Data/config.js";

export { savePlan };

let addClanPlayersBtn, overlayAddPlayersBtn, addClanBtn, overlayAddClanBtn;
let cwlInputTag, cwlInputClanCode, selectAmountPlayers;
let savePlanBtn, newPlanBtn, planName, loadPlan;
let availablePlayers, allClans, totalPlayerAmount;
let pageTitle;
let addPlayersBtn, overlayConfirmTagBtn, accountsSearch, accountList,
    addSelectedBtn, segBtns, selectGroup, groupPreview,
    groupPreviewList, loadGroupBtn, modalTabBtn, modalAccountListEmpty,
    selectGroupPoll, groupLinkedClans;

function labelInit() {
    addClanPlayersBtn      = document.querySelector("#cwl-add-clan-players-button");
    overlayAddPlayersBtn   = document.querySelector("#cwl-overlay-add-players-button");
    addClanBtn             = document.querySelector("#cwl-add-clan-button");
    overlayAddClanBtn      = document.querySelector("#cwl-overlay-add-clan-button");
    cwlInputTag            = document.querySelector("#cwl-input-tag");
    cwlInputClanCode       = document.querySelector("#cwl-input-clan-clancode");
    selectAmountPlayers    = document.querySelector("#cwl-overlay-select-amount-players-in-clan");
    savePlanBtn            = document.querySelector("#cwl-save-plan-button");
    newPlanBtn             = document.querySelector("#cwl-new-plan-button");
    planName               = document.querySelector("#cwl-plan-name");
    loadPlan               = document.querySelector("#cwl-load-plan");
    availablePlayers       = document.querySelector("#cwl-available-players");
    allClans               = document.querySelector("#cwl-all-clans");
    totalPlayerAmount      = document.querySelector("#cwl-total-player-amount");
    pageTitle              = document.querySelector("#cwl-page-title");
    addPlayersBtn          = document.querySelector("#cwl-add-players-button");
    overlayConfirmTagBtn   = document.querySelector("#cwl-overlay-confirm-tag-button");
    accountsSearch         = document.querySelector("#cwl-accounts-search");
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
}

async function init() {
    initI18n();
    await syncAuthSession().catch(() => null);
    labelInit();
    initOverlayHide();
    initPlanIO({ availablePlayers, allClans, totalPlayerAmount, planName, loadPlan });
    initAddPlayersOverlay({
        addPlayersBtn, modalTabBtn, segBtns, selectGroup, overlayConfirmTagBtn,
        cwlInputTag, addSelectedBtn, accountList, modalAccountListEmpty,
        groupPreview, groupPreviewList, loadGroupBtn, selectGroupPoll, groupLinkedClans
    });
    initAddClanButton({ addClanBtn, overlayAddClanBtn, cwlInputClanCode, selectAmountPlayers });
    savePlanButton();
    initSaveButtonState();
    newPlanBtn?.addEventListener('click', startNewPlan);
    initFreeRosterFilter({
        container: availablePlayers,
        input: document.querySelector('#cwl-roster-search'),
        status: document.querySelector('#cwl-roster-filter-status')
    });
    initPlayerSorting();
    initPlanNameSync();
    guessCwlSize();
    void loadAllPlans();
    loadPlanListener();
    profileHTML({ preload: false });
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
    window.addEventListener('clashtools:language-changed', refreshPlannerLabels);
    refreshPlannerLabels();
    syncPlanTitle();
}

function refreshPlannerLabels() {
    availablePlayers.dataset.emptyLabel = t('planner.emptyRoster');
    allClans.dataset.emptyLabel = t('planner.emptyClans');
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

function initPlayerSorting() {
    const sorting = document.querySelector('#cwl-player-sorting');
    if (!sorting || !availablePlayers) return;
    const sortPlayers = () => {
        const players = Array.from(availablePlayers.querySelectorAll('.cwl-player-article'));
        players.sort((a, b) => {
            if (sorting.value === 'name') {
                return getName(a).localeCompare(getName(b), undefined, { sensitivity: 'base' });
            }
            return getTownHall(b) - getTownHall(a) || getName(a).localeCompare(getName(b), undefined, { sensitivity: 'base' });
        });
        players.forEach(player => availablePlayers.appendChild(player));
    };
    sorting.addEventListener('change', sortPlayers);
    window.addEventListener('clashtools:cwl-player-added', sortPlayers);
    window.addEventListener('clashtools:cwl-player-removed', sortPlayers);
    window.addEventListener('clashtools:cwl-plan-loaded', sortPlayers);
}
function getName(card) { return card.querySelector('.cwl-player-name')?.textContent?.trim().toLowerCase() || ''; }
function getTownHall(card) { const m=(card.querySelector('.cwl-player-townhall-foto')?.getAttribute('src')||'').match(/Town_Hall(\d+)\.png/i); return m ? Number(m[1]) : 0; }

function savePlanButton() {
    savePlanBtn.addEventListener("click", () => {
        updateSaveButtonState();
        if (savePlanBtn.disabled) return;
        conf.setCanAutosave(true);
        savePlan({ immediate: true });
    });
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
    const hasName = planName.value.trim().length > 0;
    const hasPlayers = Boolean(availablePlayers?.querySelector('.cwl-player-article'));
    const hasClans = Boolean(allClans?.querySelector('.cwl-clan-article'));
    const canSave = hasName && (hasPlayers || hasClans);
    savePlanBtn.disabled = !canSave;
    savePlanBtn.title = canSave ? t('cwl.save') : t('cwl.saveDisabledReason');
}

function guessCwlSize() {
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

void init();
