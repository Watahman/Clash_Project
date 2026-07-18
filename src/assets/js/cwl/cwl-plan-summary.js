import { normalizePlanDocument } from './cwl-plan-schema.js';

export function summarizePlan(plan = {}) {
    const document = normalizePlanDocument(plan.info ?? plan.planInfo ?? null);
    return {
        ...plan,
        id: String(plan.id || plan.uuid || plan.planId || '').trim(),
        name: String(plan.name || plan.plan_name || '').trim(),
        clanCount: document.clans.length,
        freePlayerCount: document.freePlayers.length,
        updatedAt: plan.updatedAt || plan.updated_at || null,
        isOwner: plan.isOwner !== false
    };
}
