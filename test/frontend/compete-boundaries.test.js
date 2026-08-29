import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    ActiveCwlWarError,
    buildWarBoardReport
} from '../../src/assets/js/war-operation-board/war-report-model.js?v=20260829-public-auth-v1';

const cwlFixtures = JSON.parse(readFileSync(
    'src/fixtures/redesign/compete-cwl.json',
    'utf8'
));
const warFixtures = JSON.parse(readFileSync(
    'src/fixtures/redesign/compete-war.json',
    'utf8'
));

describe('Compete route boundaries', () => {
    it('keeps every requested state in local fixture payloads', () => {
        expect(Object.keys(cwlFixtures)).toEqual(expect.arrayContaining([
            'cwl-no-source', 'cwl-active', 'cwl-direct-clan',
            'cwl-no-current', 'cwl-partial', 'cwl-complete', 'cwl-history'
        ]));
        expect(Object.keys(warFixtures)).toEqual(expect.arrayContaining([
            'war-no-current', 'war-preparation', 'war-live',
            'war-finished', 'war-active-cwl', 'war-missed-attacks'
        ]));
        expect(cwlFixtures['cwl-no-source'].source).toBeNull();
        expect(cwlFixtures['cwl-no-current'].source.noActive).toBe(true);
    });

    it('represents no current regular war without stale roster data', () => {
        const report = buildWarBoardReport({ state: 'notInWar' }, '#FIXWAR');
        expect(report.state).toBe('notAvailable');
        expect(report.wars).toEqual([]);
        expect(report.roster).toEqual([]);
        expect(report.opponent).toBeNull();
    });

    it('keeps active CWL wars out of Regular War and exposes the handoff code', () => {
        expect(() => buildWarBoardReport({
            tag: '#FIXCWLWAR',
            state: 'inWar',
            isLeagueWar: true
        }, '#FIXWAR')).toThrow(ActiveCwlWarError);
        try {
            buildWarBoardReport({ tag: '#FIXCWLWAR', state: 'inWar' }, '#FIXWAR');
        } catch (error) {
            expect(error.code).toBe('ACTIVE_CWL_WAR');
        }
    });

    it('keeps responsive interaction contracts local to the two modules', () => {
        const css = readFileSync('src/assets/css/compete-board.css', 'utf8');
        const warHtml = readFileSync(
            'src/subpages/war-operation-board.html',
            'utf8'
        );
        const cwlHtml = readFileSync(
            'src/subpages/cwl-operation-board.html',
            'utf8'
        );
        expect(css).toContain('@media (max-width: 620px)');
        expect(css).toContain('min-height: 44px');
        expect(css).toContain('prefers-reduced-motion: reduce');
        expect(warHtml).toContain('role="tablist"');
        expect(warHtml).toContain('role="tabpanel"');
        expect(cwlHtml).toContain('data-op-source-mode="direct"');
        expect(cwlHtml).toContain('aria-live="polite"');
    });
});
