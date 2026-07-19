import { canAutosave, isLoading, setLoading, setCanAutosave } from '../Data/config.js';
import { getClanInfoRequest } from '../API/API-Clan.js';
import { getPlayerBasicData } from '../API/API-Functions.js';
import { createPlayerCard, createClanCard } from '../templates/CWLTemplates.js';
import { getAllPlansFromDatabase, getPlanFromDatabase, setPlanToDatabase } from '../Supabase/Supabase-Plan.js';
import { getCurrentUserId } from '../utils/user.js';
import { t } from '../i18n/i18n.js';
import { getActiveCwlPollMeta } from './cwl-availability.js';
import { getCardTag, normalizeTag } from './cwl-utils.js';
import { normalizePlanDocument, validatePlanDocument } from './cwl-plan-schema.js';

const PLAN_CACHE_KEY = 'clashtools_planner_cache';
const ACTIVE_PLAN_KEY = 'planner_id';
const AUTOSAVE_DELAY_MS = 500;
const ENRICH_CONCURRENCY = 6;

let availablePlayers;
let allClans;
let totalPlayerAmount;
let planName;
let loadPlan;
let saveStatus;
const planCache = new Map();
const planRevisions = new Map();
let saveStatusTimer;
let debounceTimer;
let pendingSave;
let saveQueue = Promise.resolve();
let activeLoadToken = 0;
let planContextToken = 0;
let activeLoadController;
let activePlanId = null;
let suppressSave = false;

export function initPlanIO(refs) {
    availablePlayers = refs.availablePlayers;
    allClans = refs.allClans;
    totalPlayerAmount = refs.totalPlayerAmount;
    planName = refs.planName;
    loadPlan = refs.loadPlan;
    saveStatus = document.querySelector('#cwl-save-status');
    activePlanId = cleanPlanId(localStorage.getItem(ACTIVE_PLAN_KEY));
    setSaveStatus('idle');
}

function cleanPlanId(value) {
    const id = String(value || '').trim();
    return id && id !== 'undefined' && id !== 'null' ? id : null;
}

function normalizePlan(plan) {
    if (!plan) return null;
    if (typeof plan === 'string') return { id: plan, uuid: plan, name: plan, info: null, revision: null };
    const id = cleanPlanId(plan.id || plan.uuid || plan.planId);
    if (!id) return null;
    const rawInfo = plan.info ?? plan.planInfo ?? null;
    return {
        ...plan,
        id,
        uuid: plan.uuid || id,
        name: String(plan.name || plan.plan_name || t('cwl.unnamedPlan')).trim(),
        info: rawInfo == null ? null : normalizePlanDocument(rawInfo),
        revision: Number.isFinite(Number(plan.revision)) ? Number(plan.revision) : null
    };
}

function setSaveStatus(state) {
    if (!saveStatus) return;
    saveStatus.dataset.state = state;
    saveStatus.textContent = t(
        state === 'saving' ? 'cwl.saving'
            : state === 'error' ? 'cwl.saveError'
                : state === 'conflict' ? 'cwl.saveConflict'
                    : 'cwl.saved'
    );
}

function readPlayerCard(player) {
    return {
        name: player.querySelector('.cwl-player-name')?.textContent || '',
        clanName: player.querySelector('.cwl-player-clan')?.textContent || '',
        tag: getCardTag(player),
        townHallLevel: Number(player.dataset.townHall || 1)
    };
}

