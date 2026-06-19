import { canAutosave, isLoading, setLoading, setCanAutosave } from "../Data/config.js";
import { getClanInfoRequest } from "../API/API-Clan.js";
import { getPlayerWithBattleData } from "../API/API-Functions.js";
import { createPlayerCard, createClanCard } from "../templates/CWLTemplates.js";
import { getAllPlansFromDatabase, getPlanFromDatabase, setPlanToDatabase } from "../Supabase/Supabase-Plan.js";
import { getCurrentUserId } from "../utils/user.js";
import { t } from "../i18n/i18n.js";

let availablePlayers, allClans, totalPlayerAmount, planName, loadPlan, saveStatus;
const planCache = new Map();
let saveTimer;

export function initPlanIO(refs) {
    availablePlayers  = refs.availablePlayers;
    allClans          = refs.allClans;
    totalPlayerAmount = refs.totalPlayerAmount;
    planName          = refs.planName;
    loadPlan          = refs.loadPlan;
    saveStatus        = document.querySelector('#cwl-save-status');
    setSaveStatus('idle');
}

function setSaveStatus(state) {
    if (!saveStatus) return;
    saveStatus.dataset.state = state;
    const key = state === 'saving' ? 'cwl.saving' : state === 'error' ? 'cwl.saveError' : 'cwl.saved';
    saveStatus.textContent = t(key);
}

function serializePlan() {
    const allClansData = [];
    const noClan = [];
    const plannerPlayers = [];

    availablePlayers.querySelectorAll('.cwl-player-article').forEach(player => {
        const tag = player.querySelector('.cwl-player-hashtag')?.textContent?.trim();
        if (!tag) return;
        noClan.push(tag);
        plannerPlayers.push(readPlayerCard(player));
    });
    allClansData.push({ clanTag: 'none', clantag: 'none', players: noClan });

    allClans.querySelectorAll('.cwl-clan-article').forEach(clan => {
        const clanName = clan.querySelector('.cwl-clan-name')?.textContent || '';
        const clanTag = localStorage.getItem('clanId_' + clanName) || clan.dataset.clanTag || '';
        const amountOfPlayers = clan.querySelector('.cwl-amount-of-players-in-clan')?.textContent?.split('/')[1] || '15';
        const allPlayersInClan = [];
        clan.querySelectorAll('.cwl-player-article').forEach(player => {
            const tag = player.querySelector('.cwl-player-hashtag')?.textContent?.trim();
            if (!tag) return;
            allPlayersInClan.push(tag);
            plannerPlayers.push(readPlayerCard(player));
        });
        allClansData.push({
            clantag: clanTag,
            clanTag: clanTag,
            amountOfPlayers: amountOfPlayers,
            uuid: clan.id.split('_').at(-1),
            players: allPlayersInClan
        });
    });

    localStorage.setItem('clashtools_last_planner_players', JSON.stringify(plannerPlayers));
    return allClansData;
}

function readPlayerCard(player) {
    const img = player.querySelector('.cwl-player-townhall-foto')?.getAttribute('src') || '';
    const match = img.match(/Town_Hall(\d+)\.png/i);
    return {
        name: player.querySelector('.cwl-player-name')?.textContent || '',
        clanName: player.querySelector('.cwl-player-clan')?.textContent || '',
        tag: player.querySelector('.cwl-player-hashtag')?.textContent || '',
        townHall: match ? Number(match[1]) : 1
    };
}

export function savePlan() {
    const userId = getCurrentUserId();
    if (isLoading || !canAutosave || !userId) return Promise.resolve(null);

    const allClansData = serializePlan();
    const name = planName.value.trim() || 'nameless';
    setSaveStatus('saving');
    clearTimeout(saveTimer);

    return setPlanToDatabase(userId, localStorage.getItem('planner_id'), name, allClansData)
        .then(data => {
            if (data?.uuid) {
                localStorage.setItem('planner_id', data.uuid);
                const cached = { id: data.uuid, name, info: allClansData };
                planCache.set(data.uuid, cached);
                upsertPlanOption(data.uuid, name);
            }
            saveTimer = setTimeout(() => setSaveStatus('idle'), 250);
            return data;
        })
        .catch(error => {
            console.error(error);
            setSaveStatus('error');
            return null;
        });
}

