import { getClanMembersWithBattleData, getPlayerWithBattleData } from "./API/API-Functions.js"
import { getClanInfoRequest } from "./API/API-Clan.js"
import { createPlayerCard, createClanCard } from "./CWL-Templates.js";
import {databaseRequestWithBody} from "./API/API-Communication.js";
import * as conf from "./Data/config.js"
import {canAutosave, isLoading, setLoading} from "./Data/config.js";
import { profileHTML } from "./profile_popup.js"

let addClanPlayersBtn, overlayAddPlayersBtn, addClanBtn, overlayAddClanBtn
let cwlInputTag, cwlInputClanCode, selectAmountPlayers
let savePlanBtn, planName, loadPlan, path, data
let availablePlayers, allClans, totalPlayerAmount
let addPlayersBtn, overlayConfirmTagBtn, accountsSearch, accountList,
    addSelectedBtn, segBtns, selectGroup, groupPreview,
    groupPreviewList, loadGroupBtn, modalTabBtn, modalAccountListEmpty

function labelInit(){
    addClanPlayersBtn      = document.querySelector("#cwl-add-clan-players-button")
    overlayAddPlayersBtn   = document.querySelector("#cwl-overlay-add-players-button")
    addClanBtn             = document.querySelector("#cwl-add-clan-button")
    overlayAddClanBtn      = document.querySelector("#cwl-overlay-add-clan-button")
    cwlInputTag            = document.querySelector("#cwl-input-tag")
    cwlInputClanCode       = document.querySelector("#cwl-input-clan-clancode")
    selectAmountPlayers    = document.querySelector("#cwl-overlay-select-amount-players-in-clan")
    savePlanBtn            = document.querySelector("#cwl-save-plan-button")
    planName               = document.querySelector("#cwl-plan-name")
    loadPlan               = document.querySelector("#cwl-load-plan")
    availablePlayers       = document.querySelector("#cwl-available-players")
    allClans               = document.querySelector("#cwl-all-clans")
    totalPlayerAmount      = document.querySelector("#cwl-total-player-amount")
    addPlayersBtn          = document.querySelector("#cwl-add-players-button")
    overlayConfirmTagBtn   = document.querySelector("#cwl-overlay-confirm-tag-button")
    accountsSearch         = document.querySelector("#cwl-accounts-search")
    accountList            = document.querySelector("#cwl-account-list")
    addSelectedBtn         = document.querySelector("#cwl-overlay-add-selected-button")
    segBtns                = document.querySelectorAll(".modal-seg-btn")
    modalTabBtn            = document.querySelectorAll(".modal-tab-btn")
    selectGroup            = document.querySelector("#cwl-select-group")
    groupPreview           = document.querySelector("#cwl-group-preview")
    groupPreviewList       = document.querySelector("#cwl-group-preview-list")
    loadGroupBtn           = document.querySelector("#cwl-overlay-load-group-button")
    modalAccountListEmpty  = document.querySelector("#modal-account-list-empty")
}

function init(){
    overlayHide();
    labelInit();
    addPlayersOverlay()
    addClanButton();
    savePlanButton();
    guessCwlSize()
    loadAllPlans()
    loadPlanListener()
    profileHTML()
    localStorage.setItem("planner_id", "")
}

