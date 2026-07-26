import {
    fetchPlan,
    fetchPlans
} from './operation-board-source.js';

export function createOperationPlanStore() {
    const cache = new Map();

    return {
        async load(userId) {
            const plans = await fetchPlans(userId);
            plans.forEach(plan => {
                cache.set(plan.id, plan);
                void resolve(plan.id);
            });
            return plans;
        },
        async resolve(planId) {
            return resolve(planId);
        },
        add(plan) {
            if (plan?.id) cache.set(plan.id, plan);
            return plan;
        }
    };

    async function resolve(planId) {
        const plan = cache.get(planId);
        if (!plan) return null;
        try {
            const full = await fetchPlan(plan);
            cache.set(plan.id, full);
            return full;
        } catch (error) {
            console.error(error);
            return plan;
        }
    }
}
