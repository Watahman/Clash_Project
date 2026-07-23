import { profileHTML } from '../profile/profile_popup.js';
import { syncAuthSession } from '../auth/auth-client.js';
import { normalizePlanDocument } from '../cwl/cwl-plan-schema.js';
import { buildRankingHistory, renderRankingHistoryChart } from '../cwl/cwl-ranking-history.js';
import {
    applyCwlPredictions,
    buildPlayerInsight,
    collectPredictionPlayerTags
} from '../cwl/cwl-performance-prediction.js';
import { renderStarsPerDayChart } from '../cwl/cwl-stars-chart.js';
import {
    decideWarResult,
    isAttackCountingState,
    isMissedCountingState,
    normalizeWarState
} from '../cwl/cwl-war-state.js';
import { initI18n, t } from '../i18n/i18n.js';
import { getCurrentUserId } from '../utils/user.js';
import { getAllPlansFromDatabase, getPlanFromDatabase } from '../Supabase/Supabase-Plan.js';
import {
    getClanInfoRequest,
    getClanMembersRequest,
    getClanCurrentWarRequest,
    getClanCurrentWarLeagueGroupRequest,
    getClanWarLeagueWarRequest
} from '../API/API-Clan.js';
import { getPlayerBattleLogRequest, getPlayerInfoRequest } from '../API/API-Player.js';

const refs = {};
const PREDICTION_CONCURRENCY = 4;
const PREDICTION_START_INTERVAL_MS = 750;
const planCache = new Map();
let selectedPlan = null;
let selectedClan = null;
let latestReport = null;
let requestToken = 0;
let planSelectToken = 0;
let reportController;
let syncState = 'idle';
let lastSyncAt = null;

function normalizeTag(tag = '') {
    const source = typeof tag === 'object' && tag !== null
        ? (tag.tag || tag.playerTag || tag.player_tag || tag.hashtag || tag.clanTag || tag.clantag || '')
        : tag;
    const clean = String(source || '').trim().toUpperCase();
    if (!clean || clean === '#NONE' || clean === 'NONE' || clean === '#0') return '';
    return clean.startsWith('#') ? clean : '#' + clean;
}

function lower(value = '') { return String(value || '').toLowerCase(); }
function looksLikeClashTag(value = '') {
    const raw = String(value || '').trim().toUpperCase().replace(/^#/, '');
    return raw.length >= 3 && raw.length <= 15 && /^[0289PYLQGRJCUV]+$/.test(raw);
}
function looksLikeTechnicalId(value = '') {
    const text = String(value || '').trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
        || /^[0-9a-f]{24,}$/i.test(text)
        || lower(text).startsWith('clanid');
}
function cleanDisplayName(name = '') {
    const text = String(name || '').trim();
    return looksLikeTechnicalId(text) || normalizeTag(text) === text ? '' : text;
}
function option(value, text, config = {}) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    if (config.disabled) opt.disabled = true;
    if (config.selected) opt.selected = true;
    return opt;
}

function parseNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function readPlannerPlayerCache() {
    try {
        const raw = JSON.parse(localStorage.getItem('clashtools_last_planner_players') || '[]');
        if (!Array.isArray(raw)) return new Map();
        return new Map(raw.map(player => [normalizeTag(player?.tag), player]).filter(([tag]) => tag));
    } catch {
        return new Map();
    }
}

function normalizePlayerRef(ref, fallbackClanName = '') {
    if (typeof ref === 'string') {
        const tag = normalizeTag(ref);
        return tag ? { tag, name: '', townHall: 0, clanName: fallbackClanName } : null;
    }
    if (!ref || typeof ref !== 'object') return null;
    const rawTag = ref.tag || ref.playerTag || ref.player_tag || ref.hashtag || (looksLikeClashTag(ref.id) ? ref.id : '');
    const tag = normalizeTag(rawTag);
    if (!tag) return null;
    return {
        tag,
        name: cleanDisplayName(ref.name || ref.playerName || ref.player_name || ''),
        townHall: parseNumber(ref.townHallLevel || ref.townHall || ref.th || ref.townhall, 0),
        clanName: ref.clanName || ref.clan_name || fallbackClanName || '',
        clanTag: normalizeTag(ref.clanTag || ref.clantag || ref.clan_id || '')
    };
}

function mergePlayerData(base = {}, incoming = {}) {
    return {
        ...base,
        tag: normalizeTag(incoming.tag || base.tag),
        name: cleanDisplayName(incoming.name || incoming.playerName || base.name || ''),
        townHall: parseNumber(incoming.townHallLevel || incoming.townHall || incoming.th || base.townHall, parseNumber(base.townHall, 0)),
        clanName: incoming.clanName || incoming.clan?.name || base.clanName || '',
        clanTag: normalizeTag(incoming.clanTag || incoming.clantag || incoming.clan?.tag || base.clanTag || '')
    };
}

function normalizePlan(plan) {
    if (!plan) return null;
    if (typeof plan === 'string') return { id: plan, name: plan, info: null };
    const id = plan.id || plan.uuid || plan.planId;
    if (!id) return null;
    return {
        ...plan,
        id,
        name: plan.name || plan.plan_name || 'Naamloos plan',
        info: plan.info != null
            ? normalizePlanDocument(plan.info)
            : plan.planInfo != null
                ? normalizePlanDocument(plan.planInfo)
                : null
    };
}

function getPlanClans(plan) {
    const info = normalizePlanDocument(plan?.info);
    const playerCache = readPlannerPlayerCache();
    return info.clans.map((clan, index) => {
        const tag = normalizeTag(clan.tag);
        const fallbackName = clan.name || clan.clanName || '';
        const players = (Array.isArray(clan.players) ? clan.players : [])
            .map(player => normalizePlayerRef(player, fallbackName))
            .filter(Boolean)
            .map(player => mergePlayerData(player, playerCache.get(player.tag) || {}));

        return {
            index,
            uuid: clan.uuid || clan.id || '',
            name: fallbackName || tag || `Clan ${index + 1}`,
            tag,
            players,
            amountOfPlayers: parseNumber(clan.capacity || clan.amountOfPlayers || clan.maxPlayers || 15, 15)
        };
    }).filter(clan => clan.tag);
}

