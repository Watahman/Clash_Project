import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/assets/js/i18n/i18n.js', () => ({
    t: (key, values = {}) => ({
        'op.bonusRecipientsUnset': 'Enter the available number',
        'op.bonusRecipientsManual': 'Manually configured',
        'op.bonusWeightTotal': `Total ${values.total}%`,
        'op.bonusRecommended': 'Recommended',
        'op.bonusSelectPlayer': 'Select a player',
        'op.bonusPerformance': 'Performance',
        'op.bonusContribution': 'Contribution',
        'op.bonusReliability': 'Reliability',
        'op.bonusDefense': 'Defense',
        'op.bonusPerformanceDetail': `${values.stars} stars over ${values.attacks}`,
        'op.bonusContributionUnavailable': 'Contribution unavailable',
        'op.bonusReliabilityDetail': `${values.used}/${values.available} used`,
        'op.bonusDefenseNeutral': 'Neutral defense'
    })[key] || key
}));

describe('Operation Board bonus renderer', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <section id="panel">
                <input id="recipients">
                <small id="recipient-source"></small>
                <button data-strategy="fair"></button>
                <button data-strategy="performance"></button>
                <button data-strategy="contribution"></button>
                <button data-strategy="custom"></button>
                <div id="custom" hidden>
                    <input data-weight="performance">
                    <input data-weight="contribution">
                    <input data-weight="reliability">
                    <input data-weight="defense">
                    <strong id="total"></strong>
                </div>
                <p id="provisional"></p>
                <ol id="list"></ol>
                <aside id="detail"></aside>
            </section>`;
    });

    it('supports manual recipients, strategy switching and score details', async () => {
        const { renderBonusCalculator } = await import(
            '../../src/assets/js/operation-board/operation-board-bonus-renderer.js'
        );
        const root = document.querySelector('#panel');
        const refs = {
            bonusPanel: root,
            bonusRecipientCount: root.querySelector('#recipients'),
            bonusRecipientSource: root.querySelector('#recipient-source'),
            bonusStrategyButtons: Array.from(root.querySelectorAll('[data-strategy]'))
                .map(button => {
                    button.dataset.bonusStrategy = button.dataset.strategy;
                    return button;
                }),
            bonusCustomWeights: root.querySelector('#custom'),
            bonusWeightInputs: Object.fromEntries(
                Array.from(root.querySelectorAll('[data-weight]')).map(input => [
                    input.dataset.weight,
                    input
                ])
            ),
            bonusWeightTotal: root.querySelector('#total'),
            bonusProvisional: root.querySelector('#provisional'),
            bonusList: root.querySelector('#list'),
            bonusDetail: root.querySelector('#detail')
        };
        const report = {
            phase: 'live',
            clan: { tag: '#SELF' },
            rounds: [{ state: 'live' }],
            wars: [],
            roster: [
                {
                    tag: '#T',
                    name: 'Thomas',
                    townHall: 17,
                    warParticipant: true,
                    attacksUsed: 1,
                    availableAttacks: 1,
                    stars: 3,
                    destruction: 100
                },
                {
                    tag: '#A',
                    name: 'Alex',
                    townHall: 17,
                    warParticipant: true,
                    attacksUsed: 1,
                    availableAttacks: 1,
                    stars: 2,
                    destruction: 80
                }
            ]
        };

        renderBonusCalculator(refs, report);
        expect(refs.bonusRecipientSource.textContent).toBe('Enter the available number');
        refs.bonusRecipientCount.value = '1';
        refs.bonusRecipientCount.dispatchEvent(new Event('change'));

        expect(root.querySelectorAll('.is-recommended')).toHaveLength(1);
        expect(refs.bonusRecipientSource.textContent).toBe('Manually configured');
        expect(refs.bonusDetail.textContent).toContain('Thomas');

        const performance = refs.bonusStrategyButtons.find(
            button => button.dataset.bonusStrategy === 'performance'
        );
        performance.click();
        expect(performance.getAttribute('aria-pressed')).toBe('true');

        const alex = root.querySelector('[data-bonus-tag="#A"]');
        alex.focus();
        alex.click();
        expect(refs.bonusDetail.textContent).toContain('Alex');
        expect(document.activeElement).toBe(alex);
        expect(refs.bonusProvisional.hidden).toBe(false);
    });
});
