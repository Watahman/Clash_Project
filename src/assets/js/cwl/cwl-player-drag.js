import { savePlan } from './cwl-plan-io.js?v=20260829-public-auth-v1';
import { normalizeRosterStatus } from './cwl-plan-schema.js';
import { syncPlayerRosterStatus } from './cwl-player-controls.js?v=20260829-public-auth-v1';
import { rememberPlannerPlayers, updateAllPlayerCounters } from './cwl-planner-card-state.js?v=20260829-public-auth-v1';

const CONTROL_SELECTOR = 'button, select, input, a, [role="button"]';
const DRAG_THRESHOLD = 7;
const CLICK_SUPPRESSION_MS = 300;

export function makePlayerDraggable(element) {
    if (!element || element.dataset.cwlDragBound === 'true') return;
    element.dataset.cwlDragBound = 'true';
    element.originalContainer = element.parentElement;
    element.classList.add('draggable');
    element.addEventListener('mousedown', event => startPendingDrag(element, event));
    element.addEventListener('click', event => suppressClickAfterDrag(element, event), true);
}

function startPendingDrag(element, event) {
    if (event.button !== 0 || event.target.closest(CONTROL_SELECTOR)) return;
    if (element._cwlDragState) return;
    const document = element.ownerDocument;
    const state = createDragState(element, event);
    element._cwlDragState = state;
    bindDragListeners(element, state, document);
}

function createDragState(element, event) {
    const rect = element.getBoundingClientRect();
    return {
        activeTarget: null,
        dragging: false,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        placeholder: null,
        previousContainer: element.parentElement,
        startX: event.clientX,
        startY: event.clientY
    };
}

function bindDragListeners(element, state, document) {
    state.onMouseMove = event => updateDrag(element, state, event, document);
    state.onMouseUp = event => finishDrag(element, state, event, document);
    state.onKeyDown = event => {
        if (event.key === 'Escape') cancelDrag(element, state, document);
    };
    state.onBlur = () => cancelDrag(element, state, document);
    document.addEventListener('mousemove', state.onMouseMove);
    document.addEventListener('mouseup', state.onMouseUp);
    document.addEventListener('keydown', state.onKeyDown);
    document.defaultView?.addEventListener('blur', state.onBlur);
}

function updateDrag(element, state, event, document) {
    if (!state.dragging && !passedDragThreshold(state, event)) return;
    event.preventDefault();
    if (!state.dragging) activateDrag(element, state, document);
    element.style.left = `${event.clientX - state.offsetX}px`;
    element.style.top = `${event.clientY - state.offsetY}px`;
    state.activeTarget = findDropTarget(document, event.clientX, event.clientY);
    updateDropFeedback(state.activeTarget, document);
}

function passedDragThreshold(state, event) {
    return Math.hypot(event.clientX - state.startX, event.clientY - state.startY) >= DRAG_THRESHOLD;
}

function activateDrag(element, state, document) {
    state.dragging = true;
    document.defaultView?.dispatchEvent(new CustomEvent('clashtools:cwl-player-drag-start'));
    const rect = element.getBoundingClientRect();
    state.placeholder = createPlaceholder(document, rect.height);
    state.previousContainer.insertBefore(state.placeholder, element);
    const dragLayer = element.closest('.workspace-planner') || document.body;
    dragLayer.appendChild(element);
    applyDraggedStyles(element, rect);
}

function createPlaceholder(document, height) {
    const placeholder = document.createElement('div');
    placeholder.className = 'cwl-player-drag-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.style.height = `${height}px`;
    return placeholder;
}

function applyDraggedStyles(element, rect) {
    element.classList.add('cwl-player-dragging');
    Object.assign(element.style, {
        left: `${rect.left}px`,
        pointerEvents: 'none',
        position: 'fixed',
        top: `${rect.top}px`,
        zIndex: '1000'
    });
    element.style.setProperty('width', `${rect.width}px`, 'important');
    element.style.setProperty('height', `${rect.height}px`, 'important');
}

function finishDrag(element, state, event, document) {
    if (!state.dragging) {
        cleanupDrag(element, state, document);
        return;
    }
    event.preventDefault();
    const target = state.activeTarget || findDropTarget(document, event.clientX, event.clientY);
    const moved = Boolean(target && target !== state.previousContainer);
    placeDraggedElement(element, state, moved ? target : null);
    if (moved) commitRosterDrop(element, state, target);
    element.dataset.cwlSuppressClickUntil = String(Date.now() + CLICK_SUPPRESSION_MS);
    cleanupDrag(element, state, document);
}

function placeDraggedElement(element, state, target) {
    if (target) target.appendChild(element);
    else if (state.placeholder?.isConnected) {
        state.placeholder.parentElement.insertBefore(element, state.placeholder);
    } else state.previousContainer?.appendChild(element);
    element.originalContainer = element.parentElement;
}

function commitRosterDrop(element, state, finalContainer) {
    const previousStatus = normalizeRosterStatus(element.dataset.rosterStatus);
    syncPlayerRosterStatus(element, {
        preferredStatus: previousStatus,
        autoReserve: finalContainer.matches('.cwl-clan-player-list')
            && finalContainer !== state.previousContainer
    });
    updateAllPlayerCounters();
    rememberPlannerPlayers();
    element.ownerDocument.defaultView.dispatchEvent(new CustomEvent('clashtools:cwl-player-added'));
    savePlan();
}

function cancelDrag(element, state, document) {
    if (element._cwlDragState !== state) return;
    if (state.dragging) placeDraggedElement(element, state, null);
    cleanupDrag(element, state, document);
}

function cleanupDrag(element, state, document) {
    element._cwlDragState = null;
    element.classList.remove('cwl-player-dragging');
    state.placeholder?.remove();
    clearDropFeedback(document);
    clearDraggedStyles(element);
    document.removeEventListener('mousemove', state.onMouseMove);
    document.removeEventListener('mouseup', state.onMouseUp);
    document.removeEventListener('keydown', state.onKeyDown);
    document.defaultView?.removeEventListener('blur', state.onBlur);
}

function clearDraggedStyles(element) {
    for (const property of [
        'position', 'left', 'top', 'width', 'height', 'z-index', 'pointer-events'
    ]) element.style.removeProperty(property);
}

function suppressClickAfterDrag(element, event) {
    const suppressUntil = Number(element.dataset.cwlSuppressClickUntil || 0);
    if (Date.now() >= suppressUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
}

function findDropTarget(document, x, y) {
    const lists = document.querySelectorAll('.cwl-clan-player-list, #cwl-available-players');
    for (const list of lists) {
        const rect = list.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return list;
    }
    return null;
}

function updateDropFeedback(target, document) {
    clearDropFeedback(document);
    target?.classList.add('cwl-drop-valid');
}

function clearDropFeedback(document) {
    document.querySelectorAll('.cwl-drop-valid, .cwl-drop-invalid').forEach(target => {
        target.classList.remove('cwl-drop-valid', 'cwl-drop-invalid');
        delete target.dataset.dropReason;
    });
}