function initRefs() {
    refs.planSelect = document.querySelector('#op-plan-select');
    refs.clanSelect = document.querySelector('#op-clan-select');
    refs.refresh = document.querySelector('#op-refresh');
    refs.exportBtn = document.querySelector('#op-export');
    refs.importBtn = document.querySelector('#op-import-json');
    refs.importFile = document.querySelector('#op-import-file');
    refs.standaloneInput = document.querySelector('#op-standalone-clan-tag');
    refs.standaloneLoad = document.querySelector('#op-standalone-load');
    refs.liveState = document.querySelector('#op-live-state');
    refs.phase = document.querySelector('#op-cwl-phase');
    refs.help = document.querySelector('#op-help');
    refs.totalStars = document.querySelector('#op-total-stars');
    refs.avgDestruction = document.querySelector('#op-avg-destruction');
    refs.attacksUsed = document.querySelector('#op-attacks-used');
    refs.missed = document.querySelector('#op-missed-attacks');
    refs.currentPosition = document.querySelector('#op-current-position');
    refs.thList = document.querySelector('#op-th-list');
    refs.starsChart = document.querySelector('#op-stars-chart');
    refs.starsChartState = document.querySelector('#op-stars-chart-state');
    refs.positionChart = document.querySelector('#op-position-chart');
    refs.positionChartState = document.querySelector('#op-position-chart-state');
    refs.roundsList = document.querySelector('#op-rounds-list');
    refs.roundState = document.querySelector('#op-round-state');
    refs.roundCount = document.querySelector('#op-round-count');
    refs.standingsState = document.querySelector('#op-standings-state');
    refs.standingsList = document.querySelector('#op-standings-list');
    refs.standingsNote = document.querySelector('#op-standings-note');
    refs.rosterCount = document.querySelector('#op-roster-count');
    refs.rosterBody = document.querySelector('#op-roster-body');
    refs.rosterFilter = document.querySelector('#op-roster-filter');
    refs.rosterView = document.querySelector('#op-roster-view');
    refs.bonusList = document.querySelector('#op-bonus-list');
}

function setState(state, isError = false) {
    syncState = isError ? 'error' : state;
    if (syncState === 'ready' || syncState === 'imported') lastSyncAt = new Date();
    refs.liveState.dataset.state = syncState;
    refs.refresh.disabled = syncState === 'loading';
    refs.refresh.setAttribute('aria-busy', String(syncState === 'loading'));
    renderSyncState();
}
function renderSyncState() {
    if (syncState === 'loading') refs.liveState.textContent = t('op.syncing');
    else if (syncState === 'error') refs.liveState.textContent = t('op.syncError');
    else if (syncState === 'imported') refs.liveState.textContent = t('op.importedState');
    else if (syncState === 'ready' && lastSyncAt) {
        const time = new Intl.DateTimeFormat(document.documentElement.lang || undefined, {
            hour: '2-digit',
            minute: '2-digit'
        }).format(lastSyncAt);
        refs.liveState.textContent = t('op.syncedAt', { time });
    } else refs.liveState.textContent = t('op.syncIdle');
}
function setHelp(text, isError = false) {
    refs.help.textContent = text;
    refs.help.dataset.state = isError ? 'error' : 'info';
}
function setPhase(stateKey = 'unknown') {
    refs.phase.textContent = cwlStateText(stateKey);
    refs.phase.dataset.state = stateKey;
}

function initEvents() {
    refs.planSelect.onchange = () => selectPlan(refs.planSelect.value);
    refs.clanSelect.onchange = () => selectClan(refs.clanSelect.value);
    refs.refresh.onclick = () => selectedClan && refreshClanReport(selectedClan);
    refs.rosterFilter.oninput = () => renderRoster();
    refs.rosterView.onchange = () => renderRoster();
    refs.exportBtn.onclick = () => exportReport();
    refs.importBtn.onclick = () => refs.importFile.click();
    refs.importFile.onchange = () => importJsonFile(refs.importFile.files?.[0]);
    refs.standaloneLoad.onclick = () => loadStandaloneClan();
    refs.standaloneInput.onkeydown = event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            loadStandaloneClan();
        }
    };
    window.addEventListener('clashtools:language-changed', refreshOperationLabels);
}

function refreshOperationLabels() {
    refs.roundsList.dataset.emptyLabel = t('op.noPlayedRounds');
    refs.standingsList.dataset.emptyLabel = t('op.standingsFallback');
    refs.bonusList.dataset.emptyLabel = t('op.noRoster');
    renderSyncState();
    if (latestReport) renderReport(latestReport);
    else {
        setPhase('unknown');
        renderStarsPerDayChart(refs.starsChart, [], refs.starsChartState);
        renderRankingHistoryChart(refs.positionChart, [], refs.positionChartState);
        renderEmptyRoster();
    }
}

function loadPlans() {
    const userId = getCurrentUserId();
    refs.planSelect.replaceChildren(option('', userId ? t('op.loadingPlans') : t('groups.login'), { disabled: true, selected: true }));
    refs.clanSelect.replaceChildren(option('', t('op.selectPlanFirst'), { disabled: true, selected: true }));
    refs.clanSelect.disabled = true;
    if (!userId) return Promise.resolve();

    return getAllPlansFromDatabase(userId).then(plans => {
        const normalizedPlans = Array.isArray(plans) ? plans.map(normalizePlan).filter(Boolean) : [];
        refs.planSelect.replaceChildren(option('', normalizedPlans.length ? t('op.selectPlanPlaceholder') : t('cwl.noPlan'), { disabled: true, selected: true }));
        normalizedPlans.forEach(plan => {
            planCache.set(plan.id, plan);
            refs.planSelect.appendChild(option(plan.id, plan.name));
        });
        normalizedPlans.forEach(prefetchPlan);
    }).catch(error => {
        console.error(error);
        refs.planSelect.replaceChildren(option('', t('groups.loadError'), { disabled: true, selected: true }));
    });
}

function prefetchPlan(plan) {
    if (!plan) return Promise.resolve(null);
    if (plan.info) return Promise.resolve(plan);
    return getPlanFromDatabase(plan.id).then(full => {
        const normalized = normalizePlan(full) || plan;
        const merged = { ...plan, ...normalized };
        planCache.set(plan.id, merged);
        return merged;
    }).catch(error => {
        console.error(error);
        return plan;
    });
}

