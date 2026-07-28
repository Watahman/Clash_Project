export const MAX_SAVED_PLANS = 3;

export function countOwnedPlans(plans) {
    return Array.from(plans || [])
        .filter(plan => plan?.isOwner !== false)
        .length;
}

export function hasReachedPlanLimit(plans) {
    return countOwnedPlans(plans) >= MAX_SAVED_PLANS;
}
