import { savePlan } from './cwl-plan-io.js';
import { normalizeRosterStatus } from './cwl-plan-schema.js';
import { syncPlayerRosterStatus } from './cwl-player-controls.js';
import { rememberPlannerPlayers, updateAllPlayerCounters } from './cwl-planner-card-state.js';

const CONTROL_SELECTOR = '.cwl-delete-player, .cwl-move-player, .cwl-roster-status';

export function makePlayerDraggable(element) {
    if (!element) return;
    element.originalContainer = element.parentElement;
    element.classList.add('draggable');
    element.addEventListener('mousedown', event => startDrag(element, event));
}

function startDrag(element, event) {
    if (event.target.closest(CONTROL_SELECTOR) || element._cwlDragState?.dragging) return;
    event.preventDefault();
    event.stopPropagation();
    const document = element.ownerDocument || globalThis.document;
    const state = createDragState(element, event);
    element._cwlDragState = state;
    document.defaultView?.dispatchEvent(new CustomEvent('clashtools:cwl-player-drag-start'));
    prepareDraggedElement(element, state, document);
    state.onMouseMove = moveEvent => updateDrag(element, state, moveEvent, document);
    state.onMouseUp = upEvent => finishDrag(element, state, upEvent, document);
    document.addEventListener('mousemove', state.onMouseMove);
    document.addEventListener('mouseup', state.onMouseUp);
}

function createDragState(element, event) {
    const rect = element.getBoundingClientRect();
    return {
        dragging: true,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        previousContainer: element.parentElement,
        activeTarget: null
    };
}

function prepareDraggedElement(element, state, document) {
    const rect = element.getBoundingClientRect();
    const dragLayer = element.closest('.workspace-planner') || document.body;
    element.originalContainer = state.previousContainer;
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
}

function updateDrag(element, state, event, document) {
    element.style.left = `${event.clientX - state.offsetX}px`;
    element.style.top = `${event.clientY - state.offsetY}px`;
    state.activeTarget = findDropTarget(document, event.clientX, event.clientY);
    updateDropFeedback(element, state.activeTarget, document);
}

function finishDrag(element, state, event, document) {
    const result = resolveDrop(element, state, event, document);
    commitDrop(element, state, result, document);
    cleanupDrag(element, state, document);
}

function resolveDrop(element, state, event, document) {
    const target = state.activeTarget || findDropTarget(document, event.clientX, event.clientY);
    return {
        dropAllowed: Boolean(target),
        finalContainer: target || state.previousContainer
    };
}

function commitDrop(element, state, result, document) {
    const { finalContainer, dropAllowed } = result;
    const previousStatus = normalizeRosterStatus(element.dataset.rosterStatus);
    if (finalContainer) finalContainer.appendChild(element);
    element.originalContainer = finalContainer;
    if (dropAllowed) commitRosterDrop(element, state, finalContainer, previousStatus);
}

function commitRosterDrop(element, state, finalContainer, previousStatus) {
    syncPlayerRosterStatus(element, {
        preferredStatus: previousStatus,
        autoReserve: Boolean(
            finalContainer
            && finalContainer !== state.previousContainer
            && finalContainer.matches('.cwl-clan-player-list')
        )
    });
    updateAllPlayerCounters();
    rememberPlannerPlayers();
    element.ownerDocument.defaultView.dispatchEvent(new CustomEvent('clashtools:cwl-player-added'));
    savePlan();
}

function cleanupDrag(element, state, document) {
    state.dragging = false;
    element._cwlDragState = null;
    element.classList.remove('cwl-player-dragging');
    clearDropFeedback(document);
    for (const property of ['position', 'left', 'top', 'width', 'height', 'z-index', 'pointer-events']) {
        element.style.removeProperty(property);
    }
    document.removeEventListener('mousemove', state.onMouseMove);
    document.removeEventListener('mouseup', state.onMouseUp);
}

function findDropTarget(document, x, y) {
    const lists = document.querySelectorAll(
        '.cwl-clan-player-list, #cwl-available-players'
    );
    for (const list of lists) {
        const rect = list.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            return list;
        }
    }
    return null;
}

function updateDropFeedback(card, target, document) {
    clearDropFeedback(document);
    if (!target) return;
    target.classList.add('cwl-drop-valid');
}

function clearDropFeedback(document) {
    document.querySelectorAll('.cwl-drop-valid, .cwl-drop-invalid').forEach(target => {
        target.classList.remove('cwl-drop-valid', 'cwl-drop-invalid');
        delete target.dataset.dropReason;
    });
}
