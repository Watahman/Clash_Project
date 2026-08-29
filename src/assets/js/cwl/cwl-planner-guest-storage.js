import { normalizePlanDocument } from './cwl-plan-schema.js';
import * as plannerAuth from './cwl-planner-auth-context.js?v=20260829-public-auth-v1';
import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';

const GUEST_DRAFT_KEY = 'clashpanel:guest:planner:current';
const GUEST_DRAFT_VERSION = 1;
const SAVE_STATUS_KEYS = Object.freeze({
    guest: 'planner.guestStored', saving: 'cwl.saving', error: 'cwl.saveError',
    conflict: 'cwl.saveConflict', idle: 'cwl.saved'
});

let activeGuestDraft = false;
let guestIntegration = {};

function storage() {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
}

function asDraft(value) {
    if (!value || typeof value !== 'object' || value.version !== GUEST_DRAFT_VERSION) return null;
    if (!value.info || typeof value.info !== 'object') return null;
    return {
        version: GUEST_DRAFT_VERSION,
        name: String(value.name || '').trim(),
        info: normalizePlanDocument(value.info),
        savedAt: String(value.savedAt || '')
    };
}

export function getPlannerSaveContext() {
    const userId = plannerAuth.getCloudPlannerUserId();
    return { userId, isGuest: !userId };
}