function selectPlan(planId) {
    const token = ++planSelectToken;
    requestToken += 1;
    reportController?.abort();
    selectedPlan = null;
    selectedClan = null;
    latestReport = null;
    refs.clanSelect.disabled = true;
    refs.clanSelect.replaceChildren(option('', t('op.loadingClans'), { disabled: true, selected: true }));
    clearReport();
    if (!planId) {
        refs.clanSelect.replaceChildren(option('', t('op.selectPlanFirst'), { disabled: true, selected: true }));
        return;
    }
    const plan = planCache.get(planId);
    prefetchPlan(plan).then(full => {
        if (token !== planSelectToken) return;
        selectedPlan = normalizePlan(full);
        renderClanSelector(selectedPlan, token);
    }).catch(error => {
        if (token !== planSelectToken) return;
        console.error(error);
        refs.clanSelect.replaceChildren(option('', t('groups.loadError'), { disabled: true, selected: true }));
    });
}

function hasUsefulClanName(clan) {
    const name = String(clan.name || '').trim();
    if (!name || name === clan.tag) return false;
    if (normalizeTag(name) === clan.tag) return false;
    return !lower(name).includes('clanid');
}

function renderClanSelector(plan, token = planSelectToken) {
    refs.clanSelect.replaceChildren(option('', t('op.selectClanPlaceholder'), { disabled: true, selected: true }));
    const clans = getPlanClans(plan);
    clans.forEach(clan => {
        const opt = option(clan.tag, hasUsefulClanName(clan) ? clan.name : t('op.loadingClanName'));
        refs.clanSelect.appendChild(opt);
        if (!hasUsefulClanName(clan)) {
            getClanInfoRequest(clan.tag).then(clanInfo => {
                if (token !== planSelectToken) return;
                if (clanInfo?.name) {
                    clan.name = clanInfo.name;
                    opt.textContent = clanInfo.name;
                }
            }).catch(() => {
                opt.textContent = clan.tag;
            });
        }
    });
    refs.clanSelect.disabled = clans.length === 0;
    if (clans.length === 0) setHelp(t('op.noClansInPlan'));
}

function selectClan(clanTag) {
    selectedClan = getPlanClans(selectedPlan).find(clan => clan.tag === clanTag) || null;
    if (selectedClan) refreshClanReport(selectedClan);
}

function loadStandaloneClan() {
    const clanTag = normalizeTag(refs.standaloneInput.value);
    if (!clanTag || !looksLikeClashTag(clanTag)) {
        setHelp(t('op.standaloneInvalid'), true);
        return;
    }
    selectedPlan = null;
    selectedClan = { tag: clanTag, name: clanTag, players: [], standalone: true };
    latestReport = null;
    planSelectToken += 1;
    refs.planSelect.value = '';
    refs.clanSelect.disabled = true;
    refs.clanSelect.replaceChildren(option('', t('op.standaloneMode'), { disabled: true, selected: true }));
    refreshClanReport(selectedClan);
}

async function enrichPlannedPlayers(clan, members = [], signal) {
    const memberIndex = new Map(members.map(member => [normalizeTag(member.tag), member]).filter(([tag]) => tag));
    const cacheIndex = readPlannerPlayerCache();
    const plannedPlayers = Array.isArray(clan.players) ? clan.players : [];
    const enriched = plannedPlayers.map(player => mergePlayerData(mergePlayerData(player, cacheIndex.get(player.tag) || {}), memberIndex.get(player.tag) || {}));
    const missing = enriched.filter(player => player.tag && (!player.name || player.name === player.tag || !player.townHall));
    const results = await Promise.allSettled(missing.map(player => getPlayerInfoRequest(player.tag, { signal })));
    results.forEach((result, index) => {
        if (result.status !== 'fulfilled' || !result.value || result.value.error) return;
        const fetched = mergePlayerData(missing[index], result.value);
        const target = enriched.find(player => player.tag === fetched.tag);
        if (target) Object.assign(target, fetched);
    });
    return { ...clan, players: enriched };
}

async function loadPredictionInsights(report, signal) {
    const tags = collectPredictionPlayerTags(report);
    const insights = new Map();
    let nextIndex = 0;
    let nextRequestStart = 0;

    async function waitForRequestSlot() {
        const now = Date.now();
        const startAt = Math.max(now, nextRequestStart);
        nextRequestStart = startAt + PREDICTION_START_INTERVAL_MS;
        if (startAt > now) await new Promise(resolve => setTimeout(resolve, startAt - now));
    }

    async function worker() {
        while (nextIndex < tags.length) {
            if (signal.aborted) throw new DOMException('Request aborted', 'AbortError');
            const tag = tags[nextIndex];
            nextIndex += 1;
            await waitForRequestSlot();
            if (signal.aborted) throw new DOMException('Request aborted', 'AbortError');
            const [profileResult, battleLogResult] = await Promise.allSettled([
                getPlayerInfoRequest(tag, { signal }),
                getPlayerBattleLogRequest(tag, { signal })
            ]);
            if (signal.aborted) throw new DOMException('Request aborted', 'AbortError');
            const profile = profileResult.status === 'fulfilled' && !profileResult.value?.error ? profileResult.value : {};
            const battleLog = battleLogResult.status === 'fulfilled' && !battleLogResult.value?.error ? battleLogResult.value : {};
            insights.set(tag, buildPlayerInsight(profile, battleLog));
        }
    }

    const workers = Array.from(
        { length: Math.min(PREDICTION_CONCURRENCY, tags.length) },
        () => worker()
    );
    await Promise.all(workers);
    return insights;
}

async function enrichReportPredictions(report, token, signal) {
    try {
        const insights = await loadPredictionInsights(report, signal);
        if (token !== requestToken || signal.aborted || latestReport !== report) return;
        latestReport = applyCwlPredictions(report, insights);
        renderReport(latestReport);
    } catch (error) {
        if (error?.name === 'AbortError' || token !== requestToken) return;
        console.error(error);
        if (latestReport === report) {
            latestReport = { ...report, predictionState: 'unavailable' };
            renderReport(latestReport);
        }
    }
}

