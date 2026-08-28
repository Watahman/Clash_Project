import { beforeEach, describe, expect, it, vi } from 'vitest';

const performanceMocks = vi.hoisted(() => ({
    getPlayerPerformance: vi.fn(),
    schedulePlayerPerformanceBatch: vi.fn()
}));
const fitMocks = vi.hoisted(() => ({
    getPlayerFitContext: vi.fn(() => null)
}));

vi.mock('../../src/assets/js/cwl/player-performance-client.js', () => performanceMocks);
vi.mock('../../src/assets/js/cwl/cwl-player-fit-context.js', () => fitMocks);

describe('CWL historical performance popover', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.resetModules();
        performanceMocks.getPlayerPerformance.mockReset();
        performanceMocks.schedulePlayerPerformanceBatch.mockReset();
        fitMocks.getPlayerFitContext.mockReset();
        fitMocks.getPlayerFitContext.mockReturnValue(null);
        performanceMocks.getPlayerPerformance.mockReturnValue({
            playerTag: '#P0L',
            status: 'ready',
            scope: 'CWL',
            performance: 108,
            form: { delta: 9, trend: 'strong' },
            reliability: null,
            avgStars: 2.54,
            avgDestruction: 89.7,
            tripleRate: 61,
            twoStarRate: 35,
            lowStarRate: 4,
            attackCount: 56,
            sameThCount: 24,
            upHitCount: 11,
            downHitCount: 7,
            confidence: 'High',
            coverage: { attacks: 56, days: 94 }
        });
        document.body.innerHTML = `
            <main class="workspace-planner">
                <article class="cwl-player-article" data-planner-card="true"
                         data-player-tag="#P0L" data-town-hall="17">
                    <img class="cwl-player-townhall-foto">
                    <div class="cwl-player-info" tabindex="0">
                        <p class="cwl-player-name">Alex</p>
                    </div>
                    <button class="cwl-delete-player">Delete</button>
                </article>
            </main>`;
    });

    it('opens only from player info after the hover delay and closes with Escape', async () => {
        let currentContext = {
            mode: 'current',
            attacksUsed: 5,
            availableAttacks: 5,
            stars: 12,
            avgDestruction: 91.4,
            missed: 0,
            roundsPlayed: 5
        };
        const { initPlayerPerformancePopover } = await import(
            '../../src/assets/js/cwl/cwl-player-performance-popover.js'
        );
        const popover = initPlayerPerformancePopover({
            getCurrentContext: () => currentContext
        });
        const control = document.querySelector('.cwl-delete-player');
        const info = document.querySelector('.cwl-player-info');

        control.dispatchEvent(pointerEvent('pointerover', 'mouse'));
        vi.advanceTimersByTime(350);
        expect(popover.classList.contains('hidden')).toBe(true);

        info.dispatchEvent(pointerEvent('pointerover', 'mouse'));
        vi.advanceTimersByTime(299);
        expect(popover.classList.contains('hidden')).toBe(true);
        vi.advanceTimersByTime(1);
        expect(popover.classList.contains('hidden')).toBe(false);
        expect(popover.textContent).toContain('100');
        expect(popover.textContent).not.toContain('108');
        expect(popover.textContent).toContain('CWL');
        expect(popover.textContent).toContain('Current CWL');
        expect(popover.textContent).toContain('91.4%');
        expect(popover.textContent).toContain('Rounds played');
        expect(popover.textContent).toContain('Reliability');
        expect(popover.textContent).toContain('Confidence');
        expect(popover.textContent).toContain('Attack coverage');
        expect(popover.textContent).not.toContain('Attacks used');

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(popover.classList.contains('hidden')).toBe(true);

        info.dispatchEvent(pointerEvent('pointerup', 'touch'));
        expect(popover.classList.contains('hidden')).toBe(false);
        window.dispatchEvent(new CustomEvent('clashtools:cwl-player-drag-start'));
        expect(popover.classList.contains('hidden')).toBe(true);

        currentContext = {
            mode: 'historical',
            label: 'June 2026',
            attacksUsed: 6,
            availableAttacks: 7,
            stars: 15,
            avgStars: 2.5,
            avgDestruction: 93.1,
            missed: 1,
            roundsPlayed: 6,
            tripleRate: 0.67,
            offensiveRank: 2
        };
        info.dispatchEvent(pointerEvent('pointerup', 'touch'));

        expect(popover.textContent).toContain('June 2026 CWL');
        expect(popover.textContent).not.toContain('6 / 7');
        expect(popover.textContent).toContain('Offensive rank');
        expect(popover.textContent).not.toContain('108');
        expect(popover.textContent).not.toContain('Matchups');
    });

    it('shows cached overview and local clan-fit context without requesting performance again', async () => {
        fitMocks.getPlayerFitContext.mockReturnValue({
            mode: 'assigned',
            fits: [{ clanId: 'alpha', clanName: 'Alpha', fit: 81.234 }]
        });
        const { initPlayerPerformancePopover } = await import(
            '../../src/assets/js/cwl/cwl-player-performance-popover.js'
        );
        const popover = initPlayerPerformancePopover();
        const info = document.querySelector('.cwl-player-info');

        info.dispatchEvent(pointerEvent('pointerup', 'touch'));

        expect(popover.textContent).toContain('War Performance');
        expect(popover.textContent).toContain('Current clan fit');
        expect(popover.textContent).toContain('Alpha');
        expect(popover.textContent).toContain('81.2');
        expect(performanceMocks.schedulePlayerPerformanceBatch).not.toHaveBeenCalled();
        expect(fitMocks.getPlayerFitContext).toHaveBeenCalledWith(
            document.querySelector('.cwl-player-article'),
            expect.objectContaining({ performance: 108 })
        );
    });

    it('repositions the expanded popover after an async performance update', async () => {
        const { initPlayerPerformancePopover } = await import(
            '../../src/assets/js/cwl/cwl-player-performance-popover.js'
        );
        const popover = initPlayerPerformancePopover();
        const info = document.querySelector('.cwl-player-info');
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
        info.getBoundingClientRect = () => ({
            left: 740, right: 760, top: 560, bottom: 580, width: 20, height: 20
        });
        let popupHeight = 80;
        popover.getBoundingClientRect = () => ({
            left: 0, right: 200, top: 0, bottom: popupHeight,
            width: 200, height: popupHeight
        });

        info.dispatchEvent(pointerEvent('pointerup', 'touch'));
        expect(popover.style.top).toBe('508px');
        expect(popover.style.left).toBe('528px');

        popupHeight = 560;
        window.dispatchEvent(new CustomEvent('clashtools:player-performance-updated', {
            detail: { tags: ['#P0L'] }
        }));

        expect(popover.style.top).toBe('28px');
        expect(popover.style.left).toBe('528px');
    });
});

function pointerEvent(type, pointerType) {
    const event = new Event(type, { bubbles: true });
    Object.defineProperty(event, 'pointerType', { value: pointerType });
    return event;
}