function serializePlan() {
    const pollMeta = getActiveCwlPollMeta();
    const document = {
        schemaVersion: 2,
        freePlayers: Array.from(
            availablePlayers.querySelectorAll('.cwl-player-article[data-planner-card="true"]'),
            readPlayerCard
        ).filter(player => player.tag),
        clans: Array.from(allClans.querySelectorAll('.cwl-clan-article')).map(clan => ({
            id: clan.id.split('_').at(-1),
            tag: normalizeTag(clan.dataset.clanTag),
            name: clan.dataset.clanName || clan.querySelector('.cwl-clan-name')?.textContent || '',
            capacity: Number(clan.querySelector('.cwl-amount-of-players-in-clan')?.textContent?.split('/')[1] || 15),
            badgeUrl: clan.querySelector('.cwl-clan-logo')?.src || '',
            players: Array.from(
                clan.querySelectorAll('.cwl-player-article[data-planner-card="true"]'),
                readPlayerCard
            ).filter(player => player.tag)
        })),
        pollMeta: {
            groupId: pollMeta.groupId || '',
            pollId: pollMeta.pollId || ''
        }
    };
    const validated = validatePlanDocument(document);
    localStorage.setItem(
        'clashtools_last_planner_players',
        JSON.stringify([...validated.freePlayers, ...validated.clans.flatMap(clan => clan.players)])
    );
    return validated;
}

