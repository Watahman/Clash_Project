import { getPlayerAvailability } from './cwl-availability.js';
import { getCardTag } from './cwl-utils.js';
import { t } from '../i18n/i18n.js';
import { PLANNER_DAYS } from './cwl-planner-schedule-model.js';

export function getPlannerDayAssignmentValidation(card, day) {
    const availability = getPlayerAvailability(getCardTag(card));
    if (availability.state === 'no') {
        return { legal: false, reason: t('cwl.notAvailableCwl') };
    }
    if (availability.state === 'partial' && !availability.availableDays.includes(day)) {
        return {
            legal: false,
            reason: t('cwl.partialAvailabilityTooltip', {
                available: availability.availableDays.join(', '),
                unavailable: PLANNER_DAYS
                    .filter(item => !availability.availableDays.includes(item))
                    .join(', ')
            })
        };
    }
    if (availability.state === 'yes' && !availability.availableDays.includes(day)) {
        return { legal: false, reason: t('cwl.noPollData') };
    }
    return { legal: true, reason: '' };
}

export function getPlannerDayDropValidation(card, target) {
    if (!target?.matches?.('.cwl-day-dropzone')) {
        return { legal: true, reason: '' };
    }
    const day = Number(target.dataset.day);
    if (!card || !PLANNER_DAYS.includes(day)) {
        return { legal: false, reason: t('cwl.noPollData') };
    }
    return getPlannerDayAssignmentValidation(card, day);
}
