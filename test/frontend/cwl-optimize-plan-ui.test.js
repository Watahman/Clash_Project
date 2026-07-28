import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    collectAutoPlanInput: vi.fn(),
    applyAutoPlanResult: vi.fn(() => Promise.resolve())
}));

vi.mock('../../src/assets/js/cwl/auto-plan/cwl-auto-plan-source.js', () => mocks);

describe('CWL Optimize Plan controller', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem('clashtools_language', 'en');
        document.body.innerHTML = `
            <button id="cwl-optimize-plan-button"></button>
            <section id="cwl-optimize-plan-panel" class="hidden">
                <p id="cwl-optimize-plan-status"></p>
                <div id="cwl-optimize-plan-preview"></div>
                <button id="cwl-optimize-plan-apply-accepted"></button>
                <button id="cwl-optimize-plan-apply-all"></button>
                <button id="cwl-optimize-plan-cancel"></button>
            </section>`;
        document.querySelector('#cwl-optimize-plan-panel').scrollIntoView = vi.fn();
        mocks.collectAutoPlanInput.mockResolvedValue(input());
    });

    it('does not mutate the plan until an accepted suggestion is applied', async () => {
        const { initOptimizePlan } = await import(
            '../../src/assets/js/cwl/optimize-plan/cwl-optimize-plan-ui.js'
        );
        initOptimizePlan();

        document.querySelector('#cwl-optimize-plan-button').click();
        await vi.waitFor(() =>
            expect(document.querySelector('.cwl-optimize-suggestion')).not.toBeNull()
        );
        expect(mocks.applyAutoPlanResult).not.toHaveBeenCalled();

        document.querySelector('[data-optimize-action="accept"]').click();
        document.querySelector('#cwl-optimize-plan-apply-accepted').click();

        await vi.waitFor(() => expect(mocks.applyAutoPlanResult).toHaveBeenCalledOnce());
        const applied = mocks.applyAutoPlanResult.mock.calls[0][0];
        expect(applied.mode).toBe('optimize');
        expect(applied.clans.find(clan => clan.id === 'beta').players).toHaveLength(15);
    });

    it.each([
        {
            label: 'clans',
            incompleteInput: { ...input(), clans: [] },
            message: 'Add at least one clan before using Optimize Plan.'
        },
        {
            label: 'players',
            incompleteInput: { ...input(), players: [] },
            message: 'Add players to the planner before using Optimize Plan.'
        }
    ])('asks the user to add $label before optimizing', async ({
        incompleteInput,
        message
    }) => {
        mocks.collectAutoPlanInput.mockResolvedValue(incompleteInput);
        const { initOptimizePlan } = await import(
            '../../src/assets/js/cwl/optimize-plan/cwl-optimize-plan-ui.js'
        );
        initOptimizePlan();

        document.querySelector('#cwl-optimize-plan-button').click();

        await vi.waitFor(() =>
            expect(document.querySelector('#cwl-optimize-plan-status').textContent)
                .toBe(message)
        );
        expect(document.querySelector('#cwl-optimize-plan-status').dataset.state)
            .toBe('error');
        expect(document.querySelector('#cwl-optimize-plan-panel').classList.contains('hidden'))
            .toBe(false);
        expect(document.querySelector('#cwl-optimize-plan-preview').childElementCount)
            .toBe(0);
        expect(document.querySelector('#cwl-optimize-plan-apply-accepted').disabled)
            .toBe(true);
        expect(document.querySelector('#cwl-optimize-plan-apply-all').disabled)
            .toBe(true);
    });
});

function input() {
    return {
        rounds: 7,
        locks: { assignments: {}, roles: {}, reasons: {}, startedClanIds: [] },
        clans: [
            { id: 'alpha', tag: '#ALPHA', name: 'Alpha', league: 'Master League I', capacity: 15 },
            { id: 'beta', tag: '#BETA', name: 'Beta', league: 'Crystal League I', capacity: 15 }
        ],
        players: [
            ...players('alpha', 17, 0),
            ...players('beta', 14, 20)
        ]
    };
}

function players(clanId, count, offset) {
    return Array.from({ length: count }, (_, position) => {
        const index = offset + position;
        return {
            tag: `#P${String(index).padStart(3, '0')}`,
            name: `Player ${index}`,
            townHallLevel: 17,
            currentClanId: clanId,
            currentRole: position < 15 ? 'core' : 'reserve',
            availability: {
                state: 'yes',
                availableDays: [1, 2, 3, 4, 5, 6, 7]
            },
            performance: {
                status: 'ready',
                scope: 'CWL',
                performance: 115 - position,
                reliability: 98 - position * 0.3,
                avgStars: 2.7 - position * 0.01,
                attackCount: 14,
                sameThCount: 12,
                confidence: 'High',
                form: { delta: 0 }
            }
        };
    });
}
