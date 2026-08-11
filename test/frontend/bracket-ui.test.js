import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { bracketChampion } from '../../src/assets/js/bracket/bracket-engine.js';
import { createBracketFixture } from '../../src/assets/js/bracket/bracket-fixtures.js';

const privateHtml = readFileSync('src/subpages/bracket-generator.html', 'utf8');
const privateCss = readFileSync('src/assets/css/bracket.css', 'utf8');
const canvasCss = readFileSync('src/assets/css/bracket-canvas.css', 'utf8');
const responsiveCss = readFileSync('src/assets/css/bracket-responsive.css', 'utf8');
const pageSource = readFileSync('src/assets/js/pages/bracket-generator.js', 'utf8');
const copySource = readFileSync('src/assets/js/bracket/bracket-copy.js', 'utf8');
const publicHtml = readFileSync('src/bracket-generator.html', 'utf8');

describe('bracket workspace surface', () => {
    it('keeps the live editor on its app route with every core control', () => {
        expect(privateHtml).not.toContain('window.location.replace');
        expect(privateHtml).not.toMatch(/coming\s+soon/i);
        [
            'bracket-name', 'bracket-participants', 'bracket-generate-seeded',
            'bracket-generate-shuffled', 'bracket-import', 'bracket-export',
            'bracket-reset', 'bracket-board', 'bracket-round-navigation',
            'bracket-round-prev', 'bracket-round-next', 'bracket-reset-dialog'
        ].forEach(id => expect(privateHtml).toContain(`id="${id}"`));
    });

    it('supports large brackets with a round-by-round mobile model', () => {
        expect(responsiveCss).toContain('.bracket-round[data-active="true"]');
        expect(responsiveCss).toContain('min-height: 44px');
        expect(`${privateCss}\n${canvasCss}`).toContain('.bracket-connectors');
        expect(`${privateCss}\n${canvasCss}`).toContain('.bracket-connector.is-active');
        expect(pageSource).toContain('onRoundChange: changeRound');
        expect(pageSource).toContain('drawBracketConnectors(refs.board, bracket)');
    });

    it('keeps restore, reset, import and winner-change state local to the module', () => {
        expect(pageSource).toContain('localStorage.getItem(STORAGE_KEY)');
        expect(pageSource).toContain('localStorage.removeItem(STORAGE_KEY)');
        expect(pageSource).toContain('const imported = importBracket(await file.text())');
        expect(pageSource).toContain('setMatchWinner(bracket, match.id, player)');
        expect(copySource).toContain('Nothing was changed');
    });
});

describe('bracket public release surface', () => {
    it('keeps canonical metadata and points the public CTA at the private editor', () => {
        const document = new JSDOM(publicHtml).window.document;
        expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href'))
            .toBe('https://clashpanel.com/bracket-generator');
        expect(document.querySelector('meta[name="robots"]')?.getAttribute('content'))
            .toMatch(/noindex/i);
        expect(document.querySelectorAll('h1')).toHaveLength(1);
        expect(document.querySelector('a[href="/app/brackets"]')).not.toBeNull();
        expect(document.querySelector('.bracket-public-preview')).not.toBeNull();
        expect(document.querySelector('.home-v2-bottom-cta')).not.toBeNull();
    });
});

describe('bracket boundary fixtures', () => {
    it.each(['bracket-4', 'bracket-8', 'bracket-12-byes', 'bracket-32'])('%s uses the real engine', id => {
        const bracket = createBracketFixture(id);
        expect(bracket.participants.length).toBeGreaterThanOrEqual(4);
        expect(bracket.rounds[0].some(match => match.players.includes(null))).toBe(id === 'bracket-12-byes');
    });

    it('has a deterministic completed champion fixture', () => {
        const bracket = createBracketFixture('bracket-complete');
        expect(bracketChampion(bracket)).toBe('Northwind');
        expect(bracket.updatedAt).toBe('2026-01-01T00:00:00.000Z');
    });
});
