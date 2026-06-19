import { initI18n } from '../i18n/i18n.js';
import { profileHTML } from "../profile/profile_popup.js";
import { initOverlayHide, initAddPlayersOverlay, initAddClanButton, applyCwlSizeRestriction } from "../cwl/cwl-overlay.js";
import { initPlanIO, savePlan, loadAllPlans, loadPlanListener } from "../cwl/cwl-plan-io.js";
import { getClanInfoRequest } from "../API/API-Clan.js";
import * as conf from "../Data/config.js";

export { savePlan };

let addClanPlayersBtn, overlayAddPlayersBtn, addClanBtn, overlayAddClanBtn;
let cwlInputTag, cwlInputClanCode, selectAmountPlayers;
let savePlanBtn, planName, loadPlan;
let availablePlayers, allClans, totalPlayerAmount;
let addPlayersBtn, overlayConfirmTagBtn, accountsSearch, accountList,
    addSelectedBtn, segBtns, selectGroup, groupPreview,
    groupPreviewList, loadGroupBtn, modalTabBtn, modalAccountListEmpty;

function labelInit() {
    addClanPlayersBtn      = document.querySelector("#cwl-add-clan-players-button");
    overlayAddPlayersBtn   = document.querySelector("#cwl-overlay-add-players-button");
    addClanBtn             = document.querySelector("#cwl-add-clan-button");
    overlayAddClanBtn      = document.querySelector("#cwl-overlay-add-clan-button");
    cwlInputTag            = document.querySelector("#cwl-input-tag");
    cwlInputClanCode       = document.querySelector("#cwl-input-clan-clancode");
    selectAmountPlayers    = document.querySelector("#cwl-overlay-select-amount-players-in-clan");
    savePlanBtn            = document.querySelector("#cwl-save-plan-button");
    planName               = document.querySelector("#cwl-plan-name");
    loadPlan               = document.querySelector("#cwl-load-plan");
    availablePlayers       = document.querySelector("#cwl-available-players");
    allClans               = document.querySelector("#cwl-all-clans");
    totalPlayerAmount      = document.querySelector("#cwl-total-player-amount");
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
}

function init() {
    initI18n();
    labelInit();
    initOverlayHide();
    initPlanIO({ availablePlayers, allClans, totalPlayerAmount, planName, loadPlan });
    initAddPlayersOverlay({ addPlayersBtn, modalTabBtn, segBtns, selectGroup, overlayConfirmTagBtn, cwlInputTag });
    initAddClanButton({ addClanBtn, overlayAddClanBtn, cwlInputClanCode, selectAmountPlayers });
    savePlanButton();
    initPlayerSorting();
    guessCwlSize();
    loadAllPlans();
    loadPlanListener();
    profileHTML();
    localStorage.setItem("planner_id", "");
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
    window.addEventListener('clashtools:cwl-plan-loaded', sortPlayers);
}
function getName(card) { return card.querySelector('.cwl-player-name')?.textContent?.trim().toLowerCase() || ''; }
function getTownHall(card) { const m=(card.querySelector('.cwl-player-townhall-foto')?.getAttribute('src')||'').match(/Town_Hall(\d+)\.png/i); return m ? Number(m[1]) : 0; }

function savePlanButton() {
    savePlanBtn.addEventListener("click", () => {
        if (planName.value === "") {
            // make indicator
        } else {
            conf.setCanAutosave(true);
            savePlan();
        }
    });
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

init();
