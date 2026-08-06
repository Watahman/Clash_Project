import { describe, expect, it } from 'vitest';
import {
    ENTITY_CATEGORIES,
    ENTITY_GUESSER_DATA_VERSION,
    getCategory,
    getEntities
} from '../../src/assets/js/minigames/entity-guesser-data.js';
import {
    availableHintCount,
    buildHint,
    calculateScore,
    compareEntity,
    findEntity,
    getDailyCategory,
    getDailyEntity,
    normalizeGuess,
    resultSquares,
    updateStreak,
    validateCatalog
} from '../../src/assets/js/minigames/entity-guesser-engine.js';

describe('Entity Guesser phase 2 engine', () => {
    it('ships the five phase 2 categories with a versioned catalog', () => {
        expect(ENTITY_GUESSER_DATA_VERSION).toContain('phase-2');
        expect(ENTITY_CATEGORIES.map(category => category.id)).toEqual([
            'troops', 'spells', 'heroes', 'pets', 'equipment'
        ]);
        expect(getEntities('troops')).toHaveLength(32);
        expect(getEntities('spells')).toHaveLength(18);
        expect(getEntities('heroes')).toHaveLength(6);
        expect(getEntities('pets')).toHaveLength(12);
        expect(getEntities('equipment')).toHaveLength(41);
        expect(validateCatalog()).toEqual([]);
    });

    it('normalizes aliases and searches only inside the selected category', () => {
        expect(normalizeGuess(' P.E.K.K.A. ')).toBe('pekka');
        expect(findEntity('e-drag', getEntities('troops'))?.id).toBe('electro-dragon');
        expect(findEntity('WB', getEntities('troops'))?.id).toBe('wall-breaker');
        expect(findEntity('fireball', getEntities('equipment'))?.hero).toBe('Grand Warden');
        expect(findEntity('fireball', getEntities('spells'))).toBeNull();
    });

    it('selects one deterministic category and answer per UTC day', () => {
        const firstCategory = getDailyCategory('2026-08-06');
        const secondCategory = getDailyCategory('2026-08-06');
        const first = getDailyEntity('2026-08-06', firstCategory);
        const second = getDailyEntity('2026-08-06', secondCategory);
        expect(firstCategory.id).toBe(secondCategory.id);
        expect(first.id).toBe(second.id);
        expect(getEntities(firstCategory.id)).toContain(first);
    });

    it('returns numeric, ordered and partial-set feedback', () => {
        const troopCategory = getCategory('troops');
        const barbarian = getEntities('troops').find(entity => entity.id === 'barbarian');
        const giant = getEntities('troops').find(entity => entity.id === 'giant');
        const troopComparison = compareEntity(barbarian, giant, troopCategory);
        expect(troopComparison.find(cell => cell.key === 'housing'))
            .toMatchObject({ state: 'wrong', direction: 'higher' });

        const spellCategory = getCategory('spells');
        const lightning = getEntities('spells').find(entity => entity.id === 'lightning-spell');
        const invisibility = getEntities('spells').find(entity => entity.id === 'invisibility-spell');
        const spellComparison = compareEntity(lightning, invisibility, spellCategory);
        expect(spellComparison.find(cell => cell.key === 'affects').state).toBe('partial');
        expect(spellComparison.find(cell => cell.key === 'unlockTier').direction).toBe('higher');
    });

    it('uses separate five and six attempt score and hint tables', () => {
        expect(calculateScore(1, 0, true, 6)).toBe(1000);
        expect(calculateScore(4, 1, true, 6)).toBe(450);
        expect(calculateScore(5, 0, true, 5)).toBe(250);
        expect(calculateScore(2, 0, false, 6)).toBe(0);
        expect(availableHintCount(2, 0, 6)).toBe(0);
        expect(availableHintCount(3, 0, 6)).toBe(1);
        expect(availableHintCount(2, 0, 5)).toBe(1);
        expect(availableHintCount(4, 1, 5)).toBe(1);
    });

    it('builds category-specific hints without revealing the answer name', () => {
        const equipment = getEntities('equipment').find(entity => entity.id === 'magic-mirror');
        const category = getCategory('equipment');
        const first = buildHint(equipment, category, 1);
        const second = buildHint(equipment, category, 2);
        expect(first).toContain('Archer Queen');
        expect(second).toContain('Clone');
        expect(`${first} ${second}`).not.toContain('Magic Mirror');
    });

    it('continues daily streaks and records category performance', () => {
        const first = updateStreak({}, '2026-08-04', true, 'troops');
        const second = updateStreak(first, '2026-08-05', false, 'spells');
        const reset = updateStreak(second, '2026-08-07', true, 'equipment');
        expect(first.currentStreak).toBe(1);
        expect(second.currentStreak).toBe(2);
        expect(second.categories.spells).toEqual({ played: 1, won: 0 });
        expect(reset.currentStreak).toBe(1);
        expect(reset.bestStreak).toBe(2);
    });

    it('creates spoiler-free share rows for partial and exact matches', () => {
        const category = getCategory('spells');
        const lightning = getEntities('spells').find(entity => entity.id === 'lightning-spell');
        const invisibility = getEntities('spells').find(entity => entity.id === 'invisibility-spell');
        const squares = resultSquares([compareEntity(lightning, invisibility, category)]);
        expect(squares[0]).toMatch(/^[🟩🟨⬛⬜]+$/u);
        expect(squares[0]).not.toContain('Invisibility');
    });
});
