import { canAutosave, isLoading, setLoading, setCanAutosave } from '../Data/config.js';
import { createPlayerCard, createClanCard } from '../templates/CWLTemplates.js?v=20260830-card-settings';
import { getAllPlansFromDatabase, getPlanFromDatabase, setPlanToDatabase } from '../Supabase/Supabase-Plan.js?v=20260829-public-auth-v1';
import { getCurrentUserId } from '../utils/user.js';
import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { clearActiveCwlPoll } from './cwl-availability.js?v=20260829-public-auth-v1';
import { hasReachedPlanLimit } from './cwl-plan-limits.js';
import { normalizePlanDocument } from './cwl-plan-schema.js';
import { enrichPlanSnapshot as enrichPlanData } from './cwl-plan-enrichment.js?v=20260830-card-settings';
import { installPlannerLifecycle } from './cwl-planner-lifecycle.js?v=20260829-public-auth-v1';
import { mergePlanRecovery } from './cwl-planner-recovery.js?v=20260829-public-auth-v1';
import { createPlannerSaveController } from './cwl-planner-save-controller.js?v=20260829-public-auth-v1';
import {
    cleanPlanId,
    createCurrentPlanSnapshot,
    normalizePlan,
    serializePlanDocument
} from './cwl-plan-serialization.js?v=20260829-public-auth-v1';
import * as guestPlanner from './cwl-planner-guest-storage.js?v=20260829-public-auth-v1';
const UNDO_HISTORY_LIMIT = 20;

let availablePlayers;
let allClans;
let totalPlayerAmount;
let planName;
let loadPlan;
let saveStatus;
let planLimitFeedback;
const planCache = new Map();
const planRevisions = new Map();
let activeLoadToken = 0;
let planContextToken = 0;
let activeLoadController;
let activePlanId = null;
let suppressSave = false;
let saveController;
let undoHistory = [];
let lastUndoSnapshot = null;

function syncUndoState() {
    window.dispatchEvent(new CustomEvent('clashtools:cwl-undo-state', {
        detail: { canUndo: undoHistory.length > 0 }
    }));
}

function snapshotFingerprint(snapshot) {
    return JSON.stringify(snapshot);
}

function resetUndoHistory(snapshot = null) {
    undoHistory = [];
    lastUndoSnapshot = snapshot;
    syncUndoState();
}

function recordUndoSnapshot(snapshot, skipHistory = false) {
    if (lastUndoSnapshot && snapshotFingerprint(lastUndoSnapshot) !== snapshotFingerprint(snapshot) && !skipHistory) {
        undoHistory.push(lastUndoSnapshot);
        if (undoHistory.length > UNDO_HISTORY_LIMIT) undoHistory.shift();
    }
    lastUndoSnapshot = snapshot;
    syncUndoState();
}

export function initPlanIO(refs) {
    availablePlayers = refs.availablePlayers;
    allClans = refs.allClans;
    totalPlayerAmount = refs.totalPlayerAmount;
    planName = refs.planName;
    loadPlan = refs.loadPlan;
    saveStatus = document.querySelector('#cwl-save-status');
    planLimitFeedback = document.querySelector('#cwl-plan-limit-feedback');
    guestPlanner.configureGuestPlanner({ authState: refs.authState, fallbackUserId: getCurrentUserId(), loadPlan,
        renderPlanOptions, clearCurrentPlan: () => { activePlanId = null; },
        renderSnapshot: (snapshot, token) => { suppressSave = true; renderPlanSnapshot(snapshot, token); suppressSave = false; },
        nextLoadToken: () => ++activeLoadToken, setAutosave: setCanAutosave, setStatus: setSaveStatus,
        resetUndoHistory,
        notify: () => window.dispatchEvent(new CustomEvent('clashtools:cwl-plan-loaded')) });
    activePlanId = cleanPlanId(guestPlanner.readActivePlannerId());
    saveController = createPlannerSaveController({
        setStatus: setSaveStatus,
        setPlanToDatabase,
        matchesAuth: guestPlanner.matchesPlannerAuth,
        clearRecovery: guestPlanner.clearPlannerRecovery,
        resolvePlanId: cleanPlanId,
        planCache,
        planRevisions,
        upsertPlanOption,
        persistPlannerCache: guestPlanner.persistPlannerCache,
        getActivePlanId: () => activePlanId,
        setActivePlan,
        getPlanContextToken: () => planContextToken,
        clearGuestDraftAfterCloudSave: guestPlanner.clearGuestPlannerDraftAfterCloudSave,
        showPlanLimitFeedback,
        recordUndoSnapshot
    });
    hidePlanLimitFeedback();
    setSaveStatus(guestPlanner.hasCloudPlannerAccess() ? 'idle' : 'guest');
    installPlannerLifecycle({
        shouldWarnBeforeUnload: guestPlanner.shouldWarnBeforeUnload,
        flushPendingSave: () => saveController?.flush()
    });
    resetUndoHistory({ name: '', info: serializePlan() });
    guestPlanner.bindPlannerAuthTransitions(refs.authState, handlePlannerAuthTransition);
}