export function readPlannerCache() {
    const key = getPlannerStorageKey('cache');
    if (!key) return [];
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function persistPlannerCache(plans) {
    const key = getPlannerStorageKey('cache');
    if (key) localStorage.setItem(key, JSON.stringify([...plans]));
}

export function persistPlannerRecovery(job) {
    const key = getPlannerStorageKey('recovery', job.userId);
    if (!key) return;
    try {
        localStorage.setItem(key, JSON.stringify({
            version: 1, recoveryId: job.recoveryId, userId: job.userId,
            planId: job.planId, name: job.name, info: job.info,
            revision: job.revision, savedAt: new Date().toISOString()
        }));
    } catch {
        // The normal server save still proceeds if browser storage is unavailable.
    }
}

function cleanPlannerId(value) {
    const id = String(value || '').trim();
    return id && id !== 'undefined' && id !== 'null' ? id : null;
}

export function readPlannerRecovery(userId) {
    const key = getPlannerStorageKey('recovery', userId);
    if (!key) return null;
    try {
        const recovery = JSON.parse(localStorage.getItem(key) || 'null');
        if (!recovery || recovery.version !== 1 || recovery.userId !== userId) return null;
        if (!recovery.info || typeof recovery.info !== 'object') return null;
        return {
            ...recovery,
            planId: cleanPlannerId(recovery.planId),
            name: String(recovery.name || t('cwl.defaultPlanName')).trim(),
            info: normalizePlanDocument(recovery.info),
            revision: Number.isFinite(Number(recovery.revision)) ? Number(recovery.revision) : null
        };
    } catch {
        return null;
    }
}

export function clearPlannerRecovery(recoveryId = null, userId = '') {
    const key = getPlannerStorageKey('recovery', userId);
    if (!key) return;
    try {
        if (recoveryId) {
            const current = JSON.parse(localStorage.getItem(key) || 'null');
            if (current?.recoveryId !== recoveryId) return;
        }
        localStorage.removeItem(key);
    } catch {
        // Ignore unavailable or malformed browser storage.
    }
}

export const hasCloudPlannerAccess = plannerAuth.hasCloudPlannerAccess;
export const getCloudPlannerUserId = plannerAuth.getCloudPlannerUserId;
export const getPlannerAuthIdentity = plannerAuth.getPlannerAuthIdentity;
export const getPlannerAuthGeneration = plannerAuth.getPlannerAuthGeneration;
export const getPlannerStorageKey = plannerAuth.getPlannerStorageKey;

export function readGuestPlannerDraft() {
    try {
        const raw = storage()?.getItem(GUEST_DRAFT_KEY);
        return raw ? asDraft(JSON.parse(raw)) : null;
    } catch {
        return null;
    }
}

export function writeGuestPlannerDraft({ name, info, now = Date.now() } = {}) {
    const target = storage();
    if (!target || !info || typeof info !== 'object') return false;
    try {
        target.setItem(GUEST_DRAFT_KEY, JSON.stringify({
            version: GUEST_DRAFT_VERSION,
            name: String(name || '').trim(),
            info,
            savedAt: new Date(now).toISOString()
        }));
        return true;
    } catch {
        return false;
    }
}

export function clearGuestPlannerDraft() {
    try {
        storage()?.removeItem(GUEST_DRAFT_KEY);
    } catch {
        // Ignore unavailable browser storage.
    }
}

export function getGuestPlannerStorageKey() {
    return GUEST_DRAFT_KEY;
}

export function getPlannerSaveStatusKey(state) {
    return SAVE_STATUS_KEYS[state] || SAVE_STATUS_KEYS.idle;
}

export function configureGuestPlanner(options = {}) {
    plannerAuth.configurePlannerAuth(options);
    guestIntegration = {
        ...options,
        authContext: options.authState ?? null
    };
}

export function updateGuestPlannerAuth(authState) {
    guestIntegration.authContext = authState || null;
    plannerAuth.updatePlannerAuth(authState);
}

export function bindPlannerAuthTransitions(initialState, onTransition) {
    plannerAuth.bindPlannerAuthTransitions(initialState, nextState => {
        guestIntegration.authContext = nextState || null;
        onTransition?.(nextState);
    });
}

export function matchesPlannerAuth(userId, generation) {
    return plannerAuth.matchesPlannerAuth(userId, generation);
}

export function isCurrentPlannerGeneration(generation) {
    return plannerAuth.isCurrentPlannerGeneration(generation);
}

export function restoreGuestPlannerDraft(draft) {
    if (!draft || !guestIntegration.loadPlan) return false;
    const snapshot = { name: draft.name, info: draft.info };
    activeGuestDraft = true;
    guestIntegration.clearCurrentPlan?.();
    guestIntegration.loadPlan.value = '';
    guestIntegration.renderSnapshot?.(snapshot, guestIntegration.nextLoadToken?.());
    guestIntegration.setAutosave?.(true);
    guestIntegration.setStatus?.('guest');
    guestIntegration.resetUndoHistory?.(snapshot);
    guestIntegration.notify?.();
    return true;
}

export function initializeGuestPlanner(draft) {
    guestIntegration.clearCurrentPlan?.();
    guestIntegration.renderPlanOptions?.([], true);
    if (guestIntegration.loadPlan) guestIntegration.loadPlan.disabled = true;
    if (restoreGuestPlannerDraft(draft)) return true;
    activeGuestDraft = false;
    guestIntegration.setAutosave?.(true);
    guestIntegration.setStatus?.('guest');
    return false;
}

export function persistGuestPlannerDraft(name, info, skipHistory) {
    const { recordUndoSnapshot, setStatus } = guestIntegration;
    recordUndoSnapshot?.({ name, info }, skipHistory === true);
    const stored = writeGuestPlannerDraft({ name, info });
    setStatus?.(stored ? 'guest' : 'error');
    return stored ? { local: true } : null;
}

export function clearGuestPlannerDraftAfterCloudSave() {
    if (!activeGuestDraft) return;
    clearGuestPlannerDraft();
    activeGuestDraft = false;
}

export function persistPlannerCacheIfAllowed(persistCache, info) {
    if (!persistCache || !hasCloudPlannerAccess()) return;
    const players = [...info.freePlayers, ...info.clans.flatMap(clan => clan.players)];
    const key = getPlannerStorageKey('players');
    if (key) localStorage.setItem(key, JSON.stringify(players));
}

export function prepareNewPlanner(setStatus) {
    const canUseCloud = hasCloudPlannerAccess();
    discardGuestPlannerDraftForNewPlan(canUseCloud);
    setStatus?.(canUseCloud ? 'idle' : 'guest');
}

export function persistActivePlannerId(planId) {
    const key = getPlannerStorageKey('active');
    if (!key) return;
    if (planId) localStorage.setItem(key, planId);
    else localStorage.removeItem(key);
}

export function readActivePlannerId() {
    const key = getPlannerStorageKey('active');
    return key ? localStorage.getItem(key) : '';
}

export function shouldWarnBeforeUnload() {
    const userId = getCloudPlannerUserId();
    return Boolean(userId && readPlannerRecovery(userId));
}

export function discardGuestPlannerDraftForNewPlan(canUseCloud) {
    if (!activeGuestDraft && canUseCloud) return;
    clearGuestPlannerDraft();
    activeGuestDraft = false;
}

export function loadPlannerPlans(loadCloudPlans) {
    const draft = readGuestPlannerDraft();
    if (hasCloudPlannerAccess()) {
        const restored = Boolean(draft) && restoreGuestPlannerDraft(draft);
        return loadCloudPlans(getCloudPlannerUserId(), restored, plannerAuth.getPlannerAuthGeneration());
    }
    initializeGuestPlanner(draft);
    return Promise.resolve([]);
}

export function blockGuestCloudLoad(setStatus) {
    if (hasCloudPlannerAccess()) return false;
    setStatus?.('guest');
    return true;
}

export function isGuestPlannerDraftActive() {
    return activeGuestDraft;
}
