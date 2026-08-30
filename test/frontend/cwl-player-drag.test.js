import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    rememberPlannerPlayers: vi.fn(),
    savePlan: vi.fn(),
    syncPlayerRosterStatus: vi.fn(),
    updateAllPlayerCounters: vi.fn()
}));

vi.mock('../../src/assets/js/cwl/cwl-plan-io.js?v=20260829-public-auth-v1', () => ({
    savePlan: mocks.savePlan
}));
vi.mock('../../src/assets/js/cwl/cwl-plan-schema.js', () => ({
    normalizeRosterStatus: value => value || 'core'
}));
vi.mock('../../src/assets/js/cwl/cwl-player-controls.js?v=20260829-public-auth-v1', () => ({
    syncPlayerRosterStatus: mocks.syncPlayerRosterStatus
}));
vi.mock('../../src/assets/js/cwl/cwl-planner-card-state.js?v=20260829-public-auth-v1', () => ({
    rememberPlannerPlayers: mocks.rememberPlannerPlayers,
    updateAllPlayerCounters: mocks.updateAllPlayerCounters
}));

const { makePlayerDraggable } = await import('../../src/assets/js/cwl/cwl-player-drag.js');

describe('CWL player drag interaction', () => {
    let document;
    let window;
    let source;
    let target;
    let card;

    beforeEach(() => {
        const dom = new JSDOM(`
            <main class="workspace-planner">
                <section id="cwl-available-players"></section>
                <section class="cwl-clan-player-list"></section>
            </main>
        `);
        ({ document } = dom.window);
        window = dom.window;
        source = document.querySelector('#cwl-available-players');
        target = document.querySelector('.cwl-clan-player-list');
        card = document.createElement('article');
        card.className = 'cwl-player-article';
        card.dataset.rosterStatus = 'core';
        source.appendChild(card);
        mockRect(card, 0, 0, 180, 56);
        mockRect(source, 0, 0, 220, 400);
        mockRect(target, 300, 0, 220, 400);
        vi.stubGlobal('CustomEvent', window.CustomEvent);
        vi.clearAllMocks();
        makePlayerDraggable(card);
    });

    it('keeps a normal click in the original position', () => {
        dispatchMouse(card, 'mousedown', 20, 20);
        dispatchMouse(document, 'mouseup', 20, 20);

        expect(card.parentElement).toBe(source);
        expect(source.firstElementChild).toBe(card);
        expect(document.querySelector('.cwl-player-drag-placeholder')).toBeNull();
    });

    it('uses a placeholder and restores an invalid drop', () => {
        dispatchMouse(card, 'mousedown', 20, 20);
        dispatchMouse(document, 'mousemove', 60, 40, 1);

        expect(card.classList.contains('cwl-player-dragging')).toBe(true);
        expect(source.querySelector('.cwl-player-drag-placeholder')).not.toBeNull();

        dispatchMouse(document, 'mouseup', 700, 500);
        expect(card.parentElement).toBe(source);
        expect(source.firstElementChild).toBe(card);
        expect(document.querySelector('.cwl-player-drag-placeholder')).toBeNull();
    });

    it('commits a valid cross-roster drop once', () => {
        const clickHandler = vi.fn();
        card.addEventListener('click', clickHandler);
        dispatchMouse(card, 'mousedown', 20, 20);
        dispatchMouse(document, 'mousemove', 350, 40, 1);
        dispatchMouse(document, 'mouseup', 350, 40);
        card.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

        expect(card.parentElement).toBe(target);
        expect(mocks.syncPlayerRosterStatus).toHaveBeenCalledTimes(1);
        expect(mocks.updateAllPlayerCounters).toHaveBeenCalledTimes(1);
        expect(mocks.savePlan).toHaveBeenCalledTimes(1);
        expect(clickHandler).not.toHaveBeenCalled();
    });
});

function dispatchMouse(target, type, clientX, clientY, buttons = 0) {
    const document = target.ownerDocument || target;
    target.dispatchEvent(new document.defaultView.MouseEvent(type, {
        bubbles: true,
        button: 0,
        buttons,
        clientX,
        clientY
    }));
}

function mockRect(element, left, top, width, height) {
    element.getBoundingClientRect = () => ({
        bottom: top + height,
        height,
        left,
        right: left + width,
        top,
        width,
        x: left,
        y: top
    });
}