function addPlayersOverlay(){
    addPlayersBtn.onclick = () => {
        document.querySelector("#cwl-overlay-add-players").classList.toggle("hidden");
    }
    modalTabBtn.forEach(tab => {
        tab.onclick = () => {
            document.querySelector(".modal-tab-btn.active").classList.toggle("active");
            tab.classList.toggle("active");
            if(tab.dataset.tab === "tag"){
                document.querySelector("#modal-tab-tag").classList.remove("hidden");
                document.querySelector("#modal-tab-accounts").classList.add("hidden");
                document.querySelector("#modal-tab-group").classList.add("hidden");
            }else if(tab.dataset.tab === "accounts"){
                document.querySelector("#modal-tab-tag").classList.add("hidden");
                document.querySelector("#modal-tab-accounts").classList.remove("hidden");
                document.querySelector("#modal-tab-group").classList.add("hidden");
                document.querySelector("#modal-account-list-empty").classList.remove("hidden")

                document.querySelectorAll(".userBase").forEach(userBase => {
                    userBase.classList.remove("hidden")
                    document.querySelector("#modal-account-list-empty").classList.add("hidden")
                })
            }else if(tab.dataset.tab === "group"){
                document.querySelector("#modal-tab-tag").classList.add("hidden");
                document.querySelector("#modal-tab-accounts").classList.add("hidden");
                document.querySelector("#modal-tab-group").classList.remove("hidden");
            }
        }
    })

    segBtns.forEach(tab => {
        tab.onclick = () => {
            document.querySelector(".modal-seg-btn.active").classList.remove("active");
            tab.classList.add("active");
            if(tab.dataset.seg === "mine"){
                document.querySelector("#modal-account-list-empty").classList.remove("hidden")
                document.querySelectorAll(".userBase").forEach(userBase => {
                    userBase.classList.remove("hidden")
                    document.querySelector("#modal-account-list-empty").classList.add("hidden")
                })
                document.querySelectorAll(".friendBase").forEach(friendBase => {
                    friendBase.classList.add("hidden")
                })
            }else if(tab.dataset.seg === "friends"){
                document.querySelector("#modal-account-list-empty").classList.remove("hidden")
                document.querySelectorAll(".userBase").forEach(userBase => {
                    userBase.classList.add("hidden")
                })
                document.querySelectorAll(".friendBase").forEach(friendBase => {
                    friendBase.classList.remove("hidden")
                    document.querySelector("#modal-account-list-empty").classList.add("hidden")
                })
            }
        }
    })

    selectGroup.addEventListener('change', () => {
        if(selectGroup.value === "") return

    })

    overlayConfirmTagBtn.onclick = () => {
        const tag = cwlInputTag.value
        getPlayerWithBattleData(tag)
            .then(data => {
                createPlayerCard(data)
            })
            .catch(() => {
                getClanMembersWithBattleData(tag).then(data => {
                    data.forEach(player => {
                        getPlayerWithBattleData(player.tag)
                            .then(data => createPlayerCard(data))
                    })
                })
            })
    }

    path = conf._BASE_URL + conf._EXT_SUPA_USER_BASES
    data = { id: localStorage.getItem("id")}
    databaseRequestWithBody(path, data).then(data => {
        createPlayerCard(data[0].accounts, "user")
    })

    path = conf._BASE_URL + conf._EXT_SUPA_USER_GET_FRIENDS
    data = { userId: localStorage.getItem("id")}
    databaseRequestWithBody(path, data).then(data => {
        data.forEach(friend => {
            path = conf._BASE_URL + conf._EXT_SUPA_USER_BASES
            data = {id: friend.user_b}
            databaseRequestWithBody(path, data).then(data => {
                createPlayerCard(data[0].accounts, "friends")
            })
        })
    })

    path = conf._BASE_URL + conf._EXT_SUPA_GROUP_MEMBER
    data = { id: localStorage.getItem("id")}
    databaseRequestWithBody(path, data).then(data => {
        console.log(data)
        data.forEach(group => {
            path = conf._BASE_URL + conf._EXT_SUPA_GROUP_INFO
            data = {id: group.group_id}
            databaseRequestWithBody(path, data).then(groupInfo => {
                console.log(groupInfo)
                let newOption = document.createElement("option");
                newOption.value = groupInfo[0].id
                newOption.textContent = groupInfo[0].name
                selectGroup.appendChild(newOption)
                loadPreviewData(groupInfo[0].id)
            })
        })
    })
}

function addClanButton(){
    addClanBtn.addEventListener("click", () => {
        document.querySelector("#cwl-overlay-add-clan").classList.remove("hidden")
        const option = selectAmountPlayers.querySelector("option[value=\"30\"]")
        if(!option){
            let newOption = document.createElement("option");
            newOption.value = 30;
            newOption.textContent = "30v30";
            selectAmountPlayers.appendChild(newOption);
        }
    })
    overlayAddClanBtn.addEventListener("click", () => {
        const clanID = cwlInputClanCode.value;
        const playerAmount = selectAmountPlayers.value;
        document.querySelectorAll(".overlay").forEach(overlay =>
            overlay.classList.add("hidden"));
        if(clanID !== ""){
            getClanInfoRequest(clanID).then(data => createClanCard(data, playerAmount));
        }
        cwlInputClanCode.value = ""
    })
}

function savePlanButton(){
    savePlanBtn.addEventListener("click", () => {
        if(planName.value === ""){
            // make indicator
        }else{
            conf.setCanAutosave(true);
            savePlan();
        }
    });
}

function overlayHide(){
    document.querySelectorAll(".overlay").forEach(overlay =>
        overlay.addEventListener("click", () => overlay.classList.add("hidden")));
    document.querySelectorAll(".overlay-container").forEach(overlayContainer => {
        overlayContainer.addEventListener("click", (e) => {e.stopPropagation()})
    })
}

