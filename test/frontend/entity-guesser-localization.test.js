import { describe, expect, it } from 'vitest';
import {
    ENTITY_CATEGORIES,
    ENTITIES,
    getCategory
} from '../../src/assets/js/minigames/entity-guesser-catalog.js';
import {
    buildHint,
    compareEntity
} from '../../src/assets/js/minigames/entity-guesser-engine-v2.js';
import { createEntityGuessBoard } from '../../src/assets/js/minigames/entity-guesser-board.js';
import { getEntityGameFixture } from '../../src/assets/js/minigames/minigames-fixtures.js';
import {
    ENTITY_GUESSER_VALUE_COPY,
    formatLocalizedValue
} from '../../src/assets/js/minigames/entity-guesser-value-copy.js';

const LOCALES = ['en', 'nl', 'fr', 'de', 'es'];
const cannon = ENTITIES.find(entity => entity.id === 'cannon');
const defenses = getCategory('defenses');

const HINTS = {
    en: {
        defenses: 'Defense · targets ground · single target effect.',
        otherBuildings: 'Army building · troops system.',
        troopsHeroes: 'Troop · ground movement · targets ground & air.',
        spellsEquipment: 'Equipment · active activation · clone effect.'
    },
    nl: {
        defenses: 'Verdediging · doelen grond · eén doel-effect.',
        otherBuildings: 'Leger-gebouw · troepen-systeem.',
        troopsHeroes: 'Troep · grond-beweging · doelen grond & lucht.',
        spellsEquipment: 'Uitrusting · actief-activering · kloon-effect.'
    },
    fr: {
        defenses: 'Défense · cibles : sol · effet cible unique.',
        otherBuildings: 'Bâtiment Armée · système troupes.',
        troopsHeroes: 'Troupe · mouvement sol · cibles : sol et air.',
        spellsEquipment: 'Équipement · activation actif · effet clone.'
    },
    de: {
        defenses: 'Verteidigung · Ziele: boden · einzelziel-Effekt.',
        otherBuildings: 'Armee-Gebäude · truppen-System.',
        troopsHeroes: 'Truppe · boden-Bewegung · Ziele: boden und luft.',
        spellsEquipment: 'Ausrüstung · aktiv-Aktivierung · klon-Effekt.'
    },
    es: {
        defenses: 'Defensa · objetivos: tierra · efecto objetivo único.',
        otherBuildings: 'Edificio Ejército · sistema tropas.',
        troopsHeroes: 'Tropa · movimiento tierra · objetivos: tierra y aire.',
        spellsEquipment: 'Equipamiento · activación activo · efecto clon.'
    }
};

const HINT_SAMPLES = [
    ['defenses', 'cannon'],
    ['otherBuildings', 'army-camp'],
    ['troopsHeroes', 'archer'],
    ['spellsEquipment', 'magic-mirror']
];

function entity(id) {
    return ENTITIES.find(item => item.id === id);
}

describe('Entity Guesser categorical localization', () => {
    it('registers every current catalog comparison value in the shared layer', () => {
        const values = new Set();
        ENTITY_CATEGORIES.forEach(category => {
            category.columns.forEach(column => {
                ENTITIES.filter(entity => entity.categoryId === category.id).forEach(item => {
                    const raw = item[column.key];
                    (Array.isArray(raw) ? raw : [raw]).forEach(value => {
                        values.add(typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value));
                    });
                });
            });
        });
        expect([...values].filter(value => !ENTITY_GUESSER_VALUE_COPY[value])).toEqual([]);
    });

    it('formats representative values intentionally in every supported locale', () => {
        const expectedTargets = {
            en: 'Ground & Air',
            nl: 'Grond & Lucht',
            fr: 'Sol et Air',
            de: 'Boden und Luft',
            es: 'Tierra y Aire'
        };
        const expectedCells = {
            en: ['Defense', 'Ground', 'Single target', 'Projectile', 'Basic defense', 'Always active', 'No'],
            nl: ['Verdediging', 'Grond', 'Eén doel', 'Projectiel', 'Basisverdediging', 'Altijd actief', 'Nee'],
            fr: ['Défense', 'Sol', 'Cible unique', 'Projectile', 'Défense de base', 'Toujours actif', 'Non'],
            de: ['Verteidigung', 'Boden', 'Einzelziel', 'Projektil', 'Grundverteidigung', 'Immer aktiv', 'Nein'],
            es: ['Defensa', 'Tierra', 'Objetivo único', 'Proyectil', 'Defensa básica', 'Siempre activo', 'No']
        };

        LOCALES.forEach(locale => {
            expect(formatLocalizedValue(['Ground', 'Air'], locale)).toBe(expectedTargets[locale]);
            expect(compareEntity(cannon, cannon, defenses, locale)
                .filter(cell => cell.key !== 'coverage')
                .map(cell => cell.displayValue)).toEqual(expectedCells[locale]);
        });
    });

    it('generates category-specific hints in all five locales', () => {
        LOCALES.forEach(locale => {
            HINT_SAMPLES.forEach(([categoryId, entityId]) => {
                const category = getCategory(categoryId);
                expect(buildHint(entity(entityId), category, 1, locale))
                    .toBe(HINTS[locale][categoryId]);
            });
        });
    });

    it('keeps German comparison cells and hints free of the known English leaks', () => {
        const comparison = compareEntity(cannon, cannon, defenses, 'de');
        const output = [
            ...comparison.map(cell => cell.displayValue),
            formatLocalizedValue(['Ground', 'Air'], 'de'),
            buildHint(cannon, defenses, 1, 'de'),
            buildHint(cannon, defenses, 2, 'de')
        ].join(' | ');

        [
            'Defense',
            'Ground',
            'Air',
            'Single target',
            'Projectile',
            'Basic defense',
            'Always active'
        ].forEach(rawValue => expect(output).not.toContain(rawValue));
    });

    it('uses localized display values in accessible cell labels and titles', () => {
        const elements = {
            header: document.createElement('div'),
            rows: document.createElement('div')
        };
        const board = createEntityGuessBoard({
            elements,
            getCategory: () => defenses,
            getState: () => ({ guesses: ['cannon'] }),
            getEntities: () => [cannon],
            getAnswer: () => cannon,
            compareEntity: (guess, answer, category) => compareEntity(guess, answer, category, 'de'),
            text: key => key,
            appendImage: () => {}
        });

        board.render();
        const cells = [...elements.rows.querySelectorAll('.guess-cell')];
        expect(cells[1].textContent).toContain('Verteidigung');
        expect(cells[1].getAttribute('aria-label')).toContain('Verteidigung');
        expect(cells[1].title).toContain('Verteidigung');
        expect(cells[6].getAttribute('aria-label')).toContain('Grundverteidigung');
        expect(cells[6].title).toContain('Grundverteidigung');
    });

    it('localizes fixture hints and safely falls back for future values or locales', () => {
        const fixture = getEntityGameFixture('entity-mid', '2026-08-11', 'de');
        expect(fixture.hints[0]).toContain('Verteidigung');
        expect(fixture.hints[0]).not.toContain('Support');
        expect(formatLocalizedValue('Future categorical value', 'de'))
            .toBe('Future categorical value');
        expect(formatLocalizedValue('Future categorical value', 'it'))
            .toBe('Future categorical value');
        expect(formatLocalizedValue('7', 'de')).toBe('7');
        expect(ENTITY_CATEGORIES).toHaveLength(4);
    });
});
