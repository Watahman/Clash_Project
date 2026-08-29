const DEFAULT_AUTOSAVE_DELAY_MS = 500;

export function createPlannerSaveController({
    autosaveDelayMs = DEFAULT_AUTOSAVE_DELAY_MS,
    setStatus,
    setPlanToDatabase,
    matchesAuth,
    clearRecovery,
    resolvePlanId,
    planCache,
    planRevisions,
    upsertPlanOption,
    persistPlannerCache,
    getActivePlanId,
    setActivePlan,
    getPlanContextToken,
    clearGuestDraftAfterCloudSave,
    showPlanLimitFeedback,
    recordUndoSnapshot
} = {}) {
    let debounceTimer;
    let pendingSave;
    let saveQueue = Promise.resolve();
    let saveStatusTimer;
    let saveSequence = 0;

    function nextRecoveryId() {
        return `${Date.now()}-${++saveSequence}`;
    }

    function enqueue(job, { immediate = false, snapshot, skipHistory = false } = {}) {
        if (debounceTimer) clearTimeout(debounceTimer);
        if (!pendingSave) pendingSave = { resolvers: [] };
        recordUndoSnapshot?.(snapshot, skipHistory === true);
        pendingSave.job = job;
        const promise = new Promise(resolve => pendingSave.resolvers.push(resolve));
        debounceTimer = setTimeout(flush, immediate ? 0 : autosaveDelayMs);
        return promise;
    }

    function flush() {
        if (!pendingSave?.job) return;
        const batch = pendingSave;
        pendingSave = null;
        debounceTimer = null;
        setStatus?.('saving');
        saveQueue = saveQueue
            .catch(() => null)
            .then(() => persistSave(batch.job))
            .then(result => {
                batch.resolvers.forEach(resolve => resolve(result));
                return result;
            });
    }

    function cancel() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = null;
        pendingSave?.resolvers.forEach(resolve => resolve(null));
        pendingSave = null;
    }

    async function persistSave(job) {
        if (!matchesAuth(job.userId, job.authGeneration)) {
            clearRecovery(job.recoveryId, job.userId);
            return null;
        }
        try {
            const data = await setPlanToDatabase(
                job.userId,
                job.planId,
                job.name,
                job.info,
                job.revision
            );
            if (!matchesAuth(job.userId, job.authGeneration)) return null;
            const savedId = resolvePlanId(data?.uuid || data?.id || job.planId);
            const revision = Number(data?.revision || job.revision || 1);
            if (savedId) updateSavedPlan(job, savedId, revision);
            clearGuestDraftAfterCloudSave();
            clearRecovery(job.recoveryId, job.userId);
            clearTimeout(saveStatusTimer);
            saveStatusTimer = setTimeout(() => setStatus?.('idle'), 700);
            return data;
        } catch (error) {
            if (error?.code === 'PLAN_LIMIT_REACHED') showPlanLimitFeedback?.();
            else setStatus?.(error?.status === 409 ? 'conflict' : 'error');
            return null;
        }
    }

    function updateSavedPlan(job, savedId, revision) {
        planRevisions.set(savedId, revision);
        planCache.set(savedId, {
            id: savedId,
            uuid: savedId,
            name: job.name,
            info: job.info,
            revision,
            isOwner: true
        });
        upsertPlanOption(savedId, job.name);
        persistPlannerCache(planCache.values());
        if (!job.planId && getActivePlanId() === null && job.contextToken === getPlanContextToken()) {
            setActivePlan(savedId);
        }
    }

    function clearStatusTimer() {
        clearTimeout(saveStatusTimer);
    }

    return { enqueue, flush, cancel, nextRecoveryId, clearStatusTimer };
}
