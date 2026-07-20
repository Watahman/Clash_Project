import { describe, expect, it } from 'vitest';
import { filterAndSortPlans, normalizeSearchText } from '../../src/assets/js/cwl/cwl-plan-list.js';

const plans = [
    { id: 'bravo', name: 'Bravo 10', updatedAt: '2026-06-01T10:00:00Z' },
    { id: 'alpha', name: 'Álpha 2', updatedAt: '2026-07-10T10:00:00Z' },
    { id: 'charlie', name: 'Charlie', updatedAt: null }
];

describe('saved plan list', () => {
    it('searches plan names without accents or case sensitivity', () => {
        expect(normalizeSearchText('  ÁLPHA  ')).toBe('alpha');
        expect(filterAndSortPlans(plans, { query: 'alpha' }).map(plan => plan.id)).toEqual(['alpha']);
    });

    it('sorts recent plans first and keeps unknown dates last', () => {
        expect(filterAndSortPlans(plans).map(plan => plan.id)).toEqual(['alpha', 'bravo', 'charlie']);
        expect(filterAndSortPlans(plans, { sort: 'updated-asc' }).map(plan => plan.id)).toEqual(['bravo', 'alpha', 'charlie']);
    });

    it('sorts names naturally in both directions without mutating the source', () => {
        const original = plans.map(plan => plan.id);
        expect(filterAndSortPlans(plans, { sort: 'name-asc' }).map(plan => plan.id)).toEqual(['alpha', 'bravo', 'charlie']);
        expect(filterAndSortPlans(plans, { sort: 'name-desc' }).map(plan => plan.id)).toEqual(['charlie', 'bravo', 'alpha']);
        expect(plans.map(plan => plan.id)).toEqual(original);
    });
});