async function refreshClanReport(clan) {
    const token = ++requestToken;
    reportController?.abort();
    reportController = new AbortController();
    const { signal } = reportController;
    setState('loading');
    setHelp(t('op.loadingLive'));
    clearReport(false);
    try {
        const [clanInfo, membersData, leagueGroup, currentWar] = await Promise.allSettled([
            getClanInfoRequest(clan.tag, { signal }),
            getClanMembersRequest(clan.tag, { signal }),
            getClanCurrentWarLeagueGroupRequest(clan.tag, { signal }),
            getClanCurrentWarRequest(clan.tag, { signal })
        ]);
        if (token !== requestToken) return;
        const hasCoreData = [clanInfo, membersData, leagueGroup, currentWar].some(result =>
            result.status === 'fulfilled' && result.value && !result.value.error
        );
        if (!hasCoreData) throw new Error('No live clan data available');
        const members = membersData.status === 'fulfilled' && Array.isArray(membersData.value?.items) ? membersData.value.items : [];
        const clanInfoValue = clanInfo.status === 'fulfilled' && !clanInfo.value?.error ? clanInfo.value : null;
        const clanBase = {
            ...clan,
            tag: normalizeTag(clanInfoValue?.tag || clan.tag),
            name: cleanDisplayName(clanInfoValue?.name || clan.name) || clan.tag,
            players: Array.isArray(clan.players) ? clan.players : []
        };
        const enrichedClan = await enrichPlannedPlayers(clanBase, members, signal);
        if (token !== requestToken) return;
        selectedClan = enrichedClan;

        const report = {
            plan: selectedPlan,
            clan: enrichedClan,
            clanInfo: clanInfoValue,
            members,
            leagueGroup: leagueGroup.status === 'fulfilled' ? leagueGroup.value : null,
            currentWar: currentWar.status === 'fulfilled' ? currentWar.value : null,
            leagueWars: [],
            wars: [],
            phase: 'unknown'
        };

        if (report.leagueGroup && !report.leagueGroup.error && Array.isArray(report.leagueGroup.rounds)) {
            report.phase = normalizeLeaguePhase(report.leagueGroup.state);
            const warTags = report.leagueGroup.rounds
                .flatMap((round, roundIndex) => (round.warTags || []).map(warTag => ({ warTag, round: roundIndex + 1 })))
                .filter(item => normalizeTag(item.warTag));
            const warResults = await Promise.allSettled(warTags.map(item =>
                getClanWarLeagueWarRequest(item.warTag, { signal }).then(war => ({ ...war, _round: item.round, _warTag: item.warTag }))
            ));
            if (token !== requestToken) return;
            report.leagueWars = warResults
                .filter(result => result.status === 'fulfilled' && result.value && !result.value.error)
                .map(result => result.value);
            report.wars = report.leagueWars.filter(war => getWarSide(war, enrichedClan.tag));
        }

        if (report.wars.length === 0 && report.currentWar && !report.currentWar.error && getWarSide(report.currentWar, enrichedClan.tag)) {
            report.phase = normalizeLeaguePhase(report.currentWar.state || report.phase);
            report.wars = [{ ...report.currentWar, _round: 1, _warTag: 'currentwar' }];
        }

        latestReport = { ...buildReport(report), predictionState: 'loading' };
        renderReport(latestReport);
        setState('ready');
        void enrichReportPredictions(latestReport, token, signal);
    } catch (error) {
        if (error?.name === 'AbortError') return;
        setState('error', true);
        setHelp(t('op.loadError'), true);
    }
}

function getWarSide(war, clanTag) {
    const tag = normalizeTag(clanTag);
    const clan = normalizeTag(war?.clan?.tag);
    const opponent = normalizeTag(war?.opponent?.tag);
    if (clan === tag) return { self: war.clan, opponent: war.opponent };
    if (opponent === tag) return { self: war.opponent, opponent: war.clan };
    return null;
}

function normalizeLeaguePhase(state) {
    const normalized = normalizeWarState({ state });
    return normalized === 'completed' ? 'completed' : normalized === 'live' ? 'live' : normalized === 'preparation' ? 'preparation' : normalized === 'notStarted' ? 'notStarted' : 'unknown';
}

function isRoundCountedForScoreboard(round) { return isAttackCountingState(round?.state); }

function cwlStateText(stateKey) {
    if (stateKey === 'completed') return t('op.stateCompleted');
    if (stateKey === 'live') return t('op.stateLive');
    if (stateKey === 'preparation') return t('op.statePreparation');
    if (stateKey === 'notStarted') return t('op.stateNotStarted');
    if (stateKey === 'notAvailable') return t('op.stateNotStarted');
    return t('op.stateUnknown');
}

function resultText(result) {
    if (result === 'win') return t('op.resultWin');
    if (result === 'loss') return t('op.resultLoss');
    if (result === 'draw') return t('op.resultDraw');
    if (result === 'notStarted') return t('op.stateNotStarted');
    if (result === 'notAvailable') return t('op.stateNotStarted');
    return t('op.resultPending');
}

function createEmptyRound(day) {
    return {
        day,
        state: 'notStarted',
        stateText: cwlStateText('notStarted'),
        opponent: '-',
        stars: 0,
        destruction: 0,
        attacksUsed: 0,
        availableAttacks: 0,
        missed: 0,
        result: 'notStarted'
    };
}

function decideResult(stars, destruction, opponentStars, opponentDestruction, stateKey) {
    return decideWarResult(stars, destruction, opponentStars, opponentDestruction, stateKey);
}

function addStandingWar(stats, clan, opponent, result) {
    const tag = normalizeTag(clan?.tag);
    if (!tag) return;
    if (!stats.has(tag)) {
        stats.set(tag, {
            tag,
            name: cleanDisplayName(clan?.name) || tag,
            wars: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            stars: 0,
            destructionTotal: 0
        });
    }
    const row = stats.get(tag);
    row.wars += 1;
    row.stars += parseNumber(clan?.stars, 0);
    row.destructionTotal += parseNumber(clan?.destructionPercentage, 0);
    if (result === 'win') row.wins += 1;
    else if (result === 'loss') row.losses += 1;
    else row.draws += 1;
    row.lastOpponent = cleanDisplayName(opponent?.name) || normalizeTag(opponent?.tag) || '-';
}

