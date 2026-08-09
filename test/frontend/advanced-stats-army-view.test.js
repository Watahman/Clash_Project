import { describe, expect, it } from 'vitest';
import { isPlayerFacingUnitName, presentArmy } from '../../src/assets/js/pages/advanced-stats-army-view.js';

describe('Advanced Stats army presentation', () => {
    it('uses real troop names instead of category totals', () => {
        const army = {
            units: [
                { key: 'troop:1', category: 'TROOP', quantity: 8 },
                { key: 'troop:2', category: 'TROOP', quantity: 4 },
                { key: 'spell:1', category: 'SPELL', quantity: 3 },
                { key: 'hero:1', category: 'HERO', quantity: 1 },
                { key: 'pet:1', category: 'PET', quantity: 1 },
                { key: 'equipment:1', category: 'EQUIPMENT', quantity: 2 }
            ]
        };
        const catalog = [
            { key: 'troop:1', category: 'TROOP', name: 'Root Rider' },
            { key: 'troop:2', category: 'TROOP', name: 'Valkyrie' },
            { key: 'spell:1', category: 'SPELL', name: 'Freeze Spell' },
            { key: 'hero:1', category: 'HERO', name: 'Archer Queen' },
            { key: 'pet:1', category: 'PET', name: 'Unicorn' },
            { key: 'equipment:1', category: 'EQUIPMENT', name: 'Frozen Arrow' }
        ];

        const presentation = presentArmy(army, catalog, 'Army composition');

        expect(presentation.label).toBe('8× Root Rider + 4× Valkyrie');
        expect(presentation.units).toEqual([
            '8× Root Rider',
            '4× Valkyrie',
            '3× Freeze Spell'
        ]);
        expect(presentation.units.join(' ')).not.toMatch(/hero|pet|equipment/i);
    });

    it('uses a player-facing fallback when names are unavailable', () => {
        const presentation = presentArmy(
            { units: [{ key: 'troop:unknown', category: 'TROOP', quantity: 16 }] },
            [],
            'Army composition'
        );

        expect(presentation).toEqual({
            label: 'Army composition',
            units: [],
            hiddenCount: 0
        });
    });

    it('hides unresolved internal unit identifiers', () => {
        const presentation = presentArmy({
            units: [
                { key: 'unknown:4000185', category: 'TROOP', name: 'Unknown troop (4000185)', quantity: 50 },
                { key: 'troop:7', category: 'TROOP', name: 'Healer', quantity: 5 }
            ]
        }, [], 'Army composition');

        expect(presentation.label).toBe('5× Healer');
        expect(presentation.units).toEqual(['5× Healer']);
        expect(isPlayerFacingUnitName('Unknown troop (4000185)')).toBe(false);
        expect(isPlayerFacingUnitName('troop:4000185')).toBe(false);
        expect(isPlayerFacingUnitName('Meteor Golem')).toBe(true);
    });
});
