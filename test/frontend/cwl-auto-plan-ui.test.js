import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    collectAutoPlanInput: vi.fn(),
    applyAutoPlanResult: vi.fn(() => Promise.resolve())
}));

vi.mock('../../src/assets/js/cwl/auto-plan/cwl-auto-plan-source.js', () => mocks);

describe('CWL Auto Plan controller', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem('clashtools_language', 'en');
        document.body.innerHTML = `
            <button id="cwl-auto-plan-button"></button>
            <section id="cwl-auto-plan-panel" class="hidden">
                <select id="cwl-auto-plan-mode">
                    <option value="automatic">Automatic</option>
                    <option value="guided">Guided</option>
                </select>
                <p id="cwl-auto-plan-status"></p>
                <div id="cwl-auto-plan-preview"></div>
                <button id="cwl-auto-plan-apply"></button>
                <button id="cwl-auto-plan-cancel"></button>
            </section>`;
        document.querySelector('#cwl-auto-plan-panel').scrollIntoView = vi.fn();
        mocks.collectAutoPlanInput.mockResolvedValue({
            rounds: 7,
            locks: { assignments: {}, roles: {}, reasons: {} },
            clans: [{
                id: 'alpha',
                tag: '#ALPHA',
                name: 'Alpha',
                league: 'Master League I',
                capacity: 15
            }],
            players: Array.from({ length: 15 }, (_, index) => ({
                tag: `#P${index}`,
                name: `Player ${index}`,
                townHallLevel: 17,
                currentClanId: null,
                currentRole: '',
                availability: {
                    state: 'yes',
                    rounds: 7,
                    availableDays: [1, 2, 3, 4, 5, 6, 7]
                },
                performance: {
                    status: 'ready',
                    performance: 100,
                    reliability: 95,
                    avgStars: 2.4,
                    confidence: 'High',
                    form: { delta: 0 }
                }
            }))
        });
    });

    it('shows a preview first and only mutates the plan after Apply plan', async () => {
        const { initAutoPlan } = await import(
            '../../src/assets/js/cwl/auto-plan/cwl-auto-plan-ui.js'
        );
        initAutoPlan();

        document.querySelector('#cwl-auto-plan-button').click();
        await vi.waitFor(() =>
            expect(document.querySelector('.cwl-auto-plan-clan')).not.toBeNull()
        );

        expect(mocks.applyAutoPlanResult).not.toHaveBeenCalled();
        expect(document.querySelector('#cwl-auto-plan-panel').classList.contains('hidden'))
            .toBe(false);

        document.querySelector('#cwl-auto-plan-apply').click();
        await vi.waitFor(() => expect(mocks.applyAutoPlanResult).toHaveBeenCalledOnce());
    });
});
