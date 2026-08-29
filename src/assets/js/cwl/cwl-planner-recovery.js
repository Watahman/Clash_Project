import { cleanPlanId } from './cwl-plan-serialization.js?v=20260829-public-auth-v1';

export function mergePlanRecovery(plans, recovery) {
    if (!recovery?.planId) return plans;
    let found = false;
    const merged = plans.map(plan => {
        if (cleanPlanId(plan.id || plan.uuid) !== recovery.planId) return plan;
        found = true;
        return {
            ...plan,
            id: recovery.planId,
            uuid: recovery.planId,
            name: recovery.name,
            info: recovery.info,
            revision: recovery.revision ?? plan.revision,
            isOwner: true
        };
    });
    if (!found) {
        merged.push({
            id: recovery.planId,
            uuid: recovery.planId,
            name: recovery.name,
            info: recovery.info,
            revision: recovery.revision,
            isOwner: true
        });
    }
    return merged;
}
