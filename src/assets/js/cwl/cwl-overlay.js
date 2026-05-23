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
            document.querySelector(".modal-tab-btn.active").classList.toggle("active");
            tab.classList.toggle("active");
            if (tab.dataset.tab === "tag") {
                document.querySelector("#modal-tab-tag").classList.remove("hidden");
                document.querySelector("#modal-tab-accounts").classList.add("hidden");
                document.querySelector("#modal-tab-group").classList.add("hidden");
                document.querySelector(".modal-group-preview-list").classList.add("hidden");
            } else if (tab.dataset.tab === "accounts") {
                document.querySelector("#modal-tab-tag").classList.add("hidden");
                document.querySelector("#modal-tab-accounts").classList.remove("hidden");
                document.querySelector("#modal-tab-group").classList.add("hidden");
                document.querySelector("#modal-account-list-empty").classList.remove("hidden");
                document.querySelector(".modal-group-preview-list").classList.add("hidden");
                document.querySelectorAll(".userBase").forEach(userBase => {
                    userBase.classList.remove("hidden");
                    document.querySelector("#modal-account-list-empty").classList.add("hidden");
                });
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
            document.querySelector(".modal-seg-btn.active").classList.remove("active");
            tab.classList.add("active");
            if (tab.dataset.seg === "mine") {
                document.querySelector("#modal-account-list-empty").classList.remove("hidden");
                document.querySelectorAll(".userBase").forEach(userBase => {
                    userBase.classList.remove("hidden");
                    document.querySelector("#modal-account-list-empty").classList.add("hidden");
                });
                document.querySelectorAll(".friendBase").forEach(friendBase => {
                    friendBase.classList.add("hidden");
                });
            } else if (tab.dataset.seg === "friends") {
                document.querySelector("#modal-account-list-empty").classList.remove("hidden");
                document.querySelectorAll(".userBase").forEach(userBase => {
                    userBase.classList.add("hidden");
                });
                document.querySelectorAll(".friendBase").forEach(friendBase => {
                    friendBase.classList.remove("hidden");
                    document.querySelector("#modal-account-list-empty").classList.add("hidden");
                });
            }
        };
    });

    overlayConfirmTagBtn.onclick = () => {
        const tag = cwlInputTag.value;
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

    getUserBases(getCurrentUserId()).then(data => {
        createPlayerCard(data[0].accounts, "user");
    });

    getFriends(getCurrentUserId()).then(data => {
        data.forEach(friend => {
            getUserBases(friend.user_b).then(data => {
                createPlayerCard(data[0].accounts, "friends");
            });
        });
    });

    initGroupOverlay(selectGroup);
}

export function initAddClanButton(refs) {
    const { addClanBtn, overlayAddClanBtn, cwlInputClanCode, selectAmountPlayers } = refs;

    addClanBtn.addEventListener("click", () => {
        document.querySelector("#cwl-overlay-add-clan").classList.remove("hidden");
        const option = selectAmountPlayers.querySelector("option[value=\"30\"]");
        if (!option) {
            let newOption = document.createElement("option");
            newOption.value = 30;
            newOption.textContent = "30v30";
            selectAmountPlayers.appendChild(newOption);
        }
    });

    overlayAddClanBtn.addEventListener("click", () => {
        const clanID = cwlInputClanCode.value;
        const playerAmount = selectAmountPlayers.value;
        document.querySelectorAll(".overlay").forEach(overlay => overlay.classList.add("hidden"));
        if (clanID !== "") {
            getClanInfoRequest(clanID).then(data => createClanCard(data, playerAmount));
        }
        cwlInputClanCode.value = "";
    });
}
