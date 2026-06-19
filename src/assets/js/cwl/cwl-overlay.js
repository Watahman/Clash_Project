import { getClanMembersWithBattleData, getPlayerWithBattleData } from "../API/API-Functions.js";
import { getClanInfoRequest } from "../API/API-Clan.js";
import { createPlayerCard, createClanCard } from "../templates/CWLTemplates.js";
import { getUserBases } from "../Supabase/Supabase-User.js";
import { getFriends } from "../Supabase/Supabase-Friend.js";
import { initGroupOverlay } from "./cwl-group.js";
import { getCurrentUserId } from "../utils/user.js";

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
        overlayConfirmTagBtn, cwlInputTag
    } = refs;

    addPlayersBtn.onclick = () => {
        document.querySelector("#cwl-overlay-add-players").classList.toggle("hidden");
    };

    modalTabBtn.forEach(tab => {
        tab.onclick = () => {
            document.querySelector(".modal-tab-btn.active")?.classList.remove("active");
            tab.classList.add("active");
            if (tab.dataset.tab === "tag") {
                document.querySelector("#modal-tab-tag").classList.remove("hidden");
                document.querySelector("#modal-tab-accounts").classList.add("hidden");
                document.querySelector("#modal-tab-group").classList.add("hidden");
                document.querySelector(".modal-group-preview-list").classList.add("hidden");
            } else if (tab.dataset.tab === "accounts") {
                document.querySelector("#modal-tab-tag").classList.add("hidden");
                document.querySelector("#modal-tab-accounts").classList.remove("hidden");
                document.querySelector("#modal-tab-group").classList.add("hidden");
                showAccountEmptyState();
                document.querySelector(".modal-group-preview-list").classList.add("hidden");
                document.querySelectorAll(".userBase:not(.hidden)").forEach(() => hideAccountEmptyState());
            } else if (tab.dataset.tab === "group") {
                document.querySelector("#modal-tab-tag").classList.add("hidden");
                document.querySelector("#modal-tab-accounts").classList.add("hidden");
                document.querySelector("#modal-tab-group").classList.remove("hidden");
                document.querySelector(".modal-group-preview-list").classList.remove("hidden");
            }
        };
    });

    segBtns.forEach(tab => {
        tab.onclick = () => {
            document.querySelector(".modal-seg-btn.active")?.classList.remove("active");
            tab.classList.add("active");
            showAccountEmptyState();
            if (tab.dataset.seg === "mine") {
                document.querySelectorAll(".userBase").forEach(userBase => {
                    userBase.classList.remove("hidden");
                    hideAccountEmptyState();
                });
                document.querySelectorAll(".friendBase").forEach(friendBase => friendBase.classList.add("hidden"));
            } else if (tab.dataset.seg === "friends") {
                document.querySelectorAll(".userBase").forEach(userBase => userBase.classList.add("hidden"));
                document.querySelectorAll(".friendBase").forEach(friendBase => {
                    friendBase.classList.remove("hidden");
                    hideAccountEmptyState();
                });
            }
        };
    });

    overlayConfirmTagBtn.onclick = () => {
        const tag = cwlInputTag.value.trim();
        if (!tag) return;
        getPlayerWithBattleData(tag)
            .then(data => { createPlayerCard(data); })
            .catch(() => {
                getClanMembersWithBattleData(tag).then(data => {
                    data.forEach(player => {
                        getPlayerWithBattleData(player.tag).then(data => createPlayerCard(data));
                    });
                });
            });
    };

    loadAccountSources();
    initGroupOverlay(selectGroup);
}

function showAccountEmptyState() {
    document.querySelector("#modal-account-list-empty")?.classList.remove("hidden");
}

function hideAccountEmptyState() {
    document.querySelector("#modal-account-list-empty")?.classList.add("hidden");
}

function loadAccountSources() {
    const userId = getCurrentUserId();
    if (!userId) {
        showAccountEmptyState();
        return;
    }

    getUserBases(userId)
        .then(data => {
            const accounts = data?.[0]?.accounts;
            if (Array.isArray(accounts) && accounts.length > 0) {
                createPlayerCard(accounts, "user");
                hideAccountEmptyState();
            }
        })
        .catch(error => console.error(error));

    getFriends(userId)
        .then(data => {
            if (!Array.isArray(data)) return;
            data.forEach(friend => {
                const friendId = friend.user_b || friend.user_a;
                if (!friendId) return;
                getUserBases(friendId).then(data => {
                    const accounts = data?.[0]?.accounts;
                    if (Array.isArray(accounts) && accounts.length > 0) {
                        createPlayerCard(accounts, "friends");
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