function handlePlannerAuthTransition() {
    saveController?.cancel();
    activeLoadToken += 1;
    planContextToken += 1;
    activeLoadController?.abort();
    activePlanId = cleanPlanId(guestPlanner.readActivePlannerId());
    clearRenderedPlan();
    planCache.clear();
    planRevisions.clear();
    void loadAllPlans();
}

function clearRenderedPlan() {
    suppressSave = true;
    availablePlayers?.replaceChildren();
    allClans?.replaceChildren();
    if (totalPlayerAmount) totalPlayerAmount.textContent = '0';
    if (planName) planName.value = '';
    if (loadPlan) {
        loadPlan.value = '';
        loadPlan.replaceChildren(option('', t('cwl.noPlan')));
        loadPlan.disabled = true;
    }
    activePlanId = null;
    clearActiveCwlPoll();
    resetUndoHistory();
    window.dispatchEvent(new CustomEvent('clashtools:cwl-plan-meta-loaded', {
        detail: { groupId: '', pollId: '' }
    }));
    window.dispatchEvent(new CustomEvent('clashtools:cwl-plan-loaded'));
    suppressSave = false;
}

function setSaveStatus(state) {
    if (!saveStatus) return;
    saveStatus.dataset.state = state;
    saveStatus.textContent = t(guestPlanner.getPlannerSaveStatusKey(state));
}

function showPlanLimitFeedback() {
    saveController?.clearStatusTimer();
    setSaveStatus('error');
    if (!planLimitFeedback) return;
    planLimitFeedback.textContent = t('cwl.planLimitReached');
    planLimitFeedback.hidden = false;
}

function hidePlanLimitFeedback() {
    if (!planLimitFeedback) return;
    planLimitFeedback.hidden = true;
}

function isNewPlanAtLimit() {
    return !activePlanId && hasReachedPlanLimit(planCache.values());
}

function serializePlan({ persistCache = true } = {}) {
    return serializePlanDocument({
        availablePlayers,
        allClans,
        persistCache,
        persistCacheIfAllowed: guestPlanner.persistPlannerCacheIfAllowed
    });
}

export function getCurrentPlanSnapshot({ now } = {}) {
    return createCurrentPlanSnapshot({
        availablePlayers,
        allClans,
        planName,
        now,
        persistCacheIfAllowed: guestPlanner.persistPlannerCacheIfAllowed
    });
}

export function savePlan(options = {}) {
    const immediate = options.immediate === true;
    const { userId, isGuest } = guestPlanner.getPlannerSaveContext();
    if (isLoading || suppressSave || !canAutosave) return Promise.resolve(null);

    const enteredName = planName.value.trim();
    const name = enteredName || t('cwl.defaultPlanName');
    if (name.length > 40) {
        setSaveStatus('error');
        return Promise.resolve(null);
    }
    if (!enteredName) {
        planName.value = name;
        window.dispatchEvent(new CustomEvent(
            'clashtools:cwl-plan-name-defaulted',
            { detail: { name } }
        ));
    }

    if (isNewPlanAtLimit()) {
        showPlanLimitFeedback();
        return Promise.resolve(null);
    }

    hidePlanLimitFeedback();

    let info;
    try {
        info = serializePlan({ persistCache: !isGuest });
    } catch {
        setSaveStatus('error');
        return Promise.resolve(null);
    }

    if (isGuest) return Promise.resolve(
        guestPlanner.persistGuestPlannerDraft(name, info, options.skipHistory)
    );

    const job = {
        userId,
        planId: activePlanId,
        name,
        info,
        revision: activePlanId ? planRevisions.get(activePlanId) ?? null : null,
        contextToken: planContextToken,
        authGeneration: guestPlanner.getPlannerAuthGeneration(),
        recoveryId: saveController.nextRecoveryId()
    };
    guestPlanner.persistPlannerRecovery(job);

    return saveController.enqueue(job, {
        immediate,
        snapshot: { name, info },
        skipHistory: options.skipHistory
    });
}

export function loadAllPlans() {
    planCache.clear();
    planRevisions.clear();
    return guestPlanner.loadPlannerPlans(loadCloudPlans);
}

