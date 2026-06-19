import { canAutosave, isLoading, setLoading, setCanAutosave } from "../Data/config.js";
import { getClanInfoRequest } from "../API/API-Clan.js";
import { getPlayerWithBattleData } from "../API/API-Functions.js";
import { createPlayerCard, createClanCard } from "../templates/CWLTemplates.js";
import { getAllPlansFromDatabase, getPlanFromDatabase, setPlanToDatabase } from "../Supabase/Supabase-Plan.js";
import { getCurrentUserId } from "../utils/user.js";
import { t } from "../i18n/i18n.js";

let availablePlayers, allClans, totalPlayerAmount, planName, loadPlan, saveStatus;
const planCache = new Map();
const fullPlanPromises = new Map();
let saveTimer;
let activeLoadToken = 0;
let suppressSave = false;

export function initPlanIO(refs) {
    availablePlayers  = refs.availablePlayers;
    allClans          = refs.allClans;
    totalPlayerAmount = refs.totalPlayerAmount;
    planName          = refs.planName;
    loadPlan          = refs.loadPlan;
    saveStatus        = document.querySelector('#cwl-save-status');
    setSaveStatus('idle');
}
function normalizePlan(plan) {
    if (!plan) return null;
    if (typeof plan === 'string') return { id: plan, uuid: plan, name: plan, info: null };
    const id = plan.id || plan.uuid || plan.planId;
    if (!id) return null;
    return { ...plan, id, uuid: plan.uuid || id, name: plan.name || plan.plan_name || 'Naamloos plan', info: Array.isArray(plan.info) ? plan.info : Array.isArray(plan.planInfo) ? plan.planInfo : null };
}
function setSaveStatus(state) {
    if (!saveStatus) return;
    saveStatus.dataset.state = state;
    saveStatus.textContent = t(state === 'saving' ? 'cwl.saving' : state === 'error' ? 'cwl.saveError' : 'cwl.saved');
}
function readPlayerCard(player) {
    const match=(player.querySelector('.cwl-player-townhall-foto')?.getAttribute('src')||'').match(/Town_Hall(\d+)\.png/i);
    return { name: player.querySelector('.cwl-player-name')?.textContent || '', clanName: player.querySelector('.cwl-player-clan')?.textContent || '', tag: player.querySelector('.cwl-player-hashtag')?.textContent || '', townHall: match ? Number(match[1]) : 1 };
}
function serializePlan() {
    const allClansData=[]; const noClan=[]; const plannerPlayers=[];
    availablePlayers.querySelectorAll('.cwl-player-article').forEach(player=>{ const tag=player.querySelector('.cwl-player-hashtag')?.textContent?.trim(); if(!tag)return; noClan.push(tag); plannerPlayers.push(readPlayerCard(player)); });
    allClansData.push({ clanTag:'none', clantag:'none', players:noClan });
    allClans.querySelectorAll('.cwl-clan-article').forEach(clan=>{ const clanName=clan.querySelector('.cwl-clan-name')?.textContent||''; const clanTag=localStorage.getItem('clanId_'+clanName)||clan.dataset.clanTag||''; const amountOfPlayers=clan.querySelector('.cwl-amount-of-players-in-clan')?.textContent?.split('/')[1]||'15'; const allPlayersInClan=[]; clan.querySelectorAll('.cwl-player-article').forEach(player=>{ const tag=player.querySelector('.cwl-player-hashtag')?.textContent?.trim(); if(!tag)return; allPlayersInClan.push(tag); plannerPlayers.push(readPlayerCard(player)); }); allClansData.push({ clantag:clanTag, clanTag, amountOfPlayers, uuid: clan.id.split('_').at(-1), players: allPlayersInClan }); });
    localStorage.setItem('clashtools_last_planner_players', JSON.stringify(plannerPlayers));
    return allClansData;
}
export function savePlan() {
    const userId=getCurrentUserId();
    if (isLoading || suppressSave || !canAutosave || !userId) return Promise.resolve(null);
    const allClansData=serializePlan(); const name=planName.value.trim()||'nameless';
    setSaveStatus('saving'); clearTimeout(saveTimer);
    return setPlanToDatabase(userId, localStorage.getItem('planner_id'), name, allClansData).then(data=>{ const id=data?.uuid||data?.id||localStorage.getItem('planner_id'); if(id){ localStorage.setItem('planner_id', id); const cached={ id, uuid:id, name, info:allClansData }; planCache.set(id,cached); fullPlanPromises.set(id,Promise.resolve(cached)); upsertPlanOption(id,name); localStorage.setItem('clashtools_planner_cache', JSON.stringify(Array.from(planCache.values()))); } saveTimer=setTimeout(()=>setSaveStatus('idle'),250); return data; }).catch(error=>{ console.error(error); setSaveStatus('error'); return null; });
}
export function loadAllPlans() {
    const userId=getCurrentUserId(); loadPlan.replaceChildren(); planCache.clear(); fullPlanPromises.clear();
    if(!userId){ loadPlan.disabled=true; loadPlan.appendChild(option('', t('cwl.noPlan'))); return Promise.resolve([]); }
    loadPlan.disabled=false; loadPlan.appendChild(option('', t('cwl.loadingPlans')));
    return getAllPlansFromDatabase(userId).then(data=>{ const plans=Array.isArray(data)?data.map(normalizePlan).filter(Boolean):[]; loadPlan.replaceChildren(option('', plans.length?t('cwl.selectPlan'):t('cwl.noPlan'))); plans.forEach(plan=>{ planCache.set(plan.id,plan); loadPlan.appendChild(option(plan.id,plan.name)); }); localStorage.setItem('clashtools_planner_cache', JSON.stringify(plans)); prefetchFullPlans(plans); return plans; }).catch(error=>{ console.error(error); loadPlan.replaceChildren(option('',t('cwl.noPlan'))); return []; });
}
function prefetchFullPlans(plans){ plans.forEach(plan=>{ if(plan.info){ fullPlanPromises.set(plan.id,Promise.resolve(plan)); return; } const promise=getPlanFromDatabase(plan.id).then(data=>{ const full=normalizePlan(data)||plan; const merged={...plan,...full,id:full.id||plan.id}; planCache.set(merged.id,merged); return merged; }).catch(error=>{ console.error(error); return plan; }); fullPlanPromises.set(plan.id,promise); }); }
export function loadPlanListener(){ loadPlan.addEventListener('change',e=>{ const planId=e.target.value; if(planId) loadPlanById(planId); }); }
function loadPlanById(planId){ const token=++activeLoadToken; suppressSave=true; setCanAutosave(false); setLoading(true); setSaveStatus('idle'); const cached=planCache.get(planId); const loadPromise=cached?.info?Promise.resolve(cached):(fullPlanPromises.get(planId)||getPlanFromDatabase(planId).then(normalizePlan)); loadPromise.then(data=>{ if(token!==activeLoadToken)return; const normalized=normalizePlan(data); if(!normalized) throw new Error('Ongeldig plan'); planCache.set(normalized.id,normalized); return renderLoadedPlan(normalized,normalized.id,token); }).catch(error=>{ if(token!==activeLoadToken)return; console.error(error); setSaveStatus('error'); }).finally(()=>{ if(token!==activeLoadToken)return; setLoading(false); setCanAutosave(true); suppressSave=false; window.dispatchEvent(new CustomEvent('clashtools:cwl-plan-loaded')); }); }
function renderLoadedPlan(data,planId,token){ availablePlayers.innerHTML=''; allClans.innerHTML=''; totalPlayerAmount.textContent='0'; planName.value=data.name||''; localStorage.setItem('planner_id',data.id||planId); const info=Array.isArray(data.info)?data.info:[]; const freePlayers=info[0]?.players||[]; const clansToLoad=info.slice(1); const tasks=[]; freePlayers.forEach(playerTag=>tasks.push(getPlayerWithBattleData(playerTag).then(playerData=>{ if(token===activeLoadToken) createPlayerCard(playerData,null); }).catch(console.error))); clansToLoad.forEach(clan=>{ const clanTag=clan.clantag||clan.clanTag; if(!clanTag)return; tasks.push(getClanInfoRequest(clanTag).then(clanData=>{ if(token!==activeLoadToken)return; createClanCard(clanData,clan.amountOfPlayers,clan.uuid); return Promise.allSettled((clan.players||[]).map(playerTag=>getPlayerWithBattleData(playerTag).then(playerData=>{ if(token===activeLoadToken) createPlayerCard(playerData,clan.uuid); }).catch(console.error))); }).catch(console.error)); }); return Promise.allSettled(tasks).then(()=>{ if(token===activeLoadToken) serializePlan(); }); }
function upsertPlanOption(planId,name){ let opt=Array.from(loadPlan.options).find(o=>o.value===planId); if(!opt){ opt=option(planId,name); loadPlan.appendChild(opt); } opt.textContent=name; loadPlan.value=planId; }
function option(value,text){ const opt=document.createElement('option'); opt.value=value; opt.textContent=text; return opt; }
