import { getClanMembersBasicData, getPlayerBasicData } from "../API/API-Functions.js";
import { getClanInfoRequest } from "../API/API-Clan.js";
import { createPlayerCard, createClanCard } from "../templates/CWLTemplates.js";
import { getUserBases } from "../Supabase/Supabase-User.js";
import { getFriends } from "../Supabase/Supabase-Friend.js";
import { initGroupOverlay } from "./cwl-group.js";
import { getCurrentUserId } from "../utils/user.js";
import { uniquePlayers } from "./cwl-utils.js";

let accountLoadToken = 0;
let activeAccountSource = 'user';

export function initOverlayHide() {
    document.querySelectorAll(".overlay").forEach(overlay =>
        overlay.addEventListener("click", () => overlay.classList.add("hidden")));
    document.querySelectorAll(".overlay-container").forEach(overlayContainer => {
        overlayContainer.addEventListener("click", (e) => { e.stopPropagation(); });
    });
}

export function initAddPlayersOverlay(refs) {
    const {
        addPlayersBtn, modalTabBtn, segBtns, selectGroup,
        overlayConfirmTagBtn, cwlInputTag, addSelectedBtn
    } = refs;

    addPlayersBtn.onclick = () => {
        document.querySelector("#cwl-overlay-add-players").classList.toggle("hidden");
        updateAddSelectedButton(addSelectedBtn);
    };

    modalTabBtn.forEach(tab => {
        tab.onclick = () => showMainTab(tab.dataset.tab, modalTabBtn);
    });

    segBtns.forEach(tab => {
        tab.onclick = () => {
            document.querySelector(".modal-seg-btn.active")?.classList.remove("active");
            tab.classList.add("active");
            activeAccountSource = tab.dataset.seg === 'friends' ? 'friends' : 'user';
            showAccountSource(activeAccountSource);
            updateAddSelectedButton(addSelectedBtn);
        };
    });

    overlayConfirmTagBtn.onclick = () => {
        const tag = cwlInputTag.value.trim();
        if (!tag) return;
        getPlayerBasicData(tag)
            .then(data => { createPlayerCard(data); })
            .catch(() => {
                getClanMembersBasicData(tag).then(players => createPlayerCard(players));
            });
    };

    addSelectedBtn?.addEventListener('click', () => {
        const selected = Array.from(document.querySelectorAll('#cwl-account-list .cwl-player-article.selected'))
            .map(card => card._cwlPlayer)
            .filter(Boolean);
        if (!selected.length) return;
        createPlayerCard(uniquePlayers(selected));
        document.querySelectorAll('#cwl-account-list .cwl-player-article.selected')
            .forEach(card => card.classList.remove('selected'));
        updateAddSelectedButton(addSelectedBtn);
    });

    window.addEventListener('clashtools:cwl-preview-selection-changed', () => updateAddSelectedButton(addSelectedBtn));

    loadAccountSources(addSelectedBtn);
    initGroupOverlay(selectGroup, refs);
}

function showMainTab(tabName, modalTabBtn) {
    document.querySelector(".modal-tab-btn.active")?.classList.remove("active");
    Array.from(modalTabBtn).find(tab => tab.dataset.tab === tabName)?.classList.add("active");
    document.querySelector("#modal-tab-tag").classList.toggle("hidden", tabName !== "tag");
    document.querySelector("#modal-tab-accounts").classList.toggle("hidden", tabName !== "accounts");
    document.querySelector("#modal-tab-group").classList.toggle("hidden", tabName !== "group");
    document.querySelector(".modal-group-preview-list")?.classList.toggle("hidden", tabName !== "group");
    if (tabName === "accounts") showAccountSource(activeAccountSource);
}

function showAccountSource(source) {
    showAccountEmptyState();
    document.querySelectorAll("#cwl-account-list .cwl-player-article").forEach(card => {
        const visible = card.dataset.source === source;
        card.classList.toggle("hidden", !visible);
        if (visible) hideAccountEmptyState();
    });
}

function showAccountEmptyState() {
    document.querySelector("#modal-account-list-empty")?.classList.remove("hidden");
}

function hideAccountEmptyState() {
    document.querySelector("#modal-account-list-empty")?.classList.add("hidden");
}

function updateAddSelectedButton(button) {
    if (!button) return;
    const count = document.querySelectorAll('#cwl-account-list .cwl-player-article.selected').length;
    button.textContent = `Geselecteerde toevoegen (${count})`;
}

function resetAccountList() {
    const list = document.querySelector("#cwl-account-list");
    const empty = document.querySelector("#modal-account-list-empty");
    if (list && empty) list.replaceChildren(empty);
    showAccountEmptyState();
}

function loadAccountSources(addSelectedBtn) {
    const token = ++accountLoadToken;
    const userId = getCurrentUserId();
    resetAccountList();
    if (!userId) return;

    getUserBases(userId)
        .then(data => {
            if (token !== accountLoadToken) return;
            const accounts = data?.[0]?.accounts;
            if (Array.isArray(accounts) && accounts.length > 0) {
                createPlayerCard(accounts, "user");
                showAccountSource(activeAccountSource);
                updateAddSelectedButton(addSelectedBtn);
            }
        })
        .catch(error => console.error(error));

    getFriends(userId)
        .then(data => {
            if (token !== accountLoadToken || !Array.isArray(data)) return;
            data.filter(friend => !friend.status || friend.status === 'accepted').forEach(friend => {
                const friendId = friend.user_a === userId ? friend.user_b : friend.user_a;
                if (!friendId || friendId === userId) return;
                getUserBases(friendId).then(userData => {
                    if (token !== accountLoadToken) return;
                    const accounts = userData?.[0]?.accounts;
                    if (Array.isArray(accounts) && accounts.length > 0) {
                        createPlayerCard(accounts, "friends");
                        showAccountSource(activeAccountSource);
                        updateAddSelectedButton(addSelectedBtn);
                    }
                });
            });
        })
        .catch(error => console.error(error));
}

export function initAddClanButton(refs) {
    const { addClanBtn, overlayAddClanBtn, cwlInputClanCode, selectAmountPlayers } = refs;

    addClanBtn.addEventListener("click", () => {
        document.querySelector("#cwl-overlay-add-clan").classList.remove("hidden");
        ensureCwlSizeOptions(selectAmountPlayers);
    });

    overlayAddClanBtn.addEventListener("click", () => {
        const clanID = cwlInputClanCode.value.trim();
        const playerAmount = selectAmountPlayers.value;
        document.querySelectorAll(".overlay").forEach(overlay => overlay.classList.add("hidden"));
        if (clanID !== "") {
            getClanInfoRequest(clanID).then(data => createClanCard(data, playerAmount));
        }
        cwlInputClanCode.value = "";
    });
}

export function ensureCwlSizeOptions(selectAmountPlayers) {
    if (!selectAmountPlayers.querySelector('option[value="15"]')) {
        const option = document.createElement("option");
        option.value = "15";
        option.textContent = "15v15";
        selectAmountPlayers.appendChild(option);
    }
    if (!selectAmountPlayers.querySelector('option[value="30"]')) {
        const option = document.createElement("option");
        option.value = "30";
        option.textContent = "30v30";
        selectAmountPlayers.appendChild(option);
    }
}

export function applyCwlSizeRestriction(selectAmountPlayers, allowThirty) {
    ensureCwlSizeOptions(selectAmountPlayers);
    const thirtyOption = selectAmountPlayers.querySelector('option[value="30"]');
    if (!allowThirty && thirtyOption) {
        thirtyOption.remove();
        selectAmountPlayers.value = "15";
    }
}