function buildStandings(wars = [], selectedClanTag = '') {
    const completedWars = wars.filter(war => normalizeWarState(war) === 'completed' && war?.clan && war?.opponent);
    const stats = new Map();
    completedWars.forEach(war => {
        const clanStars = parseNumber(war.clan?.stars, 0);
        const opponentStars = parseNumber(war.opponent?.stars, 0);
        const clanDestruction = parseNumber(war.clan?.destructionPercentage, 0);
        const opponentDestruction = parseNumber(war.opponent?.destructionPercentage, 0);
        const clanResult = decideResult(clanStars, clanDestruction, opponentStars, opponentDestruction, 'completed');
        const opponentResult = clanResult === 'win' ? 'loss' : clanResult === 'loss' ? 'win' : 'draw';
        addStandingWar(stats, war.clan, war.opponent, clanResult);
        addStandingWar(stats, war.opponent, war.clan, opponentResult);
    });
    const rows = Array.from(stats.values())
        .map(row => ({
            ...row,
            destruction: row.wars ? row.destructionTotal / row.wars : 0
        }))
        .sort((a, b) => b.stars - a.stars || b.destruction - a.destruction || b.wins - a.wins || a.name.localeCompare(b.name))
        .map((row, index) => ({ ...row, rank: index + 1 }));
    const selectedTag = normalizeTag(selectedClanTag);
    return {
        rows,
        selectedIndex: rows.findIndex(row => row.tag === selectedTag),
        completedWars: completedWars.length
    };
}

function buildReport(raw) {
    const plannedRecords = Array.isArray(raw.clan.players) ? raw.clan.players : [];
    const plannedTags = new Set(plannedRecords.map(player => normalizeTag(player.tag || player)).filter(Boolean));
    const players = new Map();

    const ensure = (tag, data = {}) => {
        const normalized = normalizeTag(tag || data.tag);
        if (!normalized) return null;
        if (!players.has(normalized)) {
            players.set(normalized, {
                tag: normalized,
                name: data.name || '',
                townHall: parseNumber(data.townHallLevel || data.townHall || data.th, 0),
                clanName: data.clanName || data.clan?.name || '',
                planned: plannedTags.has(normalized),
                apiMember: false,
                warParticipant: false,
                attacksUsed: 0,
                availableAttacks: 0,
                stars: 0,
                destructionTotal: 0,
                destructionHits: 0,
                missed: 0,
                dayStats: {}
            });
        }
        const player = players.get(normalized);
        const merged = mergePlayerData(player, data);
        Object.assign(player, merged);
        if (plannedTags.has(normalized)) player.planned = true;
        return player;
    };

    plannedRecords.forEach(player => ensure(player.tag || player, player));
    raw.members.forEach(member => {
        const player = ensure(member.tag, member);
        if (player) player.apiMember = true;
    });

    const maxRound = Math.max(7, ...raw.wars.map(war => parseNumber(war._round, 1)));
    const rounds = Array.from({ length: maxRound }, (_, i) => createEmptyRound(i + 1));

    raw.wars.forEach(war => {
        const side = getWarSide(war, raw.clan.tag);
        if (!side) return;
        const day = Math.max(1, parseNumber(war._round, 1));
        const round = rounds[day - 1] || createEmptyRound(day);
        rounds[day - 1] = round;
        const stateKey = normalizeWarState(war);
        const counting = isAttackCountingState(stateKey);
        const missedCounting = isMissedCountingState(stateKey);
        const members = Array.isArray(side.self?.members) ? side.self.members : [];
        const attacksPerMember = Math.max(1, parseNumber(war.attacksPerMember, 1));
        const attacksUsed = counting ? parseNumber(side.self?.attacks, 0) : 0;
        const availableAttacks = counting ? members.length * attacksPerMember : 0;

        round.state = stateKey;
        round.stateText = cwlStateText(stateKey);
        round.opponent = side.opponent?.name || '-';
        round.stars = counting ? parseNumber(side.self?.stars, 0) : 0;
        round.destruction = counting ? parseNumber(side.self?.destructionPercentage, 0) : 0;
        round.attacksUsed = attacksUsed;
        round.availableAttacks = availableAttacks;
        round.missed = missedCounting ? Math.max(0, availableAttacks - attacksUsed) : 0;
        round.result = decideResult(round.stars, round.destruction, parseNumber(side.opponent?.stars, 0), parseNumber(side.opponent?.destructionPercentage, 0), stateKey);

        members.forEach(member => {
            const player = ensure(member.tag, member);
            if (!player) return;
            player.warParticipant = true;
            const attacks = Array.isArray(member.attacks) ? member.attacks : [];
            const dayStat = {
                day,
                opponent: round.opponent,
                state: stateKey,
                stateText: round.stateText,
                warParticipant: true,
                attacksUsed: counting ? attacks.length : 0,
                availableAttacks: counting ? attacksPerMember : 0,
                stars: 0,
                destructionTotal: 0,
                destructionHits: 0,
                missed: missedCounting ? Math.max(0, attacksPerMember - attacks.length) : 0,
                result: round.result
            };

            if (counting) {
                player.availableAttacks += attacksPerMember;
                if (missedCounting) player.missed += Math.max(0, attacksPerMember - attacks.length);
                attacks.forEach(attack => {
                    const stars = parseNumber(attack.stars, 0);
                    const destruction = parseNumber(attack.destructionPercentage, 0);
                    player.attacksUsed += 1;
                    player.stars += stars;
                    player.destructionTotal += destruction;
                    player.destructionHits += 1;
                    dayStat.stars += stars;
                    dayStat.destructionTotal += destruction;
                    dayStat.destructionHits += 1;
                });
            }
            dayStat.destruction = dayStat.destructionHits ? dayStat.destructionTotal / dayStat.destructionHits : 0;
            player.dayStats[day] = dayStat;
        });
    });

    const roster = Array.from(players.values()).map(player => ({
        ...player,
        name: cleanDisplayName(player.name) || player.tag,
        destruction: player.destructionHits ? player.destructionTotal / player.destructionHits : 0,
        status: getPlayerStatus(player)
    })).sort((a, b) => Number(b.townHall) - Number(a.townHall) || a.name.localeCompare(b.name));

    const standings = buildStandings(raw.leagueWars || raw.wars, raw.clan.tag);
    const rankingHistory = buildRankingHistory({
        leagueGroup: raw.leagueGroup,
        leagueWars: raw.leagueWars,
        selectedClanTag: raw.clan.tag,
        buildStandings
    });
    return { ...raw, roster, rounds, standings, rankingHistory };
}

