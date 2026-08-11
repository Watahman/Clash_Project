import { normalizePlannedDays } from './cwl-plan-schema.js';
import { getCardTag } from './cwl-utils.js';

export const PLANNER_DAYS = Object.freeze([1, 2, 3, 4, 5, 6, 7]);

export function plannedDaysForCard(card) {
    return normalizePlannedDays(card?.dataset?.plannedDays);
}

export function keepClanSelection(selectedClanId, clans) {
    return clans.some(clan => clan.id === selectedClanId)
        ? selectedClanId
        : clans[0]?.id || '';
}

export function getPlannerPlayers(root) {
    return Array.from(root.querySelectorAll('.cwl-player-article[data-planner-card="true"]'));
}

export function findPlannerCard(root, tag) {
    return getPlannerPlayers(root).find(card => getCardTag(card) === tag) || null;
}
