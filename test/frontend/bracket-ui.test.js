import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { bracketChampion, createBracket } from '../../src/assets/js/bracket/bracket-engine.js';
import { createBracketFixture } from '../../src/assets/js/bracket/bracket-fixtures.js';
import { participantName } from '../../src/assets/js/bracket/bracket-model.js';
import {
    drawBracketConnectors,
    renderBracketBoard
} from '../../src/assets/js/bracket/bracket-renderer.js';

const privateHtml = readFileSync('src/subpages/bracket-generator.html', 'utf8');
const privateCss = readFileSync('src/assets/css/bracket.css', 'utf8');
const canvasCss = readFileSync('src/assets/css/bracket-canvas.css', 'utf8');
const responsiveCss = readFileSync('src/assets/css/bracket-responsive.css', 'utf8');
const pageSource = readFileSync('src/assets/js/pages/bracket-generator.js', 'utf8');
const controllerSource = readFileSync('src/assets/js/bracket/bracket-page-controller.js', 'utf8');
const storageSource = readFileSync('src/assets/js/bracket/bracket-page-storage.js', 'utf8');
const fileSource = readFileSync('src/assets/js/bracket/bracket-page-files.js', 'utf8');
const eventSource = readFileSync('src/assets/js/bracket/bracket-page-events.js', 'utf8');
const rendererSource = readFileSync('src/assets/js/bracket/bracket-renderer.js', 'utf8');
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
        expect(pageSource.split(/\r?\n/).length).toBeLessThanOrEqual(300);
        expect(controllerSource.split(/\r?\n/).length).toBeLessThanOrEqual(300);
        expect(controllerSource).toContain('onRoundChange: this.setRound');
        expect(controllerSource).toContain('this.connectorRenderer(this.refs.board, this.state.bracket)');
    });

    it('keeps restore, reset, import and winner-change state local to the module', () => {
        expect(pageSource).toContain('createBracketController');
        expect(storageSource).toContain('storage?.getItem(key)');
        expect(storageSource).toContain('storage?.removeItem(key)');
        expect(fileSource).toContain('BRACKET_IMPORT_MAX_BYTES');
        expect(controllerSource).toContain('readBracketFile(file, importBracket)');
        expect(controllerSource).toContain('setMatchWinner(this.state.bracket, match.id, player)');
        expect(eventSource).toContain('controller.confirmReset()');
        expect(copySource).toContain('Nothing was changed');
    });

    it('renders imported participant text without treating it as markup or a selector', () => {
        const board = document.createElement('section');
        const navigation = document.createElement('div');
        document.body.append(board, navigation);
        const unsafeName = '<img src=x onerror=alert(1)>"seed';
        const bracket = createBracket([unsafeName, 'B', 'C', 'D']);

        renderBracketBoard({
            board,
            navigation,
            bracket,
            activeRound: 0,
            onWinner: () => {},
            onRoundChange: () => {}
        });
        drawBracketConnectors(board, bracket);

        expect(board.querySelector('img')).toBeNull();
        expect(board.textContent).toContain(unsafeName);
        expect(rendererSource).not.toContain('querySelector(`[data-match-id="${match.id}"]`)');
        board.remove();
        navigation.remove();
    });
});

describe('bracket public release surface', () => {
    it('keeps canonical metadata and points the public CTA at the private editor', () => {
        const document = new JSDOM(publicHtml).window.document;
        expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href'))
            .toBe('https://clashpanel.com/bracket-generator');
        expect(document.querySelector('meta[name="robots"]')?.getAttribute('content'))
            .toMatch(/\bindex\b/i);
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
        expect(participantName(bracket, bracketChampion(bracket))).toBe('Northwind');
        expect(bracket.updatedAt).toBe('2026-01-01T00:00:00.000Z');
    });
});