function loadCloudPlans(userId, restoredGuestDraft, generation) {
    if (!guestPlanner.isCurrentPlannerGeneration(generation)) return Promise.resolve([]);
    const recovery = guestPlanner.readPlannerRecovery(userId);
    const cachedPlans = mergePlanRecovery(guestPlanner.readPlannerCache(), recovery);
    renderPlanOptions(cachedPlans, true);
    loadPlan.disabled = false;
    return getAllPlansFromDatabase(userId)
        .then(data => {
            if (!guestPlanner.isCurrentPlannerGeneration(generation)) return [];
            const plans = mergePlanRecovery(
                Array.isArray(data) ? data.map(normalizePlan).filter(Boolean) : [],
                recovery
            );
            renderPlanOptions(plans, false);
            guestPlanner.persistPlannerCache(planCache.values());
            const selected = activePlanId && planCache.has(activePlanId) ? activePlanId : null;
            if (selected && !restoredGuestDraft) {
                loadPlan.value = selected;
                return loadPlanById(selected).then(() => plans);
            }
            if (activePlanId) setActivePlan(null);
            if (!restoredGuestDraft && recovery && !recovery.planId) restoreNewPlanRecovery(recovery);
            if (!restoredGuestDraft) setSaveStatus('idle');
            return plans;
        })
        .catch(() => {
            if (!guestPlanner.isCurrentPlannerGeneration(generation)) return [];
            if (!cachedPlans.length) loadPlan.replaceChildren(option('', t('cwl.noPlan')));
            if (!restoredGuestDraft && recovery && !recovery.planId) restoreNewPlanRecovery(recovery);
            return cachedPlans;
        });
}

function restoreNewPlanRecovery(recovery) {
    suppressSave = true;
    setActivePlan(null);
    loadPlan.value = '';
    renderPlanSnapshot({ name: recovery.name, info: recovery.info }, ++activeLoadToken);
    suppressSave = false;
    setCanAutosave(true);
    window.dispatchEvent(new CustomEvent('clashtools:cwl-plan-loaded'));
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

export function loadPlanListener() {
    loadPlan.addEventListener('change', event => {
        const planId = cleanPlanId(event.target.value);
        if (planId) void loadPlanById(planId);
    });
}

export async function loadPlanById(planId) {
    if (guestPlanner.blockGuestCloudLoad(setSaveStatus)) return;
    const token = ++activeLoadToken;
    const previousPlanId = activePlanId;
    const previousAutosaveState = canAutosave;
    let loadSucceeded = false;
    planContextToken += 1;
    activeLoadController?.abort();
    activeLoadController = new AbortController();
    suppressSave = true;
    setCanAutosave(false);
    setLoading(true);
    hidePlanLimitFeedback();
    setSaveStatus('idle');
    setActivePlan(planId);

    try {
        const cached = planCache.get(planId);
        const data = cached?.info
            ? cached
            : normalizePlan(await getPlanFromDatabase(planId, { signal: activeLoadController.signal }));
        if (token !== activeLoadToken || !data) return;
        const normalized = normalizePlan(data);
        if (!normalized?.info) throw new Error('Invalid plan');
        planCache.set(normalized.id, normalized);
        if (normalized.revision != null) planRevisions.set(normalized.id, normalized.revision);
        renderPlanSnapshot(normalized, token);
        resetUndoHistory({ name: normalized.name, info: normalizePlanDocument(normalized.info) });
        loadSucceeded = true;
        void enrichPlanData(normalized.info, {
            token,
            signal: activeLoadController.signal,
            isCurrent: currentToken => currentToken === activeLoadToken
        });
    } catch (error) {
        if (error?.name !== 'AbortError' && token === activeLoadToken) {
            setActivePlan(previousPlanId);
            if (loadPlan) loadPlan.value = previousPlanId || '';
            setSaveStatus('error');
        }
    } finally {
        if (token === activeLoadToken) {
            setLoading(false);
            setCanAutosave(loadSucceeded ? true : previousAutosaveState);
            suppressSave = false;
            if (loadSucceeded) {
                window.dispatchEvent(new CustomEvent('clashtools:cwl-plan-loaded'));
            }
        }
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
            badgeUrls: { small: clan.badgeUrl },
            clanPriority: clan.clanPriority
        }, clan.capacity, clan.id);
        clan.players.forEach(player => createPlayerCard(player, clan.id));
    });
    window.dispatchEvent(new CustomEvent('clashtools:cwl-plan-meta-loaded', {
        detail: info.pollMeta
    }));
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
    hidePlanLimitFeedback();
    guestPlanner.prepareNewPlanner(setSaveStatus);
    suppressSave = false;
    setCanAutosave(false);
    resetUndoHistory({ name: '', info: serializePlan() });
    window.dispatchEvent(new CustomEvent('clashtools:cwl-plan-loaded'));
}

export function undoLastPlanChange() {
    if (!undoHistory.length || isLoading) return Promise.resolve(false);
    saveController?.flush();
    const snapshot = undoHistory.pop();
    const token = ++activeLoadToken;
    suppressSave = true;
    renderPlanSnapshot(snapshot, token);
    suppressSave = false;
    setCanAutosave(true);
    lastUndoSnapshot = snapshot;
    syncUndoState();
    window.dispatchEvent(new CustomEvent('clashtools:cwl-plan-loaded'));
    return savePlan({ immediate: true, skipHistory: true }).then(() => true);
}

function setActivePlan(planId) {
    activePlanId = cleanPlanId(planId);
    guestPlanner.persistActivePlannerId(activePlanId);
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
