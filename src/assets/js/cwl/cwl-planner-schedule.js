import { syncPlayerPlannedDays, syncPlayerRosterStatus } from './cwl-player-controls.js';
import { getCardTag } from './cwl-utils.js';
import { rememberPlannerPlayers, updateAllPlayerCounters } from './cwl-planner-card-state.js';
import { savePlan } from './cwl-plan-io.js';
import { t } from '../i18n/i18n.js';
import { createPlannerScheduleController } from './cwl-planner-schedule-controller.js';
import {
    PLANNER_DAYS,
    plannedDaysForCard
} from './cwl-planner-schedule-model.js';
import {
    getPlannerDayAssignmentValidation,
    getPlannerDayDropValidation
} from './cwl-planner-schedule-rules.js';

export { PLANNER_DAYS, plannedDaysForCard, getPlannerDayAssignmentValidation, getPlannerDayDropValidation };

export function initPlannerSchedule(options = {}) {
    return createPlannerScheduleController(options);
}

export function applyPlannerDayDrop(card, target, { sourceContainer = card?.parentElement } = {}) {
    const validation = getPlannerDayDropValidation(card, target);
    if (!validation.legal) return { ...validation, applied: false };
    const day = Number(target?.dataset?.day);
    const clan = target?.closest?.('.cwl-clan-article');
    const list = clan?.querySelector('.cwl-clan-player-list');
    if (!clan || !list || !PLANNER_DAYS.includes(day)) {
        return { legal: false, applied: false, reason: t('cwl.clansTitle') };
    }

    const previousStatus = card.dataset.rosterStatus;
    list.appendChild(card);
    clearPlannerDaysForContainerChange(card, sourceContainer, list);
    syncPlayerRosterStatus(card, { preferredStatus: previousStatus, autoReserve: true });
    const days = plannedDaysForCard(card);
    if (!days.includes(day)) days.push(day);
    syncPlayerPlannedDays(card, days);
    updateAllPlayerCounters();
    rememberPlannerPlayers();
    dispatchScheduleChange(card, day);
    savePlan();
    return { legal: true, applied: true, day, clanId: clan.id };
}

export function clearPlannerDaysForContainerChange(card, sourceContainer, targetContainer) {
    const sourceClan = sourceContainer?.closest?.('.cwl-clan-article');
    const targetClan = targetContainer?.closest?.('.cwl-clan-article');
    if (sourceClan === targetClan) return false;
    syncPlayerPlannedDays(card, []);
    return true;
}

function dispatchScheduleChange(card, day) {
    const view = card?.ownerDocument?.defaultView || globalThis;
    view.dispatchEvent(new CustomEvent('clashtools:cwl-planner-schedule-changed', {
        detail: { tag: getCardTag(card), day }
    }));
}
