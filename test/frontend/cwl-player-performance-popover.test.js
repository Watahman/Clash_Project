import { beforeEach, describe, expect, it, vi } from 'vitest';

const performanceMocks = vi.hoisted(() => ({
    getPlayerPerformance: vi.fn(),
    schedulePlayerPerformanceBatch: vi.fn()
}));

vi.mock('../../src/assets/js/cwl/player-performance-client.js', () => performanceMocks);

describe('CWL historical performance popover', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.resetModules();
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
        expect(popover.textContent).toContain('108');
        expect(popover.textContent).toContain('CWL');
        expect(popover.textContent).toContain('Current CWL');
        expect(popover.textContent).toContain('5 / 5');
        expect(popover.textContent).toContain('91.4%');
        expect(popover.textContent).toContain('Rounds played');
        expect(popover.textContent).toContain('Insufficient tracked war participation');
        expect(popover.textContent).not.toContain('Reliability');

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
        expect(popover.textContent).toContain('6 / 7');
        expect(popover.textContent).toContain('Offensive rank');
        expect(popover.textContent).not.toContain('108');
        expect(popover.textContent).not.toContain('Matchups');
    });
});

function pointerEvent(type, pointerType) {
    const event = new Event(type, { bubbles: true });
    Object.defineProperty(event, 'pointerType', { value: pointerType });
    return event;
}
