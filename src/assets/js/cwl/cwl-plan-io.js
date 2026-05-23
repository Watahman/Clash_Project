import { canAutosave, isLoading, setLoading, setCanAutosave } from "../Data/config.js";
import { getClanInfoRequest } from "../API/API-Clan.js";
import { getPlayerWithBattleData } from "../API/API-Functions.js";
import { createPlayerCard, createClanCard } from "../templates/CWLTemplates.js";
import { getAllPlansFromDatabase, getPlanFromDatabase, setPlanToDatabase } from "../Supabase/Supabase-Plan.js";
import { getCurrentUserId } from "../utils/user.js";

let availablePlayers, allClans, totalPlayerAmount, planName, loadPlan;

export function initPlanIO(refs) {
    availablePlayers  = refs.availablePlayers;
    allClans          = refs.allClans;
    totalPlayerAmount = refs.totalPlayerAmount;
    planName          = refs.planName;
    loadPlan          = refs.loadPlan;
}

export function savePlan() {
    if (isLoading || !canAutosave) return;

    const allClansData = [];
    const noClan = [];

    availablePlayers.querySelectorAll(".cwl-player-article").forEach(player => {
        noClan.push(player.querySelector(".cwl-player-hashtag").textContent);
    });
    allClansData.push({ clanTag: "none", players: noClan });

    allClans.querySelectorAll(".cwl-clan-article").forEach(clan => {
        const clanName = clan.querySelector(".cwl-clan-name").textContent;
        const clanTag = localStorage.getItem("clanId_" + clanName);
        const amountOfPlayers = clan.querySelector(".cwl-amount-of-players-in-clan").textContent.split("/")[1];
        const allPlayersInClan = [];
        clan.querySelectorAll(".cwl-player-article").forEach(player => {
            allPlayersInClan.push(player.querySelector(".cwl-player-hashtag").textContent);
        });
        allClansData.push({
            clantag: clanTag,
            amountOfPlayers: amountOfPlayers,
            uuid: clan.id.split("_").at(-1),
            players: allPlayersInClan
        });
    });

    let name = planName.value || "nameless";
    setPlanToDatabase(getCurrentUserId(), localStorage.getItem("planner_id"), name, allClansData)
        .then(data => { localStorage.setItem("planner_id", data.uuid); });
}

export function loadAllPlans() {
    getAllPlansFromDatabase(getCurrentUserId()).then(data => {
        data.forEach(plan => {
            let newOption = document.createElement("option");
            newOption.value = plan;
            newOption.textContent = plan;
            loadPlan.appendChild(newOption);
        });
        loadPlan.selectedIndex = -1;
    });
}

export function loadPlanListener() {
    loadPlan.addEventListener("change", (e) => {
        getPlanFromDatabase(e.target.value).then(data => {
            availablePlayers.innerHTML = "";
            allClans.innerHTML = "";
            totalPlayerAmount.innerHTML = "0";
            planName.value = data.name;
            localStorage.setItem("planner_id", data.id);
            setCanAutosave(true);

            const playersWithClan = data.info;
            const clansToLoad = playersWithClan.slice(1);
            let pending = playersWithClan[0].players.length + clansToLoad.reduce((acc, clan) => acc + clan.players.length, 0);

            setLoading(true);
            if (pending === 0) setLoading(false);

            playersWithClan[0].players.forEach(player => {
                getPlayerWithBattleData(player).then(data => {
                    createPlayerCard(data, null);
                    if (--pending === 0) setLoading(false);
                });
            });

            clansToLoad.forEach(clan => {
                getClanInfoRequest(clan.clantag).then(data => {
                    createClanCard(data, clan.amountOfPlayers, clan.uuid);
                    clan.players.forEach(player => {
                        getPlayerWithBattleData(player).then(data => {
                            createPlayerCard(data, clan.uuid);
                            if (--pending === 0) setLoading(false);
                        });
                    });
                });
            });
        });
    });
}
