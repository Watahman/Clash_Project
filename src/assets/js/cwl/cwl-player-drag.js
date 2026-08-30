import { savePlan } from './cwl-plan-io.js?v=20260829-public-auth-v1';
import { normalizeRosterStatus } from './cwl-plan-schema.js';
import { syncPlayerRosterStatus } from './cwl-player-controls.js?v=20260829-public-auth-v1';
import { rememberPlannerPlayers, updateAllPlayerCounters } from './cwl-planner-card-state.js?v=20260829-public-auth-v1';

const CONTROL_SELECTOR = 'button, select, input, textarea, a, [contenteditable="true"]';
const DROP_TARGET_SELECTOR = '.cwl-clan-player-list, #cwl-available-players';
const DRAG_THRESHOLD = 7;
const CLICK_SUPPRESSION_MS = 300;

export function makePlayerDraggable(element) {
    if (!element || element.dataset.cwlDragBound === 'true') return;
    element.dataset.cwlDragBound = 'true';
    element.originalContainer = element.parentElement;
    element.classList.add('draggable');
    element.addEventListener('pointerdown', event => startPendingDrag(element, event));
    element.addEventListener('click', event => suppressClickAfterDrag(element, event), true);
}

function startPendingDrag(element, event) {
    if (event.button !== 0 || event.isPrimary === false) return;
    if (event.target.closest?.(CONTROL_SELECTOR)) return;
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
        captureTarget: element.closest('.workspace-planner'),
        dragging: false,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        pointerId: event.pointerId,
        preview: null,
        previousContainer: element.parentElement,
        startX: event.clientX,
        startY: event.clientY
    };
}

function bindDragListeners(element, state, document) {
    state.onPointerMove = event => updateDrag(element, state, event, document);
    state.onPointerUp = event => finishDrag(element, state, event, document);
    state.onPointerCancel = event => cancelPointerDrag(element, state, event, document);
    state.onKeyDown = event => {
        if (event.key === 'Escape') cancelDrag(element, state, document);
    };
    state.onBlur = () => cancelDrag(element, state, document);
    document.addEventListener('pointermove', state.onPointerMove, { passive: false });
    document.addEventListener('pointerup', state.onPointerUp);
    document.addEventListener('pointercancel', state.onPointerCancel);
    document.addEventListener('keydown', state.onKeyDown);
    document.defaultView?.addEventListener('blur', state.onBlur);
}

function updateDrag(element, state, event, document) {
    if (!isActivePointer(state, event)) return;
    if (!state.dragging && !passedDragThreshold(state, event)) return;
    event.preventDefault();
    if (!state.dragging) activateDrag(element, state, document);
    moveDragPreview(state, event.clientX, event.clientY);
    state.activeTarget = findDropTarget(document, event.clientX, event.clientY);
    updateDropFeedback(state.activeTarget, document);
}

function passedDragThreshold(state, event) {
    return Math.hypot(event.clientX - state.startX, event.clientY - state.startY) >= DRAG_THRESHOLD;
}

function activateDrag(element, state, document) {
    state.dragging = true;
    capturePointer(state);
    dispatchWindowEvent(document, 'clashtools:cwl-player-drag-start');
    const rect = element.getBoundingClientRect();
    element.classList.add('cwl-player-drag-source');
    state.preview = createDragPreview(element, state.previousContainer, rect);
}

function createDragPreview(element, container, rect) {
    const preview = element.cloneNode(true);
    preview.classList.remove('cwl-player-drag-source');
    preview.classList.add('cwl-player-dragging', 'cwl-player-drag-preview');
    preview.removeAttribute('id');
    preview.removeAttribute('data-cwl-drag-bound');
    preview.setAttribute('aria-hidden', 'true');
    preview.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    preview.querySelectorAll(CONTROL_SELECTOR).forEach(control => control.setAttribute('tabindex', '-1'));
    container.appendChild(preview);
    applyDraggedStyles(preview, rect);
    return preview;
}