function getPlayerStatus(player) {
    if (player.warParticipant && !player.planned) return 'unplanned';
    if (player.planned && !player.warParticipant) return 'plannedOnly';
    if (!player.planned && player.apiMember) return 'apiOnly';
    return 'ok';
}

function renderReport(report) {
    setPhase(report.phase);
    refs.starsChart.setAttribute('aria-busy', String(report.predictionState === 'loading'));
    const countedRounds = report.rounds.filter(isRoundCountedForScoreboard);
    refs.roundState.textContent = countedRounds.length ? `${countedRounds.length} ${t('op.roundsShort')}` : t('op.noPlayedRounds');
    refs.roundCount.textContent = `${report.rounds.length} ${t('op.roundsShort')}`;
    setHelp(report.wars.length ? t('op.liveLoaded') : t('op.noLeagueData'));
    renderRosterViewOptions(report);
    renderRounds(report.rounds, report.predictionState);
    renderStarsPerDayChart(refs.starsChart, report.rounds, refs.starsChartState);
    renderRankingHistoryChart(refs.positionChart, report.rankingHistory, refs.positionChartState);
    renderScoreboard(report);
    renderStandings(report);
    renderRoster();
    renderBonusAdvice(report.roster);
}

function clearReport(resetSelectors = true) {
    latestReport = null;
    refs.totalStars.textContent = '0';
    refs.avgDestruction.textContent = '0%';
    refs.attacksUsed.textContent = '0/0';
    refs.missed.textContent = '0';
    refs.currentPosition.textContent = '-';
    refs.starsChart.setAttribute('aria-busy', 'false');
    refs.thList.replaceChildren();
    renderStarsPerDayChart(refs.starsChart, [], refs.starsChartState);
    renderRankingHistoryChart(refs.positionChart, [], refs.positionChartState);
    refs.roundsList.replaceChildren();
    refs.standingsList.replaceChildren();
    refs.standingsState.textContent = '-';
    refs.standingsNote.textContent = '';
    refs.rosterBody.replaceChildren();
    renderEmptyRoster();
    refs.bonusList.replaceChildren();
    refs.rosterCount.textContent = '0 ' + t('op.players');
    renderRosterViewOptions(null);
    if (resetSelectors) setPhase('unknown');
}

function renderRosterViewOptions(report) {
    const current = refs.rosterView.value || 'all';
    refs.rosterView.replaceChildren(
        option('all', t('op.viewAll')),
        option('planned', t('op.viewPlanned')),
        option('unplanned', t('op.viewUnplanned')),
        option('missed', t('op.viewMissed'))
    );
    if (report?.rounds?.length) {
        refs.rosterView.appendChild(option('', '──────────', { disabled: true }));
        report.rounds.forEach(round => {
            refs.rosterView.appendChild(option(`day:${round.day}`, `${t('op.day')} ${round.day} · ${round.stateText}`));
        });
    }
    refs.rosterView.value = Array.from(refs.rosterView.options).some(opt => opt.value === current) ? current : 'all';
}

function renderScoreboard(report) {
    const countedRounds = report.rounds.filter(round => isAttackCountingState(round.state));
    const totalStars = countedRounds.reduce((sum, round) => sum + parseNumber(round.stars, 0), 0);
    const avgDestruction = countedRounds.length ? countedRounds.reduce((sum, round) => sum + parseNumber(round.destruction, 0), 0) / countedRounds.length : 0;
    const attacksUsed = report.roster.reduce((sum, player) => sum + parseNumber(player.attacksUsed, 0), 0);
    const available = report.roster.reduce((sum, player) => sum + parseNumber(player.availableAttacks, 0), 0);
    const missed = report.roster.reduce((sum, player) => sum + parseNumber(player.missed, 0), 0);
    refs.totalStars.textContent = totalStars;
    refs.avgDestruction.textContent = avgDestruction.toFixed(1) + '%';
    refs.attacksUsed.textContent = `${attacksUsed}/${available}`;
    refs.missed.textContent = missed;

    const distribution = report.roster.reduce((acc, player) => {
        if (!player.townHall) return acc;
        acc[player.townHall] = (acc[player.townHall] || 0) + 1;
        return acc;
    }, {});
    refs.thList.replaceChildren();
    Object.entries(distribution).sort((a, b) => Number(b[0]) - Number(a[0])).forEach(([th, amount]) => {
        const item = document.createElement('span');
        item.textContent = `TH${th}: ${amount}`;
        refs.thList.appendChild(item);
    });
    if (Object.keys(distribution).length === 0) refs.thList.appendChild(chip(t('op.noRoster')));
}

function renderStandings(report) {
    refs.standingsList.replaceChildren();
    refs.standingsNote.textContent = '';
    const standings = report?.standings;
    if (!standings?.rows?.length || standings.selectedIndex < 0) {
        refs.standingsState.textContent = t('op.standingsUnavailable');
        refs.currentPosition.textContent = '-';
        refs.standingsList.appendChild(chip(t('op.standingsFallback')));
        return;
    }
    const selected = standings.rows[standings.selectedIndex];
    refs.standingsState.textContent = `#${selected.rank}/${standings.rows.length}`;
    refs.currentPosition.textContent = `#${selected.rank}`;
    standings.rows.forEach(row => {
        const item = document.createElement('div');
        item.className = `op-standing-row${row.tag === selected.tag ? ' is-selected' : ''}`;
        item.innerHTML = `
            <span class="op-standing-rank">#${row.rank}</span>
            <strong>${escapeHtml(row.name)}</strong>
            <span>${parseNumber(row.stars, 0)}★</span>
            <span>${parseNumber(row.destruction, 0).toFixed(1)}%</span>`;
        refs.standingsList.appendChild(item);
    });
    refs.standingsNote.textContent = t('op.standingsNote', { count: standings.completedWars });
}

