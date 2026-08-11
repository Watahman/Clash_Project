import { savePlan } from './cwl-plan-io.js';
import { normalizeRosterStatus } from './cwl-plan-schema.js';
import { syncPlayerRosterStatus } from './cwl-player-controls.js';
import { rememberPlannerPlayers, updateAllPlayerCounters } from './cwl-planner-card-state.js';
import {
    applyPlannerDayDrop,
    getPlannerDayDropValidation
} from './cwl-planner-schedule.js';

const CONTROL_SELECTOR = '.cwl-delete-player, .cwl-move-player, .cwl-roster-status';

export function makePlayerDraggable(element) {
    let offsetX;
    let offsetY;
    let dragging = false;
    let activeTarget = null;
    element.originalContainer = element.parentElement;
    element.classList.add('draggable');

    element.addEventListener('mousedown', event => {
        if (event.target.closest(CONTROL_SELECTOR)) return;
        event.preventDefault();
        event.stopPropagation();
        if (dragging) return;
        dragging = true;
        element.originalContainer = element.parentElement;
        window.dispatchEvent(new CustomEvent('clashtools:cwl-player-drag-start'));

        const rect = element.getBoundingClientRect();
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;
        const dragLayer = element.closest('.workspace-planner') || document.body;
        element.classList.add('cwl-player-dragging');
        Object.assign(element.style, {
            position: 'fixed',
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            zIndex: '1000',
            pointerEvents: 'none'
        });
        element.style.setProperty('width', `${rect.width}px`, 'important');
        element.style.setProperty('height', `${rect.height}px`, 'important');
        dragLayer.appendChild(element);

        const onMouseMove = moveEvent => {
            element.style.left = `${moveEvent.clientX - offsetX}px`;
            element.style.top = `${moveEvent.clientY - offsetY}px`;
            activeTarget = findDropTarget(moveEvent.clientX, moveEvent.clientY);
            updateDropFeedback(element, activeTarget);
        };
        const onMouseUp = upEvent => {
            dragging = false;
            const previousContainer = element.originalContainer;
            const targetContainer = activeTarget
                || findDropTarget(upEvent.clientX, upEvent.clientY);
            const validation = getPlannerDayDropValidation(element, targetContainer);
            let scheduleDrop = false;
            let dropAllowed = validation.legal;
            let dropReason = validation.reason;
            if (targetContainer?.matches('.cwl-day-dropzone') && validation.legal) {
                const result = applyPlannerDayDrop(element, targetContainer);
                scheduleDrop = Boolean(result.applied);
                dropAllowed = result.legal;
                dropReason = result.reason;
            }
            const finalContainer = scheduleDrop
                ? element.parentElement
                : dropAllowed && !targetContainer?.matches('.cwl-day-dropzone')
                    ? targetContainer || previousContainer
                    : previousContainer;
            const previousStatus = normalizeRosterStatus(element.dataset.rosterStatus);
            if (finalContainer) finalContainer.appendChild(element);
            element.originalContainer = finalContainer;
            if (!scheduleDrop && dropAllowed) syncPlayerRosterStatus(element, {
                preferredStatus: previousStatus,
                autoReserve: Boolean(
                    targetContainer
                    && targetContainer !== previousContainer
                    && targetContainer.matches('.cwl-clan-player-list')
                )
            });
            if (!dropAllowed) announceDropFeedback(dropReason);

            element.classList.remove('cwl-player-dragging');
            clearDropFeedback();
            for (const property of [
                'position', 'left', 'top', 'width', 'height', 'z-index', 'pointer-events'
            ]) {
                element.style.removeProperty(property);
            }
            if (!scheduleDrop && dropAllowed) {
                updateAllPlayerCounters();
                rememberPlannerPlayers();
                window.dispatchEvent(new CustomEvent('clashtools:cwl-player-added'));
                savePlan();
            }
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            activeTarget = null;
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

function findDropTarget(x, y) {
    const lists = document.querySelectorAll(
        '.cwl-clan-player-list, #cwl-available-players, .cwl-day-dropzone'
    );
    for (const list of lists) {
        const rect = list.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            return list;
        }
    }
    return null;
}

function updateDropFeedback(card, target) {
    clearDropFeedback();
    if (!target) return;
    const validation = getPlannerDayDropValidation(card, target);
    target.classList.add(validation.legal ? 'cwl-drop-valid' : 'cwl-drop-invalid');
    if (!validation.legal) target.dataset.dropReason = validation.reason;
}

function clearDropFeedback() {
    document.querySelectorAll('.cwl-drop-valid, .cwl-drop-invalid').forEach(target => {
        target.classList.remove('cwl-drop-valid', 'cwl-drop-invalid');
        delete target.dataset.dropReason;
    });
}

function announceDropFeedback(message) {
    window.dispatchEvent(new CustomEvent('clashtools:cwl-drop-feedback', {
        detail: { message }
    }));
}