function applyDraggedStyles(preview, rect) {
    Object.assign(preview.style, {
        left: `${rect.left}px`,
        pointerEvents: 'none',
        position: 'fixed',
        top: `${rect.top}px`,
        zIndex: '1000'
    });
    preview.style.setProperty('width', `${rect.width}px`, 'important');
    preview.style.setProperty('height', `${rect.height}px`, 'important');
}

function moveDragPreview(state, clientX, clientY) {
    if (!state.preview) return;
    state.preview.style.left = `${clientX - state.offsetX}px`;
    state.preview.style.top = `${clientY - state.offsetY}px`;
}

function finishDrag(element, state, event, document) {
    if (!isActivePointer(state, event)) return;
    if (!state.dragging) {
        cleanupDrag(element, state, document);
        return;
    }
    event.preventDefault();
    const target = state.activeTarget || findDropTarget(document, event.clientX, event.clientY);
    const moved = Boolean(target && target !== state.previousContainer);
    if (moved) {
        target.appendChild(element);
        element.originalContainer = target;
        commitRosterDrop(element, state, target);
    } else {
        element.originalContainer = state.previousContainer;
    }
    element.dataset.cwlSuppressClickUntil = String(Date.now() + CLICK_SUPPRESSION_MS);
    cleanupDrag(element, state, document);
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
    dispatchWindowEvent(element.ownerDocument, 'clashtools:cwl-player-added');
    savePlan();
}

function cancelPointerDrag(element, state, event, document) {
    if (isActivePointer(state, event)) cancelDrag(element, state, document);
}

function cancelDrag(element, state, document) {
    if (element._cwlDragState !== state) return;
    cleanupDrag(element, state, document);
}

function cleanupDrag(element, state, document) {
    element._cwlDragState = null;
    element.classList.remove('cwl-player-drag-source');
    state.preview?.remove();
    clearDropFeedback(document);
    releasePointer(state);
    document.removeEventListener('pointermove', state.onPointerMove);
    document.removeEventListener('pointerup', state.onPointerUp);
    document.removeEventListener('pointercancel', state.onPointerCancel);
    document.removeEventListener('keydown', state.onKeyDown);
    document.defaultView?.removeEventListener('blur', state.onBlur);
}

function isActivePointer(state, event) {
    return state.pointerId == null || event.pointerId === state.pointerId;
}

function capturePointer(state) {
    try {
        state.captureTarget?.setPointerCapture?.(state.pointerId);
    } catch {
        // The document listeners still provide a safe fallback.
    }
}

function releasePointer(state) {
    try {
        if (state.captureTarget?.hasPointerCapture?.(state.pointerId)) {
            state.captureTarget.releasePointerCapture(state.pointerId);
        }
    } catch {
        // Capture can already be released automatically after pointerup.
    }
}

function dispatchWindowEvent(document, eventName) {
    const EventConstructor = document.defaultView?.CustomEvent || CustomEvent;
    document.defaultView?.dispatchEvent(new EventConstructor(eventName));
}

function suppressClickAfterDrag(element, event) {
    const suppressUntil = Number(element.dataset.cwlSuppressClickUntil || 0);
    if (Date.now() >= suppressUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
}

function findDropTarget(document, x, y) {
    const directTarget = document.elementFromPoint?.(x, y)?.closest?.(DROP_TARGET_SELECTOR);
    if (directTarget) return directTarget;

    for (const list of document.querySelectorAll(DROP_TARGET_SELECTOR)) {
        const hitArea = list.matches('.cwl-clan-player-list')
            ? list.closest('.cwl-clan-article') || list
            : list;
        if (pointIsInside(hitArea.getBoundingClientRect(), x, y)) return list;
    }
    return null;
}

function pointIsInside(rect, x, y) {
    return rect.width > 0
        && rect.height > 0
        && x >= rect.left
        && x <= rect.right
        && y >= rect.top
        && y <= rect.bottom;
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