export function savePlan(options = {}) {
    const immediate = options.immediate === true;
    const userId = getCurrentUserId();
    if (isLoading || suppressSave || !canAutosave || !userId) return Promise.resolve(null);

    const name = planName.value.trim();
    if (!name || name.length > 40) {
        setSaveStatus('error');
        return Promise.resolve(null);
    }

    let info;
    try {
        info = serializePlan();
    } catch {
        setSaveStatus('error');
        return Promise.resolve(null);
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    if (!pendingSave) {
        pendingSave = { resolvers: [] };
    }
    pendingSave.job = {
        userId,
        planId: activePlanId,
        name,
        info,
        revision: activePlanId ? planRevisions.get(activePlanId) ?? null : null,
        contextToken: planContextToken
    };
    const promise = new Promise(resolve => pendingSave.resolvers.push(resolve));
    debounceTimer = setTimeout(flushPendingSave, immediate ? 0 : AUTOSAVE_DELAY_MS);
    return promise;
}

function flushPendingSave() {
    if (!pendingSave?.job) return;
    const batch = pendingSave;
    pendingSave = null;
    debounceTimer = null;
    setSaveStatus('saving');

    saveQueue = saveQueue
        .catch(() => null)
        .then(() => persistSave(batch.job))
        .then(result => {
            batch.resolvers.forEach(resolve => resolve(result));
            return result;
        });
}

async function persistSave(job) {
    try {
        const data = await setPlanToDatabase(
            job.userId,
            job.planId,
            job.name,
            job.info,
            job.revision
        );
        const savedId = cleanPlanId(data?.uuid || data?.id || job.planId);
        const revision = Number(data?.revision || job.revision || 1);
        if (savedId) {
            planRevisions.set(savedId, revision);
            const cached = {
                id: savedId,
                uuid: savedId,
                name: job.name,
                info: job.info,
                revision
            };
            planCache.set(savedId, cached);
            upsertPlanOption(savedId, job.name);
            persistPlanCache();
            if (!job.planId && activePlanId === null && job.contextToken === planContextToken) {
                setActivePlan(savedId);
            }
        }
        clearTimeout(saveStatusTimer);
        saveStatusTimer = setTimeout(() => setSaveStatus('idle'), 700);
        return data;
    } catch (error) {
        setSaveStatus(error?.status === 409 ? 'conflict' : 'error');
        return null;
    }
}

export function loadAllPlans() {
    const userId = getCurrentUserId();
    planCache.clear();
    planRevisions.clear();
    const cachedPlans = readPlanCache();
    renderPlanOptions(cachedPlans, true);

    if (!userId) {
        loadPlan.disabled = true;
        if (!cachedPlans.length) loadPlan.replaceChildren(option('', t('cwl.noPlan')));
        return Promise.resolve([]);
    }

    loadPlan.disabled = false;
    return getAllPlansFromDatabase(userId)
        .then(data => {
            const plans = Array.isArray(data) ? data.map(normalizePlan).filter(Boolean) : [];
            renderPlanOptions(plans, false);
            persistPlanCache();
            const selected = activePlanId && planCache.has(activePlanId) ? activePlanId : null;
            if (selected) {
                loadPlan.value = selected;
                return loadPlanById(selected).then(() => plans);
            }
            if (activePlanId) setActivePlan(null);
            return plans;
        })
        .catch(() => {
            if (!cachedPlans.length) loadPlan.replaceChildren(option('', t('cwl.noPlan')));
            return cachedPlans;
        });
}

function renderPlanOptions(plans, isSnapshot) {
    const normalized = plans.map(normalizePlan).filter(Boolean);
    loadPlan.replaceChildren(option('', normalized.length ? t('cwl.selectPlan') : t('cwl.noPlan')));
    normalized.forEach(plan => {
        planCache.set(plan.id, plan);
        if (plan.revision != null) planRevisions.set(plan.id, plan.revision);
        loadPlan.appendChild(option(plan.id, plan.name));
    });
    if (isSnapshot && activePlanId && planCache.has(activePlanId)) loadPlan.value = activePlanId;
}

function readPlanCache() {
    try {
        const parsed = JSON.parse(localStorage.getItem(PLAN_CACHE_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function persistPlanCache() {
    localStorage.setItem(PLAN_CACHE_KEY, JSON.stringify([...planCache.values()]));
}

export function loadPlanListener() {
    loadPlan.addEventListener('change', event => {
        const planId = cleanPlanId(event.target.value);
        if (planId) void loadPlanById(planId);
    });
}

export async function loadPlanById(planId) {
    const token = ++activeLoadToken;
    planContextToken += 1;
    activeLoadController?.abort();
    activeLoadController = new AbortController();
    suppressSave = true;
    setCanAutosave(false);
    setLoading(true);
    setSaveStatus('idle');
    setActivePlan(planId);

    try {
        const cached = planCache.get(planId);
        const data = cached?.info
            ? cached
            : normalizePlan(await getPlanFromDatabase(planId, { signal: activeLoadController.signal }));
        if (token !== activeLoadToken || !data) return;
        const normalized = normalizePlan(data);
        if (!normalized?.info) throw new Error('Ongeldig plan');
        planCache.set(normalized.id, normalized);
        if (normalized.revision != null) planRevisions.set(normalized.id, normalized.revision);
        renderPlanSnapshot(normalized, token);
        void enrichPlanSnapshot(normalized.info, token, activeLoadController.signal);
    } catch (error) {
        if (error?.name !== 'AbortError' && token === activeLoadToken) setSaveStatus('error');
    } finally {
        if (token !== activeLoadToken) return;
        setLoading(false);
        setCanAutosave(true);
        suppressSave = false;
        window.dispatchEvent(new CustomEvent('clashtools:cwl-plan-loaded'));
    }
}

function renderPlanSnapshot(plan, token) {
    availablePlayers.replaceChildren();
    allClans.replaceChildren();
    totalPlayerAmount.textContent = '0';
    planName.value = plan.name || '';
    const info = normalizePlanDocument(plan.info);
    info.freePlayers.forEach(player => {
        if (token === activeLoadToken) createPlayerCard(player, null);
    });
    info.clans.forEach(clan => {
        if (token !== activeLoadToken) return;
        createClanCard({
            tag: clan.tag,
            name: clan.name,
            badgeUrls: { small: clan.badgeUrl }
        }, clan.capacity, clan.id);
        clan.players.forEach(player => createPlayerCard(player, clan.id));
    });
    window.dispatchEvent(new CustomEvent('clashtools:cwl-plan-meta-loaded', {
        detail: info.pollMeta
    }));
}

function needsPlayerEnrichment(player) {
    const tag = normalizeTag(player?.tag);
    const name = String(player?.name || '').trim();
    const townHallLevel = Number(player?.townHallLevel);

    return Boolean(tag) && (
        !name ||
        name === tag ||
        !Number.isFinite(townHallLevel) ||
        townHallLevel < 1
    );
}

async function enrichPlanSnapshot(info, token, signal) {
    const planDocument = normalizePlanDocument(info);

    const playerTags = new Set(
        [
            ...planDocument.freePlayers,
            ...planDocument.clans.flatMap(clan => clan.players)
        ]
            .filter(needsPlayerEnrichment)
            .map(player => normalizeTag(player.tag))
            .filter(Boolean)
    );

    const clanTasks = planDocument.clans
        .filter(clan => normalizeTag(clan?.tag))
        .map(clan => () => enrichClan(clan, token, signal));

    const playerTasks = [...playerTags]
        .map(tag => () => enrichPlayer(tag, token, signal));

    await runLimited(
        [...clanTasks, ...playerTasks],
        ENRICH_CONCURRENCY
    );
}

async function enrichPlayer(tag, token, signal) {
    try {
        const data = await getPlayerBasicData(tag, { signal });
        if (token !== activeLoadToken) return;
        const normalizedTag = normalizeTag(tag);
        const cards = Array.from(
            document.querySelectorAll('.cwl-player-article[data-planner-card="true"]')
        ).filter(element => getCardTag(element) === normalizedTag);

        cards.forEach(card => {
            const name = card.querySelector('.cwl-player-name');
            const clan = card.querySelector('.cwl-player-clan');
            const townHallLevel = Number(data.townHallLevel) || 1;

            if (name) name.textContent = data.name || tag;
            if (clan) clan.textContent = data.clanName || t('cwl.noClan');
            card.dataset.townHall = String(townHallLevel);

            const image = card.querySelector('.cwl-player-townhall-foto');
            if (image) {
                image.src = `../assets/css/pictures/townhalls/Town_Hall${townHallLevel}.png`;
            }
        });
    } catch (error) {
        if (error?.name !== 'AbortError') return;
    }
}

async function enrichClan(clan, token, signal) {
    try {
        const data = await getClanInfoRequest(clan.tag, { signal });
        if (token !== activeLoadToken) return;
        const card = document.querySelector(`#cwl-clan-template_${CSS.escape(clan.id)}`);
        if (!card) return;
        const clanName = data.name || clan.name || clan.tag || t('cwl.clan');
        const clanTag = normalizeTag(data.tag || clan.tag);
        const leagueName = data?.warLeague?.name || '';
        card.dataset.clanName = clanName;
        card.dataset.clanTag = clanTag;
        card.querySelector('.cwl-clan-name').textContent = clanName;
        card.querySelector('.cwl-clan-tag').textContent = clanTag;
        card.querySelector('.cwl-clan-league').textContent = leagueName ? ` · ${leagueName}` : '';
        const badge = data?.badgeUrls?.small;
        const logo = card.querySelector('.cwl-clan-logo');
        if (badge) logo.src = badge;
        logo.alt = clanName;
    } catch (error) {
        if (error?.name !== 'AbortError') return;
    }
}

async function runLimited(tasks, concurrency) {
    let cursor = 0;
    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
        while (cursor < tasks.length) {
            const task = tasks[cursor++];
            await task();
        }
    });
    await Promise.allSettled(workers);
}

export function startNewPlan() {
    activeLoadToken += 1;
    planContextToken += 1;
    activeLoadController?.abort();
    suppressSave = true;
    setCanAutosave(false);
    setActivePlan(null);
    loadPlan.value = '';
    planName.value = '';
    availablePlayers.replaceChildren();
    allClans.replaceChildren();
    totalPlayerAmount.textContent = '0';
    setSaveStatus('idle');
    suppressSave = false;
    setCanAutosave(false);
    window.dispatchEvent(new CustomEvent('clashtools:cwl-plan-loaded'));
}

function setActivePlan(planId) {
    activePlanId = cleanPlanId(planId);
    if (activePlanId) localStorage.setItem(ACTIVE_PLAN_KEY, activePlanId);
    else localStorage.removeItem(ACTIVE_PLAN_KEY);
}

function upsertPlanOption(planId, name) {
    let planOption = Array.from(loadPlan.options).find(item => item.value === planId);
    if (!planOption) {
        planOption = option(planId, name);
        loadPlan.appendChild(planOption);
    }
    planOption.textContent = name;
    if (activePlanId === planId) loadPlan.value = planId;
}

function option(value, text) {
    const element = document.createElement('option');
    element.value = value;
    element.textContent = text;
    return element;
}