function predictionMarkup(round, predictionState) {
    const prediction = round.prediction;
    if (prediction) {
        const maximumStars = parseNumber(prediction.availableAttacks, 0) * 3;
        return `
            <div class="op-round-prediction" data-state="ready">
                <span class="op-round-prediction-label">${escapeHtml(t('op.chartPrediction'))}</span>
                <div class="op-bonus-performance op-prediction-performance">
                    <span title="${escapeHtml(t('op.predictedStars'))}"><strong>${parseNumber(prediction.stars, 0).toFixed(2)}/${maximumStars}</strong><small>${escapeHtml(t('op.stars'))}</small></span>
                    <span title="${escapeHtml(t('op.predictedDestruction'))}"><strong>${parseNumber(prediction.destruction, 0).toFixed(2)}%</strong><small>Dest</small></span>
                    <span title="${escapeHtml(t('op.predictedAttacks'))}"><strong>${parseNumber(prediction.attacksUsed, 0).toFixed(2)}/${parseNumber(prediction.availableAttacks, 0)}</strong><small>${escapeHtml(t('op.attacks'))}</small></span>
                </div>
            </div>`;
    }
    const loading = predictionState === 'loading';
    return `
        <div class="op-round-prediction" data-state="${loading ? 'loading' : 'unavailable'}">
            <span class="op-round-prediction-label">${escapeHtml(t('op.chartPrediction'))}</span>
            <span class="op-prediction-state">${escapeHtml(t(loading ? 'op.predictionLoading' : 'op.predictionUnavailable'))}</span>
        </div>`;
}

function renderRounds(rounds, predictionState = 'idle') {
    refs.roundsList.replaceChildren();
    rounds.forEach(round => {
        const card = document.createElement('article');
        card.className = `op-round-card op-round-${round.result} op-round-state-${round.state}`;
        card.setAttribute('aria-label', `${t('op.day')} ${round.day}: ${resultText(round.result)}`);
        card.innerHTML = `
            <div class="op-round-title">
                <strong>${t('op.day')} ${round.day}</strong>
                <span class="op-status-pill" data-state="${escapeHtml(round.state)}">${escapeHtml(round.stateText)}</span>
            </div>
            <p class="op-round-opponent-name">${escapeHtml(round.opponent || '-')}</p>
            <div class="op-round-stats">
                <span><strong>${parseNumber(round.stars, 0)}</strong>${t('op.stars')}</span>
                <span><strong>${parseNumber(round.destruction, 0).toFixed(1)}%</strong>Dest</span>
                <span><strong>${parseNumber(round.attacksUsed, 0)}/${parseNumber(round.availableAttacks, 0)}</strong>Atk</span>
            </div>
            ${predictionMarkup(round, predictionState)}`;
        refs.roundsList.appendChild(card);
    });
}

function getPlayerDayDisplay(player, day) {
    const stat = player.dayStats?.[day];
    if (stat) {
        return {
            warText: stat.warParticipant ? t('op.inThisWar') : t('op.notInThisWar'),
            warKind: stat.warParticipant ? 'ok' : 'muted',
            attacksUsed: stat.attacksUsed,
            availableAttacks: stat.availableAttacks,
            stars: stat.stars,
            destruction: stat.destruction,
            missed: stat.missed
        };
    }
    return {
        warText: t('op.notInThisWar'),
        warKind: 'muted',
        attacksUsed: 0,
        availableAttacks: 0,
        stars: 0,
        destruction: 0,
        missed: 0
    };
}

function renderRoster() {
    refs.rosterBody.replaceChildren();
    const report = latestReport;
    if (!report) return;
    const query = lower(refs.rosterFilter.value);
    const view = refs.rosterView.value;
    const isDayView = view.startsWith('day:');
    const day = isDayView ? parseNumber(view.split(':')[1], 0) : 0;

    const roster = report.roster.filter(player => {
        const matchesSearch = !query || lower(player.name).includes(query) || lower(player.tag).includes(query);
        if (!matchesSearch) return false;
        if (view === 'planned') return player.planned;
        if (view === 'unplanned') return player.status === 'unplanned' || player.status === 'apiOnly';
        if (view === 'missed') return parseNumber(player.missed, 0) > 0;
        return true;
    });

    refs.rosterCount.textContent = `${roster.length} ${t('op.players')}`;
    if (roster.length === 0) {
        renderEmptyRoster();
        return;
    }
    roster.forEach(player => {
        const display = isDayView ? getPlayerDayDisplay(player, day) : {
            warText: player.warParticipant ? t('op.inAnyWar') : t('op.notInWar'),
            warKind: player.warParticipant ? 'ok' : 'muted',
            attacksUsed: player.attacksUsed,
            availableAttacks: player.availableAttacks,
            stars: player.stars,
            destruction: player.destruction
        };
        const row = document.createElement('tr');
        row.className = `op-player-row op-status-${player.status}`;
        row.innerHTML = `
            <td><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml(player.tag)}</span></td>
            <td>TH${player.townHall || '-'}</td>
            <td>${badge(player.planned ? t('op.planned') : t('op.notPlanned'), player.planned ? 'ok' : 'warn')}</td>
            <td>${badge(display.warText, display.warKind)}</td>
            <td>${parseNumber(display.attacksUsed, 0)}/${parseNumber(display.availableAttacks, 0)}</td>
            <td>${parseNumber(display.stars, 0)}★</td>
            <td>${parseNumber(display.destruction, 0).toFixed(1)}%</td>`;
        refs.rosterBody.appendChild(row);
    });
}

function renderEmptyRoster() {
    if (refs.rosterBody.children.length) return;
    const row = document.createElement('tr');
    row.className = 'op-table-empty';
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.textContent = t('op.noRoster');
    row.appendChild(cell);
    refs.rosterBody.appendChild(row);
}

