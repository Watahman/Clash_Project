import { profileHTML } from '../profile/profile_popup.js';
import { initI18n, t } from '../i18n/i18n.js';
import { getCurrentUserId } from '../utils/user.js';
import { getAllPlansFromDatabase, getPlanFromDatabase } from '../Supabase/Supabase-Plan.js';
import { getClanInfoRequest, getClanMembersRequest, getClanCurrentWarRequest, getClanCurrentWarLeagueGroupRequest, getClanWarLeagueWarRequest } from '../API/API-Clan.js';

const refs = {};
const planCache = new Map();
let selectedPlan = null;
let selectedClan = null;
let latestReport = null;
let requestToken = 0;
let planSelectToken = 0;

function normalizeTag(tag = '') {
    const clean = String(tag).trim().toUpperCase();
    return clean.startsWith('#') ? clean : clean ? '#' + clean : '';
}
function lower(value = '') { return String(value || '').toLowerCase(); }
function normalizePlan(plan) {
    if (!plan) return null;
    if (typeof plan === 'string') return { id: plan, name: plan, info: null };
    const id = plan.id || plan.uuid || plan.planId;
    if (!id) return null;
    return { ...plan, id, name: plan.name || plan.plan_name || 'Naamloos plan', info: Array.isArray(plan.info) ? plan.info : Array.isArray(plan.planInfo) ? plan.planInfo : null };
}
function initRefs() {
    refs.planSelect = document.querySelector('#op-plan-select');
    refs.clanSelect = document.querySelector('#op-clan-select');
    refs.refresh = document.querySelector('#op-refresh');
    refs.exportBtn = document.querySelector('#op-export');
    refs.liveState = document.querySelector('#op-live-state');
    refs.phase = document.querySelector('#op-cwl-phase');
    refs.help = document.querySelector('#op-help');
    refs.totalStars = document.querySelector('#op-total-stars');
    refs.avgDestruction = document.querySelector('#op-avg-destruction');
    refs.attacksUsed = document.querySelector('#op-attacks-used');
    refs.missed = document.querySelector('#op-missed-attacks');
    refs.thList = document.querySelector('#op-th-list');
    refs.roundsList = document.querySelector('#op-rounds-list');
    refs.roundState = document.querySelector('#op-round-state');
    refs.rosterCount = document.querySelector('#op-roster-count');
    refs.rosterBody = document.querySelector('#op-roster-body');
    refs.rosterFilter = document.querySelector('#op-roster-filter');
    refs.rosterView = document.querySelector('#op-roster-view');
    refs.bonusList = document.querySelector('#op-bonus-list');
}
function setState(text, isError = false) { refs.liveState.textContent = text; refs.liveState.dataset.state = isError ? 'error' : text; }
function setHelp(text) { refs.help.textContent = text; }
function initEvents() {
    refs.planSelect.onchange = () => selectPlan(refs.planSelect.value);
    refs.clanSelect.onchange = () => selectClan(refs.clanSelect.value);
    refs.refresh.onclick = () => selectedClan && refreshClanReport(selectedClan);
    refs.rosterFilter.oninput = () => renderRoster();
    refs.rosterView.onchange = () => renderRoster();
    refs.exportBtn.onclick = () => exportReport();
}
function option(value, text) { const opt = document.createElement('option'); opt.value = value; opt.textContent = text; return opt; }
function loadPlans() {
    const userId = getCurrentUserId();
    refs.planSelect.replaceChildren(option('', userId ? t('op.loadingPlans') : t('groups.login')));
    refs.clanSelect.replaceChildren(option('', t('op.selectPlanFirst')));
    refs.clanSelect.disabled = true;
    if (!userId) return;
    getAllPlansFromDatabase(userId).then(plans => {
        const normalizedPlans = Array.isArray(plans) ? plans.map(normalizePlan).filter(Boolean) : [];
        refs.planSelect.replaceChildren(option('', normalizedPlans.length ? t('op.selectPlan') : t('cwl.noPlan')));
        normalizedPlans.forEach(plan => { planCache.set(plan.id, plan); refs.planSelect.appendChild(option(plan.id, plan.name)); });
        normalizedPlans.forEach(prefetchPlan);
    }).catch(error => { console.error(error); refs.planSelect.replaceChildren(option('', t('groups.loadError'))); });
}
function prefetchPlan(plan) {
    if (!plan) return Promise.resolve(null);
    if (plan.info) return Promise.resolve(plan);
    return getPlanFromDatabase(plan.id).then(full => {
        const normalized = normalizePlan(full) || plan;
        const merged = { ...plan, ...normalized };
        planCache.set(plan.id, merged);
        return merged;
    }).catch(error => { console.error(error); return plan; });
}
function selectPlan(planId) {
    const token = ++planSelectToken;
    selectedClan = null; latestReport = null;
    refs.clanSelect.disabled = true;
    refs.clanSelect.replaceChildren(option('', t('op.loadingClans')));
    clearReport();
    if (!planId) return;
    const plan = planCache.get(planId);
    prefetchPlan(plan).then(full => {
        if (token !== planSelectToken) return;
        selectedPlan = normalizePlan(full);
        renderClanSelector(selectedPlan);
    }).catch(error => {
        if (token !== planSelectToken) return;
        console.error(error);
        refs.clanSelect.replaceChildren(option('', t('groups.loadError')));
    });
}
function getPlanClans(plan) {
    const info = Array.isArray(plan?.info) ? plan.info : [];
    return info.slice(1).map((clan, index) => ({
        index,
        name: clan.name || clan.clanName || clan.clantag || clan.clanTag || `Clan ${index + 1}`,
        tag: normalizeTag(clan.clantag || clan.clanTag),
        players: Array.isArray(clan.players) ? clan.players.map(normalizeTag) : [],
        amountOfPlayers: Number(clan.amountOfPlayers || 15)
    })).filter(clan => clan.tag && clan.tag !== '#NONE');
}
function renderClanSelector(plan) {
    refs.clanSelect.replaceChildren(option('', t('op.selectClan')));
    const clans = getPlanClans(plan);
    clans.forEach(clan => refs.clanSelect.appendChild(option(clan.tag, clan.name || clan.tag)));
    refs.clanSelect.disabled = clans.length === 0;
    if (clans.length === 0) setHelp(t('op.noClansInPlan'));
}
function selectClan(clanTag) {
    selectedClan = getPlanClans(selectedPlan).find(clan => clan.tag === clanTag) || null;
    if (selectedClan) refreshClanReport(selectedClan);
}
async function refreshClanReport(clan) {
    const token = ++requestToken;
    setState('loading'); setHelp(t('op.loadingLive')); clearReport(false);
    try {
        const [clanInfo, membersData, leagueGroup, currentWar] = await Promise.allSettled([
            getClanInfoRequest(clan.tag),
            getClanMembersRequest(clan.tag),
            getClanCurrentWarLeagueGroupRequest(clan.tag),
            getClanCurrentWarRequest(clan.tag)
        ]);
        if (token !== requestToken) return;
        const report = {
            plan: selectedPlan,
            clan,
            clanInfo: clanInfo.status === 'fulfilled' ? clanInfo.value : null,
            members: membersData.status === 'fulfilled' && Array.isArray(membersData.value?.items) ? membersData.value.items : [],
            leagueGroup: leagueGroup.status === 'fulfilled' ? leagueGroup.value : null,
            currentWar: currentWar.status === 'fulfilled' ? currentWar.value : null,
            wars: [],
            phase: 'not_started_or_unavailable'
        };
        if (report.leagueGroup && !report.leagueGroup.error && Array.isArray(report.leagueGroup.rounds)) {
            report.phase = report.leagueGroup.state || 'active_or_recent';
            const warTags = report.leagueGroup.rounds.flatMap((round, roundIndex) => (round.warTags || []).map(warTag => ({ warTag, round: roundIndex + 1 }))).filter(item => item.warTag && item.warTag !== '#0');
            const warResults = await Promise.allSettled(warTags.map(item => getClanWarLeagueWarRequest(item.warTag).then(war => ({ ...war, _round: item.round, _warTag: item.warTag }))));
            if (token !== requestToken) return;
            report.wars = warResults.filter(result => result.status === 'fulfilled' && result.value).map(result => result.value).filter(war => getWarSide(war, clan.tag));
        }
        if (report.wars.length === 0 && report.currentWar && !report.currentWar.error && getWarSide(report.currentWar, clan.tag)) {
            report.phase = report.currentWar.state || report.phase;
            report.wars = [{ ...report.currentWar, _round: 1, _warTag: 'currentwar' }];
        }
        latestReport = buildReport(report);
        renderReport(latestReport);
        setState('ready');
    } catch (error) { console.error(error); setState('error', true); setHelp(t('op.loadError')); }
}
function getWarSide(war, clanTag) {
    const tag = normalizeTag(clanTag);
    const clan = normalizeTag(war?.clan?.tag);
    const opponent = normalizeTag(war?.opponent?.tag);
    if (clan === tag) return { self: war.clan, opponent: war.opponent };
    if (opponent === tag) return { self: war.opponent, opponent: war.clan };
    return null;
}
function buildReport(raw) {
    const plannedTags = new Set(raw.clan.players.map(normalizeTag));
    const players = new Map();
    const ensure = (tag, data = {}) => {
        const normalized = normalizeTag(tag); if (!normalized) return null;
        if (!players.has(normalized)) players.set(normalized, { tag: normalized, name: data.name || normalized, townHall: Number(data.townHallLevel || data.townHall || 0), planned: plannedTags.has(normalized), apiMember: false, warParticipant: false, attacksUsed: 0, availableAttacks: 0, stars: 0, destructionTotal: 0, destructionHits: 0, missed: 0 });
        const player = players.get(normalized);
        if (data.name && (!player.name || player.name === normalized)) player.name = data.name;
        if (data.townHallLevel || data.townHall) player.townHall = Number(data.townHallLevel || data.townHall);
        if (plannedTags.has(normalized)) player.planned = true;
        return player;
    };
    raw.clan.players.forEach(tag => ensure(tag, { planned: true }));
    raw.members.forEach(member => { const p = ensure(member.tag, member); if (p) p.apiMember = true; });
    const rounds = Array.from({ length: 7 }, (_, i) => ({ day: i + 1, state: 'notAvailable', opponent: '-', stars: 0, destruction: 0, attacksUsed: 0, availableAttacks: 0, missed: 0, result: 'pending' }));
    raw.wars.forEach(war => {
        const side = getWarSide(war, raw.clan.tag); if (!side) return;
        const round = rounds[(war._round || 1) - 1];
        round.state = war.state || 'unknown'; round.opponent = side.opponent?.name || '-'; round.stars = Number(side.self?.stars || 0); round.destruction = Number(side.self?.destructionPercentage || 0); round.attacksUsed = Number(side.self?.attacks || 0); round.availableAttacks = Array.isArray(side.self?.members) ? side.self.members.length : 0; round.missed = Math.max(0, round.availableAttacks - round.attacksUsed);
        round.result = decideResult(round.stars, round.destruction, Number(side.opponent?.stars || 0), Number(side.opponent?.destructionPercentage || 0), war.state);
        (side.self?.members || []).forEach(member => { const player = ensure(member.tag, member); if (!player) return; player.warParticipant = true; player.availableAttacks += 1; const attacks = Array.isArray(member.attacks) ? member.attacks : []; if (attacks.length === 0) player.missed += 1; else attacks.forEach(attack => { player.attacksUsed += 1; player.stars += Number(attack.stars || 0); player.destructionTotal += Number(attack.destructionPercentage || 0); player.destructionHits += 1; }); });
    });
    const roster = Array.from(players.values()).map(player => ({ ...player, destruction: player.destructionHits ? player.destructionTotal / player.destructionHits : 0, status: getPlayerStatus(player) })).sort((a, b) => Number(b.townHall) - Number(a.townHall) || a.name.localeCompare(b.name));
    return { ...raw, roster, rounds };
}
function decideResult(stars, destruction, opponentStars, opponentDestruction, state) { if (state && !['warEnded', 'inWar'].includes(state)) return 'pending'; if (stars > opponentStars) return 'win'; if (stars < opponentStars) return 'loss'; if (destruction > opponentDestruction) return 'win'; if (destruction < opponentDestruction) return 'loss'; return state === 'warEnded' ? 'draw' : 'pending'; }
function getPlayerStatus(player) { if (player.warParticipant && !player.planned) return 'unplanned'; if (player.planned && !player.warParticipant) return 'plannedOnly'; if (!player.planned && player.apiMember) return 'apiOnly'; return 'ok'; }
function renderReport(report) { refs.phase.value = report.phase; refs.roundState.textContent = report.wars.length ? `${report.wars.length} wars` : t('op.noLiveWars'); setHelp(report.wars.length ? t('op.liveLoaded') : t('op.noLeagueData')); renderRounds(report.rounds); renderScoreboard(report); renderRoster(); renderBonusAdvice(report.roster); }
function clearReport(resetSelectors = true) { latestReport = null; refs.totalStars.textContent = '0'; refs.avgDestruction.textContent = '0%'; refs.attacksUsed.textContent = '0/0'; refs.missed.textContent = '0'; refs.thList.replaceChildren(); refs.roundsList.replaceChildren(); refs.rosterBody.replaceChildren(); refs.bonusList.replaceChildren(); refs.rosterCount.textContent = '0 ' + t('op.players'); if (resetSelectors) refs.phase.value = '-'; }
function renderScoreboard(report) { const activeRounds = report.rounds.filter(round => round.state !== 'notAvailable'); const totalStars = activeRounds.reduce((sum, round) => sum + Number(round.stars || 0), 0); const avgDestruction = activeRounds.length ? activeRounds.reduce((sum, round) => sum + Number(round.destruction || 0), 0) / activeRounds.length : 0; const attacksUsed = report.roster.reduce((sum, player) => sum + Number(player.attacksUsed || 0), 0); const available = report.roster.reduce((sum, player) => sum + Number(player.availableAttacks || 0), 0); const missed = report.roster.reduce((sum, player) => sum + Number(player.missed || 0), 0); refs.totalStars.textContent = totalStars; refs.avgDestruction.textContent = avgDestruction.toFixed(1) + '%'; refs.attacksUsed.textContent = `${attacksUsed}/${available}`; refs.missed.textContent = missed; const distribution = report.roster.reduce((acc, player) => { if (!player.townHall) return acc; acc[player.townHall] = (acc[player.townHall] || 0) + 1; return acc; }, {}); refs.thList.replaceChildren(); Object.entries(distribution).sort((a,b)=>Number(b[0])-Number(a[0])).forEach(([th, amount]) => { const item = document.createElement('span'); item.textContent = `TH${th}: ${amount}`; refs.thList.appendChild(item); }); if (Object.keys(distribution).length === 0) refs.thList.appendChild(chip(t('op.noRoster'))); }
function renderRounds(rounds) { refs.roundsList.replaceChildren(); rounds.forEach(round => { const card = document.createElement('article'); card.className = `op-round-card op-round-${round.result}`; card.innerHTML = `<div class="op-round-title"><strong>${t('op.day')} ${round.day}</strong><span class="op-status-pill">${escapeHtml(round.state)}</span></div><p class="op-round-opponent-name">${escapeHtml(round.opponent || '-')}</p><div class="op-round-stats"><span><strong>${Number(round.stars || 0)}</strong>${t('op.stars')}</span><span><strong>${Number(round.destruction || 0).toFixed(1)}%</strong>Dest</span><span><strong>${Number(round.attacksUsed || 0)}/${Number(round.availableAttacks || 0)}</strong>Atk</span></div><p class="op-result-text">${escapeHtml(round.result)}</p>`; refs.roundsList.appendChild(card); }); }
function renderRoster() { refs.rosterBody.replaceChildren(); const report = latestReport; if (!report) return; const query = lower(refs.rosterFilter.value); const view = refs.rosterView.value; const roster = report.roster.filter(player => { const matchesSearch = !query || lower(player.name).includes(query) || lower(player.tag).includes(query); if (!matchesSearch) return false; if (view === 'planned') return player.planned; if (view === 'unplanned') return player.status === 'unplanned' || player.status === 'apiOnly'; if (view === 'missed') return Number(player.missed) > 0; return true; }); refs.rosterCount.textContent = `${roster.length}/${report.roster.length} ${t('op.players')}`; roster.forEach(player => { const row = document.createElement('tr'); row.className = `op-player-row op-status-${player.status}`; row.innerHTML = `<td><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml(player.tag)}</span></td><td>TH${player.townHall || '-'}</td><td>${badge(player.planned ? t('op.planned') : t('op.notPlanned'), player.planned ? 'ok' : 'warn')}</td><td>${badge(player.warParticipant ? t('op.inWar') : t('op.notInWar'), player.warParticipant ? 'ok' : 'muted')}</td><td>${Number(player.attacksUsed || 0)}/${Number(player.availableAttacks || 0)}</td><td>${Number(player.stars || 0)}★</td><td>${Number(player.destruction || 0).toFixed(1)}%</td><td>${badge(statusText(player.status), statusKind(player.status))}</td>`; refs.rosterBody.appendChild(row); }); }
function renderBonusAdvice(roster) { refs.bonusList.replaceChildren(); const ranked = [...roster].map(player => ({ ...player, score: Number(player.stars || 0) * 120 + Number(player.destruction || 0) + Number(player.attacksUsed || 0) * 25 + (player.planned ? 10 : 0) - Number(player.missed || 0) * 180 - (player.status === 'unplanned' ? 35 : 0) })).sort((a,b)=>b.score-a.score).slice(0,10); if (ranked.length === 0) { const li=document.createElement('li'); li.textContent=t('op.noRoster'); refs.bonusList.appendChild(li); return; } ranked.forEach(player => { const li=document.createElement('li'); li.innerHTML = `<strong>${escapeHtml(player.name)}</strong><span>${Number(player.stars || 0)}★ · ${Number(player.destruction || 0).toFixed(1)}% · ${Number(player.attacksUsed || 0)}/${Number(player.availableAttacks || 0)} attacks · ${Number(player.missed || 0)} missed</span>`; refs.bonusList.appendChild(li); }); }
function badge(text, kind='muted') { return `<span class="op-badge op-badge-${kind}">${escapeHtml(text)}</span>`; }
function statusKind(status) { return status === 'ok' ? 'ok' : status === 'unplanned' ? 'warn' : status === 'plannedOnly' ? 'info' : 'muted'; }
function statusText(status) { if (status === 'unplanned') return t('op.unplannedParticipant'); if (status === 'plannedOnly') return t('op.plannedOnly'); if (status === 'apiOnly') return t('op.apiOnly'); return t('op.ok'); }
function chip(text) { const span = document.createElement('span'); span.textContent = text; return span; }
function exportReport() { const data = latestReport || { message: 'No report loaded' }; const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'clashtools-cwl-operation-report.json'; a.click(); URL.revokeObjectURL(url); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
function init() { initRefs(); initI18n(); profileHTML(); initEvents(); loadPlans(); }
init();
