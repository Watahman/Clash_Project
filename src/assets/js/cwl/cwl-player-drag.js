import { savePlan } from './cwl-plan-io.js';
import { normalizeRosterStatus } from './cwl-plan-schema.js';
import { syncPlayerRosterStatus } from './cwl-player-controls.js';
import { rememberPlannerPlayers, updateAllPlayerCounters } from './cwl-planner-card-state.js';

const CONTROL_SELECTOR = '.cwl-delete-player, .cwl-move-player, .cwl-roster-status';

export function makePlayerDraggable(element) {
    let offsetX;
    let offsetY;
    let dragging = false;
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
        };
        const onMouseUp = upEvent => {
            dragging = false;
            const previousContainer = element.originalContainer;
            const targetContainer = findDropTarget(upEvent.clientX, upEvent.clientY);
            const finalContainer = targetContainer || previousContainer;
            const previousStatus = normalizeRosterStatus(element.dataset.rosterStatus);
            finalContainer.appendChild(element);
            element.originalContainer = finalContainer;
            syncPlayerRosterStatus(element, {
                preferredStatus: previousStatus,
                autoReserve: Boolean(
                    targetContainer
                    && targetContainer !== previousContainer
                    && targetContainer.matches('.cwl-clan-player-list')
                )
            });

            element.classList.remove('cwl-player-dragging');
            for (const property of [
                'position', 'left', 'top', 'width', 'height', 'z-index', 'pointer-events'
            ]) {
                element.style.removeProperty(property);
            }
            updateAllPlayerCounters();
            rememberPlannerPlayers();
            window.dispatchEvent(new CustomEvent('clashtools:cwl-player-added'));
            savePlan();
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

function findDropTarget(x, y) {
    const lists = document.querySelectorAll('.cwl-clan-player-list, #cwl-available-players');
    for (const list of lists) {
        const rect = list.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            return list;
        }
    }
    return null;
}