function renderBonusAdvice(roster) {
    refs.bonusList.replaceChildren();
    const ranked = [...roster]
        .map(player => ({
            ...player,
            score: parseNumber(player.difficultyAdjustedStars, parseNumber(player.stars, 0)) * 120
                + parseNumber(player.destruction, 0) * Math.max(1, parseNumber(player.attacksUsed, 0))
                + parseNumber(player.attacksUsed, 0) * 25
                + parseNumber(player.defense?.rating, 0) * 100 * Math.min(3, parseNumber(player.defense?.count, 0))
                + (player.planned ? 10 : 0)
                - parseNumber(player.missed, 0) * 180
                - (player.status === 'unplanned' ? 35 : 0)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    if (ranked.length === 0) {
        const li = document.createElement('li');
        li.textContent = t('op.noRoster');
        refs.bonusList.appendChild(li);
        return;
    }
    ranked.forEach(player => {
        const difficulty = player.attackDifficulty?.multiplier;
        const difficultyLabel = difficulty == null
            ? '—'
            : t(difficulty >= 1.12 ? 'op.difficultyHigh' : difficulty <= 0.88 ? 'op.difficultyLow' : 'op.difficultyMedium');
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="op-bonus-content">
                <div class="op-bonus-player">
                    <strong>${escapeHtml(player.name)}</strong>
                    <span>TH${parseNumber(player.townHall, 0) || '-'} · ${escapeHtml(player.tag)}</span>
                </div>
                <div class="op-bonus-performance">
                    <span title="${escapeHtml(t('op.stars'))}"><strong>${parseNumber(player.stars, 0)}★</strong></span>
                    <span title="${escapeHtml(t('op.destruction'))}"><strong>${parseNumber(player.destruction, 0).toFixed(1)}%</strong></span>
                    <span title="${escapeHtml(t('op.attacksUsed'))}"><strong>${parseNumber(player.attacksUsed, 0)}/${parseNumber(player.availableAttacks, 0)}</strong><small>${escapeHtml(t('op.attacks'))}</small></span>
                    <span title="${escapeHtml(t('op.missed'))}"><strong>${parseNumber(player.missed, 0)}</strong><small>${escapeHtml(t('op.missed'))}</small></span>
                    <span class="op-prediction-detail" title="${escapeHtml(t('op.attackDifficulty'))}"><strong>${escapeHtml(difficultyLabel)}</strong><small>${difficulty == null ? '—' : `${parseNumber(difficulty, 1).toFixed(2)}×`}</small></span>
                    <span title="${escapeHtml(t('op.defense'))}"><strong>${player.defense?.stars == null ? '—' : `${parseNumber(player.defense.stars, 0).toFixed(2)}★ · ${parseNumber(player.defense.destruction, 0).toFixed(1)}%`}</strong><small>${escapeHtml(t('op.defenseShort'))}</small></span>
                </div>
            </div>`;
        refs.bonusList.appendChild(li);
    });
}

function badge(text, kind = 'muted') { return `<span class="op-badge op-badge-${kind}">${escapeHtml(text)}</span>`; }
function chip(text) { const span = document.createElement('span'); span.textContent = text; return span; }

function exportReport() {
    const data = latestReport || { message: 'No report loaded' };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clashpanel-cwl-operation-report.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importJsonFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(String(reader.result || ''));
            applyImportedJson(data);
            setHelp(t('op.importOk'));
        } catch (error) {
            console.error(error);
            setHelp(t('op.importInvalid'), true);
        } finally {
            refs.importFile.value = '';
        }
    };
    reader.onerror = () => {
        setHelp(t('op.importInvalid'), true);
        refs.importFile.value = '';
    };
    reader.readAsText(file);
}

function normalizeImportedReport(data) {
    if (!data || typeof data !== 'object') return null;
    if (Array.isArray(data.roster) && Array.isArray(data.rounds)) {
        const leagueWars = Array.isArray(data.leagueWars) ? data.leagueWars : Array.isArray(data.wars) ? data.wars : [];
        const standings = data.standings || buildStandings(leagueWars, data.clan?.tag || '');
        const rankingHistory = buildRankingHistory({
            leagueGroup: data.leagueGroup,
            leagueWars,
            selectedClanTag: data.clan?.tag || '',
            buildStandings
        });
        return {
            ...data,
            roster: data.roster.map(player => ({ ...player, tag: normalizeTag(player.tag), name: player.name || normalizeTag(player.tag), townHall: parseNumber(player.townHall || player.townHallLevel, 0), dayStats: player.dayStats || {} })).filter(player => player.tag),
            rounds: data.rounds.map((round, index) => {
                const state = round.state === 'notAvailable' ? 'notStarted' : round.state || 'notStarted';
                return {
                    ...createEmptyRound(index + 1),
                    ...round,
                    day: round.day || index + 1,
                    state,
                    stateText: cwlStateText(state),
                    result: round.result === 'notAvailable' ? 'notStarted' : round.result || 'notStarted'
                };
            }),
            wars: Array.isArray(data.wars) ? data.wars : [],
            leagueWars,
            standings,
            rankingHistory,
            phase: data.phase || 'unknown'
        };
    }
    return null;
}

export function applyImportedJson(data) {
    const directReport = normalizeImportedReport(data);
    if (directReport) {
        latestReport = directReport;
        selectedPlan = data.plan ? normalizePlan(data.plan) : selectedPlan;
        selectedClan = data.clan || selectedClan;
        renderReport(latestReport);
        setState('imported');
        return;
    }

    const importedPlan = normalizePlan(data.plan || data);
    if (importedPlan?.info) {
        const id = importedPlan.id || 'imported-json-plan';
        const plan = { ...importedPlan, id };
        planCache.set(id, plan);
        selectedPlan = plan;
        if (!Array.from(refs.planSelect.options).some(opt => opt.value === id)) refs.planSelect.appendChild(option(id, `${plan.name} (${t('op.imported')})`));
        refs.planSelect.value = id;
        renderClanSelector(plan);
        const clans = getPlanClans(plan);
        if (clans.length) {
            refs.clanSelect.value = clans[0].tag;
            selectedClan = clans[0];
            clearReport(false);
            setHelp(t('op.importPlanOk'));
        }
        setState('imported');
        return;
    }

    throw new Error('Unsupported JSON format');
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function init() {
    initRefs();
    initI18n();
    await syncAuthSession().catch(() => null);
    profileHTML();
    initEvents();
    clearReport(false);
    refreshOperationLabels();
    await loadPlans();
    setPhase('unknown');
    setState('idle');
}

const initialPageLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialPageLoad);
