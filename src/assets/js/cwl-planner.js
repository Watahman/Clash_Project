import { getClanMembersWithBattleData, getPlayerWithBattleData } from "./API/API-Functions.js"
import { getClanInfoRequest } from "./API/API-Clan.js"
import { createPlayerCard, createClanCard } from "./Templates.js";
import {databaseRequest, databaseRequestWithBody} from "./API/API-Communication.js";
import * as conf from "./Data/config.js"
import {canAutosave, isLoading, setLoading} from "./Data/config.js";

function init(){
    overlayHide();
    addClanPlayersButton();
    addPlayerButton()
    addClanButton();
    savePlanButton();
    guessCwlSize()
    loadAllPlans()
    loadPlan()
    localStorage.setItem("planner_id", "")
}

function addClanPlayersButton(){
    document.querySelector("#cwl-add-clan-players-button").addEventListener("click", () => {
        document.querySelector("#cwl-overlay-add-players").classList.remove("hidden");
    })
    document.querySelector("#cwl-overlay-add-players-button").addEventListener("click", () => {
        const clanTag = document.querySelector("#cwl-input-tag").value;
        document.querySelectorAll(".overlay").forEach(overlay =>
            overlay.classList.add("hidden"));
        if(clanTag !== ""){
            getClanMembersWithBattleData(clanTag, (data) => {createPlayerCard(data)});
        }
    });
}

function addPlayerButton(){
    document.querySelector("#cwl-add-player-button").addEventListener("click", () => {
        document.querySelector("#cwl-overlay-add-players").classList.remove("hidden");
    })
    document.querySelector("#cwl-overlay-add-players-button").addEventListener("click", () => {
        const playerTag = document.querySelector("#cwl-input-tag").value;
        document.querySelectorAll(".overlay").forEach(overlay =>
            overlay.classList.add("hidden"));
        if(playerTag !== ""){
            console.log(playerTag);
            getPlayerWithBattleData(playerTag, (data) => {createPlayerCard(data)});
        }
    });
}

function addClanButton(){
    document.querySelector("#cwl-add-clan-button").addEventListener("click", () => {
        document.querySelector("#cwl-overlay-add-clan").classList.remove("hidden")
        const option = document.querySelector("#cwl-overlay-select-amount-players-in-clan option[value=\"30\"]")
        if(!option){
            let newOption = document.createElement("option");
            newOption.value = 30;
            newOption.textContent = "30v30";
            document.querySelector("#cwl-overlay-select-amount-players-in-clan").appendChild(newOption);
        }
    })
    document.querySelector("#cwl-overlay-add-clan-button").addEventListener("click", () => {
        const clanID = document.querySelector("#cwl-input-clan-clancode").value;
        const playerAmount = document.querySelector("#cwl-overlay-select-amount-players-in-clan").value;
        document.querySelectorAll(".overlay").forEach(overlay =>
            overlay.classList.add("hidden"));
        if(clanID !== ""){
            getClanInfoRequest(clanID, (data) => {createClanCard(data, playerAmount)});
        }

        document.querySelector("#cwl-input-clan-clancode").value = ""
    })
}

function savePlanButton(){
    document.querySelector("#cwl-save-plan-button").addEventListener("click", () => {
        if(document.querySelector("#cwl-plan-name").value === ""){
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
    document.querySelector("#cwl-input-clan-clancode").addEventListener("input", (event) => {
        let league;
        getClanInfoRequest(event.target.value, (data) => {
            league = data.warLeague.name

            switch (league) {
                case "Champion League I":
                case "Champion League II":
                case "Champion League III":
                    document.querySelector("#cwl-overlay-select-amount-players-in-clan").remove(1);
            }
            console.log(league)
        })
    })
}

export function savePlan(){
    if (isLoading || !canAutosave) return;
    const allClans = []
    const noClan = []
    document.querySelector("#cwl-available-players").querySelectorAll(".cwl-player-article").forEach(player => {
        noClan.push(player.querySelector(".cwl-player-hashtag").textContent)
    })

    const noClanData = {
        clanTag: "none",
        players: noClan
    }

    allClans.push(noClanData);

    document.querySelectorAll(".cwl-clan-article").forEach(clan => {
        const clanName = clan.querySelector(".cwl-clan-name").textContent
        const clanTag = localStorage.getItem("clanId_" + clanName)
        console.log(clan.querySelector(".cwl-amount-of-players-in-clan").textContent)
        console.log(clan.querySelector(".cwl-amount-of-players-in-clan").textContent.split("/"))
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

        console.log(data)

        allClans.push(data)
    })
    const planName = document.querySelector("#cwl-plan-name").value
    const data = {
        id: localStorage.getItem("id"),
        currentPlanId: localStorage.getItem("planner_id"),
        name: planName,
        clans: allClans
    }
    const path = conf._BASE_URL + conf._EXT_SUPA_CWLPLANNER_DATA_SET
    databaseRequestWithBody(path, data).then(data => {
        localStorage.setItem("planner_id", data.uuid)
    })

    console.log("done")
}

function loadAllPlans(){
    const planSelect = document.querySelector("#cwl-load-plan")
    const path = conf._BASE_URL + conf._EXT_SUPA_CWLPLANNER_DATA_GET_ALL
    const data = {user: localStorage.getItem("id")}
    databaseRequestWithBody(path, data).then(data => {
        data.forEach(plan => {
            let newOption = document.createElement("option");
            newOption.value = plan
            newOption.textContent = plan
            planSelect.appendChild(newOption)
        })
        planSelect.selectedIndex = -1;
    })
}

function loadPlan(){
    const planSelect = document.querySelector("#cwl-load-plan")
    planSelect.addEventListener("change", (e) => {
        const path = conf._BASE_URL + conf._EXT_SUPA_CWLPLANNER_DATA_GET
        const data = {name: e.target.value}
        databaseRequestWithBody(path, data).then(data => {
            document.querySelector("#cwl-available-players").innerHTML = ""
            document.querySelector("#cwl-all-clans").innerHTML = ""
            document.querySelector("#cwl-total-player-amount").innerHTML = "0"
            document.querySelector("#cwl-plan-name").value = data.name
            localStorage.setItem("planner_id", data.id)
            conf.setCanAutosave(true)
            const playersWithClan = data.info

            const clansToLoad = playersWithClan.slice(1);
            let pending = playersWithClan[0].players.length + clansToLoad.reduce((acc, clan) => acc + clan.players.length, 0);

            setLoading(true);
            if(pending === 0) setLoading(false);

            playersWithClan[0].players.forEach(player => {
                getPlayerWithBattleData(player, (data) => {
                    createPlayerCard(data, null);
                    if(--pending === 0) setLoading(false);
                });
            })

            clansToLoad.forEach(clan => {
                getClanInfoRequest(clan.clantag, (data) => {
                    createClanCard(data, clan.amountOfPlayers, clan.uuid)
                    clan.players.forEach(player => {
                        getPlayerWithBattleData(player, (data) => {
                            createPlayerCard(data, clan.uuid);
                            if(--pending === 0) setLoading(false);
                        });
                    })
                });
            })
        })
    })
}

init();