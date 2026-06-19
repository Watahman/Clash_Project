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
    const userId = getCurrentUserId();
    if (isLoading || !canAutosave || !userId) return;

    const allClansData = [];
    const noClan = [];

    availablePlayers.querySelectorAll(".cwl-player-article").forEach(player => {
        noClan.push(player.querySelector(".cwl-player-hashtag").textContent);
    });
    allClansData.push({ clanTag: "none", clantag: "none", players: noClan });

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
            clanTag: clanTag,
            amountOfPlayers: amountOfPlayers,
            uuid: clan.id.split("_").at(-1),
            players: allPlayersInClan
        });
    });

    const name = planName.value.trim() || "nameless";
    setPlanToDatabase(userId, localStorage.getItem("planner_id"), name, allClansData)
        .then(data => {
            if (data?.uuid) {
                localStorage.setItem("planner_id", data.uuid);
                upsertPlanOption(data.uuid, name);
            }
        })
        .catch(error => console.error(error));
}

export function loadAllPlans() {
    const userId = getCurrentUserId();
    loadPlan.replaceChildren();
    if (!userId) {
        loadPlan.disabled = true;
        return;
    }

    loadPlan.disabled = false;
    getAllPlansFromDatabase(userId).then(data => {
        if (!Array.isArray(data)) return;
        data.forEach(plan => {
            const option = document.createElement("option");
            if (typeof plan === "string") {
                option.value = plan;
                option.textContent = plan;
            } else {
                option.value = plan.id;
                option.textContent = plan.name || "Naamloos plan";
            }
            loadPlan.appendChild(option);
        });
        loadPlan.selectedIndex = -1;
    }).catch(error => console.error(error));
}

export function loadPlanListener() {
    loadPlan.addEventListener("change", (e) => {
        const planId = e.target.value;
        if (!planId) return;
        getPlanFromDatabase(planId).then(data => {
            if (!data || data.error) {
                console.error(data?.error || "Plan laden mislukt");
                return;
            }
            availablePlayers.innerHTML = "";
            allClans.innerHTML = "";
            totalPlayerAmount.textContent = "0";
            planName.value = data.name || "";
            localStorage.setItem("planner_id", data.id || planId);
            setCanAutosave(true);

            const playersWithClan = Array.isArray(data.info) ? data.info : [];
            if (playersWithClan.length === 0) return;
            const freePlayers = playersWithClan[0]?.players || [];
            const clansToLoad = playersWithClan.slice(1);
            let pending = freePlayers.length + clansToLoad.reduce((acc, clan) => acc + (clan.players?.length || 0), 0);

            setLoading(true);
            if (pending === 0) setLoading(false);

            freePlayers.forEach(player => {
                getPlayerWithBattleData(player).then(data => {
                    createPlayerCard(data, null);
                    if (--pending === 0) setLoading(false);
                }).catch(error => { console.error(error); if (--pending === 0) setLoading(false); });
            });

            clansToLoad.forEach(clan => {
                const clanTag = clan.clantag || clan.clanTag;
                if (!clanTag) return;
                getClanInfoRequest(clanTag).then(data => {
                    createClanCard(data, clan.amountOfPlayers, clan.uuid);
                    (clan.players || []).forEach(player => {
                        getPlayerWithBattleData(player).then(data => {
                            createPlayerCard(data, clan.uuid);
                            if (--pending === 0) setLoading(false);
                        }).catch(error => { console.error(error); if (--pending === 0) setLoading(false); });
                    });
                }).catch(error => console.error(error));
            });
        }).catch(error => console.error(error));
    });
}

function upsertPlanOption(planId, name) {
    let option = Array.from(loadPlan.options).find(opt => opt.value === planId);
    if (!option) {
        option = document.createElement("option");
        option.value = planId;
        loadPlan.appendChild(option);
    }
    option.textContent = name;
    loadPlan.value = planId;
}
