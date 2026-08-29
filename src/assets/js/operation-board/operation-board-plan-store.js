import {
    fetchPlan,
    fetchPlans
} from './operation-board-source.js?v=20260829-public-auth-v1';

export function createOperationPlanStore() {
    const cacheByUser = new Map();
    let activeUserId = '';
    let activeGeneration = 0;

    function setIdentity(userId = '', generation = activeGeneration + 1) {
        activeUserId = String(userId || '').trim();
        activeGeneration = Number.isFinite(generation) ? generation : activeGeneration + 1;
        cacheByUser.clear();
        return getIdentity();
    }

    function getIdentity() {
        return { userId: activeUserId, generation: activeGeneration };
    }

    function isCurrent(identity) {
        return identity?.generation === activeGeneration
            && identity?.userId === activeUserId
            && Boolean(activeUserId);
    }

    function ensureIdentity(userId) {
        const normalizedUserId = String(userId || '').trim();
        if (!normalizedUserId) return null;
        if (activeUserId && activeUserId !== normalizedUserId) return null;
        if (!activeUserId) activeUserId = normalizedUserId;
        return getIdentity();
    }

    function getCache(userId) {
        if (!cacheByUser.has(userId)) cacheByUser.set(userId, new Map());
        return cacheByUser.get(userId);
    }

    return {
        setIdentity,
        getIdentity,
        clear() {
            cacheByUser.clear();
        },
        async load(userId) {
            const identity = ensureIdentity(userId);
            if (!identity) return [];
            const plans = await fetchPlans(userId);
            if (!isCurrent(identity)) return [];
            const cache = getCache(identity.userId);
            plans.forEach(plan => {
                cache.set(plan.id, plan);
                void resolvePlan(plan.id, identity);
            });
            return plans;
        },
        async resolve(planId) {
            return resolvePlan(planId, getIdentity());
        },
        add(plan) {
            if (plan?.id && activeUserId) getCache(activeUserId).set(plan.id, plan);
            return plan;
        }
    };

    async function resolvePlan(planId, identity) {
        if (!isCurrent(identity)) return null;
        const plan = getCache(identity.userId).get(planId);
        if (!plan) return null;
        try {
            const full = await fetchPlan(plan);
            if (!isCurrent(identity)) return null;
            getCache(identity.userId).set(plan.id, full);
            return full;
        } catch (error) {
            console.error(error);
            return isCurrent(identity) ? plan : null;
        }
    }
}
