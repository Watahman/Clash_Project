import { describe, expect, it } from 'vitest';
import { setLanguage } from '../../src/assets/js/i18n/i18n.js';
import { buildWarHistory } from '../../src/assets/js/war-operation-board/war-history-model.js';
import { renderWarHistory } from '../../src/assets/js/war-operation-board/war-history-renderer.js';

describe('regular war history', () => {
    it('excludes CWL aggregates from all regular-war summary metrics', () => {
        const history = buildWarHistory([
            regularWar(),
            cwlAggregate()
        ], '#AAA');

        expect(history.summary).toMatchObject({
            wins: 1,
            losses: 0,
            draws: 0,
            winRate: 100,
            avgStars: 20,
            avgUsage: 50,
            regularWars: 1,
            excludedWars: 1
        });
        expect(history.wars[1]).toMatchObject({
            isCwl: true,
            isRegular: false,
            historyType: 'cwl',
            attackUsage: null
        });
    });

    it('recognizes an inflated multi-war record without an explicit CWL type', () => {
        const history = buildWarHistory([cwlAggregate({
            type: undefined,
            tag: undefined,
            warTag: undefined,
            isLeagueWar: undefined
        })], '#AAA');

        expect(history.wars[0]).toMatchObject({
            isCwl: false,
            isGrouped: true,
            isRegular: false,
            historyType: 'grouped',
            attackUsage: null
        });
        expect(history.summary.winRate).toBeNull();
    });

    it('recognizes the official CWL war-log shape when both clan tags are omitted', () => {
        const history = buildWarHistory([cwlAggregate({
            type: undefined,
            tag: undefined,
            clan: { name: null, tag: null, stars: 318, destructionPercentage: 678.8, attacks: 105 },
            opponent: { name: null, tag: null, stars: 285, destructionPercentage: 0, attacks: 0 }
        })], '#AAA');

        expect(history.wars[0]).toMatchObject({
            isCwl: true,
            isGrouped: false,
            historyType: 'cwl'
        });
    });

    it('recognizes a selected clan plus a tag-less CWL opponent', () => {
        const history = buildWarHistory([cwlAggregate({
            type: undefined,
            tag: undefined,
            clan: { tag: '#AAA', name: 'Own clan', stars: 30, destructionPercentage: 90, attacks: 15 },
            opponent: { tag: null, name: null, stars: 28, destructionPercentage: 88, attacks: 0 }
        })], '#AAA');

        expect(history.wars[0]).toMatchObject({
            isCwl: true,
            historyType: 'cwl',
            isRegular: false
        });
    });

    it('renders a CWL record as a separate card without regular-war usage', () => {
        setLanguage('en');
        const summary = document.createElement('section');
        const list = document.createElement('section');
        renderWarHistory(summary, list, buildWarHistory([cwlAggregate({
            clan: { tag: null, name: null, stars: 318, destructionPercentage: 678.8, attacks: 105 },
            opponent: { tag: null, name: null, stars: 285, destructionPercentage: 0, attacks: 0 }
        })], '#AAA'));

        const card = list.querySelector('.war-history-row.is-cwl');
        expect(card).not.toBeNull();
        expect(card.querySelector('.war-history-type').textContent).toBe('CWL');
        expect(card.textContent).toContain('CWL war data');
        expect(card.textContent).toContain('CWL opponent unavailable');
        expect(card.textContent).toContain('Excluded from regular-war stats');
        expect(card.textContent).not.toContain('700%');
    });
});

function regularWar() {
    return {
        endTime: '20260813T000000.000Z',
        teamSize: 10,
        attacksPerMember: 2,
        clan: { tag: '#AAA', name: 'Own clan', stars: 20, destructionPercentage: 90, attacks: 10 },
        opponent: { tag: '#BBB', name: 'Opponent', stars: 18, destructionPercentage: 85, attacks: 9 }
    };
}

function cwlAggregate(overrides = {}) {
    return {
        endTime: '20260811T000000.000Z',
        type: 'cwl',
        tag: '#CWLWAR',
        teamSize: 15,
        attacksPerMember: 1,
        clan: { tag: '#AAA', name: 'Own clan', stars: 318, destructionPercentage: 678.8, attacks: 105 },
        opponent: { tag: '#BBB', name: 'Opponent', stars: 285, destructionPercentage: 0, attacks: 0 },
        ...overrides
    };
}
