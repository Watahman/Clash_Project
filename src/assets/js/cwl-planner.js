import { getClanMembersWithBattleData, getPlayerWithBattleData } from "./API/API-Functions.js"
import { getClanInfoRequest } from "./API/API-Clan.js"
import { createPlayerCard, createClanCard } from "./Templates.js";
import { databaseRequest } from "./API/API-Communication.js";
import * as conf from "./Data/config.js"


function init(){
    overlayHide();
    addClanPlayersButton();
    addPlayerButton()
    addClanButton();
    savePlanButton();
    guessCwlSize()
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
            const allPlayersInClan = []
            clan.querySelectorAll(".cwl-player-article").forEach(player => {
                allPlayersInClan.push(player.querySelector(".cwl-player-hashtag").textContent)
            })
            const data = {
                clantag: clanTag,
                players: allPlayersInClan
            }

            allClans.push(data)
        })
        const planName = document.querySelector("#cwl-plan-name").textContent
        const data = {
            id: localStorage.getItem("id"),
            name: planName,
            clans: allClans
        }
        console.log(data)
        const path = conf._BASE_URL + conf._EXT_SUPA_CWLPLANNER_DATA_SET
        databaseRequest(path, data).then(data => {
            console.log(data)
        })
    })
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

init();