function guessCwlSize(){
    cwlInputClanCode.addEventListener("input", (event) => {
        getClanInfoRequest(event.target.value).then(data => {
            const league = data.warLeague.name;

            switch (league) {
                case "Champion League I":
                case "Champion League II":
                case "Champion League III":
                    selectAmountPlayers.remove(1);
            }
        })
    })
}

export function savePlan(){
    if (isLoading || !canAutosave) return;
    const allClansData = []
    const noClan = []
    availablePlayers.querySelectorAll(".cwl-player-article").forEach(player => {
        noClan.push(player.querySelector(".cwl-player-hashtag").textContent)
    })

    const noClanData = {
        clanTag: "none",
        players: noClan
    }

    allClansData.push(noClanData);

    allClans.querySelectorAll(".cwl-clan-article").forEach(clan => {
        const clanName = clan.querySelector(".cwl-clan-name").textContent
        const clanTag = localStorage.getItem("clanId_" + clanName)
        const amountOfPlayers = clan.querySelector(".cwl-amount-of-players-in-clan").textContent.split("/")[1]
        const allPlayersInClan = []
        clan.querySelectorAll(".cwl-player-article").forEach(player => {
            allPlayersInClan.push(player.querySelector(".cwl-player-hashtag").textContent)
        })
        const data = {
            clantag: clanTag,
            amountOfPlayers: amountOfPlayers,
            uuid: clan.id.split("_").at(-1),
            players: allPlayersInClan
        }

        allClansData.push(data)
    })
    let name = planName.value
    if(name === ""){
        name = "nameless"
    }
    const data = {
        id: localStorage.getItem("id"),
        currentPlanId: localStorage.getItem("planner_id"),
        name: name,
        clans: allClansData
    }
    const path = conf._BASE_URL + conf._EXT_SUPA_CWLPLANNER_DATA_SET
    databaseRequestWithBody(path, data).then(data => {
        localStorage.setItem("planner_id", data.uuid)
    })
}

function loadAllPlans(){
    const path = conf._BASE_URL + conf._EXT_SUPA_CWLPLANNER_DATA_GET_ALL
    const data = {user: localStorage.getItem("id")}
    databaseRequestWithBody(path, data).then(data => {
        data.forEach(plan => {
            let newOption = document.createElement("option");
            newOption.value = plan
            newOption.textContent = plan
            loadPlan.appendChild(newOption)
        })
        loadPlan.selectedIndex = -1;
    })
}

function loadPlanListener(){
    loadPlan.addEventListener("change", (e) => {
        const path = conf._BASE_URL + conf._EXT_SUPA_CWLPLANNER_DATA_GET
        const data = {name: e.target.value}
        databaseRequestWithBody(path, data).then(data => {
            availablePlayers.innerHTML = ""
            allClans.innerHTML = ""
            totalPlayerAmount.innerHTML = "0"
            planName.value = data.name
            localStorage.setItem("planner_id", data.id)
            conf.setCanAutosave(true)
            const playersWithClan = data.info

            const clansToLoad = playersWithClan.slice(1);
            let pending = playersWithClan[0].players.length + clansToLoad.reduce((acc, clan) => acc + clan.players.length, 0);

            setLoading(true);
            if(pending === 0) setLoading(false);

            playersWithClan[0].players.forEach(player => {
                getPlayerWithBattleData(player).then(data => {
                    createPlayerCard(data, null);
                    if(--pending === 0) setLoading(false);
                });
            })

            clansToLoad.forEach(clan => {
                getClanInfoRequest(clan.clantag).then(data => {
                    createClanCard(data, clan.amountOfPlayers, clan.uuid)
                    clan.players.forEach(player => {
                        getPlayerWithBattleData(player).then(data => {
                            createPlayerCard(data, clan.uuid);
                            if(--pending === 0) setLoading(false);
                        });
                    })
                });
            })
        })
    })
}

function loadPreviewData(groupId){
    path = conf._BASE_URL + conf._EXT_SUPA_GROUP_MEMBERS
    data = {id: groupId}
    databaseRequestWithBody(path, data).then(groupMembers => {
        groupMembers.forEach(member => {
            console.log(member)
            path = conf._BASE_URL + conf._EXT_SUPA_USER_BASES
            data = {id: member.user_id}
            console.log(data)
            databaseRequestWithBody(path, data).then(userBases => {
                console.log(userBases)
                if(userBases[0].accounts === null) return
                 createPlayerCard(userBases[0].accounts, "group");
            })
        })
    })
}

init();