export function loadAllPlans() {
    const userId = getCurrentUserId();
    loadPlan.replaceChildren();
    planCache.clear();

    if (!userId) {
        loadPlan.disabled = true;
        const option = document.createElement('option');
        option.value = '';
        option.textContent = t('cwl.noPlan');
        loadPlan.appendChild(option);
        return;
    }

    loadPlan.disabled = false;
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = t('cwl.selectPlan');
    loadPlan.appendChild(placeholder);

    getAllPlansFromDatabase(userId).then(data => {
        if (!Array.isArray(data) || data.length === 0) {
            placeholder.textContent = t('cwl.noPlan');
            return;
        }
        placeholder.textContent = t('cwl.selectPlan');
        data.forEach(plan => {
            const normalized = typeof plan === 'string' ? { id: plan, name: plan } : plan;
            if (!normalized?.id) return;
            planCache.set(normalized.id, normalized);
            const option = document.createElement('option');
            option.value = normalized.id;
            option.textContent = normalized.name || 'Naamloos plan';
            loadPlan.appendChild(option);
        });
        loadPlan.value = '';
    }).catch(error => {
        console.error(error);
        placeholder.textContent = t('cwl.noPlan');
    });
}

export function loadPlanListener() {
    loadPlan.addEventListener('change', (e) => {
        const planId = e.target.value;
        if (!planId) return;

        const currentId = localStorage.getItem('planner_id');
        const shouldSaveCurrent = currentId && currentId !== planId && canAutosave && !isLoading;
        const loadNext = () => loadPlanById(planId);
        if (shouldSaveCurrent) savePlan().then(loadNext);
        else loadNext();
    });
}

function loadPlanById(planId) {
    const cached = planCache.get(planId);
    const loadPromise = cached?.info ? Promise.resolve(cached) : getPlanFromDatabase(planId);

    loadPromise.then(data => {
        if (!data || data.error) {
            console.error(data?.error || 'Plan laden mislukt');
            setSaveStatus('error');
            return;
        }
        if (data.id) planCache.set(data.id, data);
        renderLoadedPlan(data, planId);
    }).catch(error => {
        console.error(error);
        setSaveStatus('error');
    });
}

function renderLoadedPlan(data, planId) {
    setLoading(true);
    setCanAutosave(false);
    availablePlayers.innerHTML = '';
    allClans.innerHTML = '';
    totalPlayerAmount.textContent = '0';
    planName.value = data.name || '';
    localStorage.setItem('planner_id', data.id || planId);
    setSaveStatus('idle');

    const playersWithClan = Array.isArray(data.info) ? data.info : [];
    if (playersWithClan.length === 0) {
        setLoading(false);
        setCanAutosave(true);
        return;
    }

    const freePlayers = playersWithClan[0]?.players || [];
    const clansToLoad = playersWithClan.slice(1);
    let pending = freePlayers.length + clansToLoad.length + clansToLoad.reduce((acc, clan) => acc + (clan.players?.length || 0), 0);
    const done = () => {
        pending -= 1;
        if (pending <= 0) {
            setLoading(false);
            setCanAutosave(true);
            serializePlan();
        }
    };
    if (pending === 0) done();

    freePlayers.forEach(player => {
        getPlayerWithBattleData(player)
            .then(playerData => createPlayerCard(playerData, null))
            .catch(error => console.error(error))
            .finally(done);
    });

    clansToLoad.forEach(clan => {
        const clanTag = clan.clantag || clan.clanTag;
        if (!clanTag) { done(); return; }
        getClanInfoRequest(clanTag).then(clanData => {
            createClanCard(clanData, clan.amountOfPlayers, clan.uuid);
            done();
            const players = clan.players || [];
            if (players.length === 0) return;
            players.forEach(player => {
                getPlayerWithBattleData(player)
                    .then(playerData => createPlayerCard(playerData, clan.uuid))
                    .catch(error => console.error(error))
                    .finally(done);
            });
        }).catch(error => {
            console.error(error);
            done();
            (clan.players || []).forEach(() => done());
        });
    });
}

function upsertPlanOption(planId, name) {
    let option = Array.from(loadPlan.options).find(opt => opt.value === planId);
    if (!option) {
        option = document.createElement('option');
        option.value = planId;
        loadPlan.appendChild(option);
    }
    option.textContent = name;
    loadPlan.value = planId;
}
