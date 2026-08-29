import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyI18n, getLanguage, setLanguage } from '../../src/assets/js/i18n/i18n.js?v=20260829-public-auth-v1';
import { getTranslationValue } from '../../src/assets/js/i18n/runtime-translations.js?v=20260829-public-auth-v1';
import {
    applyCompeteI18n,
    competeLocales,
    competeT,
    initCompeteI18n
} from '../../src/assets/js/operation-board/compete-locales.js?v=20260829-public-auth-v1';
import { buildWarBoardReport } from '../../src/assets/js/war-operation-board/war-report-model.js?v=20260829-public-auth-v1';
import { fixtureWar } from '../../src/assets/js/war-operation-board/war-page-utils.js?v=20260829-public-auth-v1';
import { buildWarHistory } from '../../src/assets/js/war-operation-board/war-history-model.js';
import {
    renderRoster,
    renderScoreStrip,
    renderStats
} from '../../src/assets/js/war-operation-board/war-renderer.js?v=20260829-public-auth-v1';
import { renderWarHistory } from '../../src/assets/js/war-operation-board/war-history-renderer.js?v=20260829-public-auth-v1';

const LANGUAGES = ['nl', 'en', 'fr', 'de', 'es'];
const WAR_FIXTURES = JSON.parse(readFileSync(
    'src/fixtures/redesign/compete-war.json',
    'utf8'
));
const LOCAL_KEYS = Object.keys(competeLocales.en);
const MARKUP_FILES = [
    'src/subpages/cwl-operation-board.html',
    'src/subpages/war-operation-board.html'
];

describe('Compete i18n coverage', () => {
    it('keeps complete local key parity without relying on English fallback', () => {
        const englishKeys = [...Object.keys(competeLocales.en)].sort();

        LANGUAGES.forEach(language => {
            expect(Object.keys(competeLocales[language]).sort(), language)
                .toEqual(englishKeys);
            LOCAL_KEYS.forEach(key => {
                expect(competeLocales[language][key], `${language}:${key}`)
                    .toBeTruthy();
            });
        });
    });

    it('resolves every local key used by both Compete board documents', async () => {
        const markupKeys = new Set();
        const pattern = /data-compete-(?:i18n|aria-label|placeholder|content)="([^"]+)"/g;

        MARKUP_FILES.forEach(file => {
            const source = readFileSync(file, 'utf8');
            for (const match of source.matchAll(pattern)) markupKeys.add(match[1]);
        });

        expect(markupKeys.size).toBeGreaterThan(0);
        markupKeys.forEach(key => {
            expect(LOCAL_KEYS, key).toContain(key);
        });

        for (const language of LANGUAGES) {
            await useLanguage(language);
            markupKeys.forEach(key => {
                expect(competeT(key), `${language}:${key}`).toBe(competeLocales[language][key]);
            });
        }
    });

    it('keeps retained global markup keys translated on both Compete documents', () => {
        const globalKeys = new Set();
        const pattern = /data-i18n(?:-html|-placeholder|-title|-aria-label)?="([^"]+)"/g;

        MARKUP_FILES.forEach(file => {
            const source = readFileSync(file, 'utf8');
            for (const match of source.matchAll(pattern)) globalKeys.add(match[1]);
        });

        expect(globalKeys.size).toBeGreaterThan(0);
        globalKeys.forEach(key => {
            LANGUAGES.forEach(language => {
                const value = getTranslationValue(language, key);
                expect(value, `${language}:${key}`).toBeTruthy();
                expect(value, `${language}:${key}`).not.toBe(key);
            });
        });
    });

    it('switches through every supported language without local key leakage', async () => {
        const root = document.createElement('div');
        root.innerHTML = `
            <h1 data-compete-i18n="war.heroTitle"></h1>
            <p data-compete-i18n="war.heroLead"></p>
            <p data-compete-i18n="cwl.noSourceHelp"></p>
            <input data-compete-placeholder="war.clanTag">
            <meta data-compete-content="war.documentDescription">
        `;

        for (const language of LANGUAGES) {
            await useLanguage(language);
            applyI18n(root);
            applyCompeteI18n(root);

            LOCAL_KEYS.forEach(key => {
                const value = competeT(key);
                expect(value, `${language}:${key}`).not.toBe(key);
                expect(value, `${language}:${key}`).not.toMatch(/^(war|cwl)\./);
                expect(value, `${language}:${key}`).toBe(competeLocales[language][key]);
            });
            root.querySelectorAll('[data-compete-i18n]').forEach(element => {
                expect(element.textContent.trim()).not.toBe(element.dataset.competeI18n);
            });
            root.querySelectorAll('[data-compete-placeholder]').forEach(element => {
                expect(element.getAttribute('placeholder')).not.toBe(element.dataset.competePlaceholder);
            });
            root.querySelectorAll('[data-compete-content]').forEach(element => {
                expect(element.getAttribute('content')).not.toBe(element.dataset.competeContent);
            });
        }

        await useLanguage('en');
        const englishHero = competeT('war.heroTitle');
        for (const language of LANGUAGES.filter(item => item !== 'en')) {
            await useLanguage(language);
            expect(competeT('war.heroTitle')).not.toBe(englishHero);
            expect(competeT('war.heroLead')).not.toBe(
                'Live score, base state and attack decisions for one regular war.'
            );
        }
    });

    it('re-applies module copy when the shared language event fires', async () => {
        const root = document.createElement('div');
        root.innerHTML = '<h1 data-compete-i18n="war.heroTitle"></h1>';
        await useLanguage('en');
        initCompeteI18n(root);
        const english = root.querySelector('h1').textContent;

        setLanguage('de');
        await flushLanguageChange();

        expect(getLanguage()).toBe('de');
        expect(root.querySelector('h1').textContent).toBe(competeT('war.heroTitle'));
        expect(root.querySelector('h1').textContent).not.toBe(english);
    });

    it('keeps regular-war renderer state copy translated in every non-English language', async () => {
        const report = buildWarBoardReport(
            WAR_FIXTURES['war-live'].currentWar,
            '#FIXWAR'
        );
        const history = buildWarHistory([], '#FIXWAR');
        const forbiddenEnglish = [
            'Projection building',
            'No players match this filter.',
            'Attack usage',
            'No public regular-war history is available for this clan.',
            'Date unavailable'
        ];

        for (const language of LANGUAGES) {
            await useLanguage(language);
            const score = document.createElement('section');
            const roster = document.createElement('section');
            const stats = document.createElement('section');
            const historySummary = document.createElement('section');
            const historyList = document.createElement('section');

            renderScoreStrip(score, report);
            renderRoster(roster, report);
            renderStats(stats, report);
            renderWarHistory(historySummary, historyList, history);
            const output = [score, roster, stats, historySummary, historyList]
                .map(element => element.textContent)
                .join(' ');

            if (language !== 'en') {
                forbiddenEnglish.forEach(copy => {
                    expect(output, `${language} leaked: ${copy}`).not.toContain(copy);
                });
            }
        }
    });

    it('renders live fixture time relative to its deterministic reference clock', async () => {
        await useLanguage('en');
        const fixture = { data: WAR_FIXTURES['war-live'] };
        const report = buildWarBoardReport(fixtureWar(fixture), '#FIXWAR');
        const score = document.createElement('section');

        renderScoreStrip(score, report);

        expect(score.textContent).toContain('6h 0m remaining');
        expect(score.textContent).not.toContain('634608');
    });
});

async function useLanguage(language) {
    setLanguage(language);
    await flushLanguageChange();
}

function flushLanguageChange() {
    return new Promise(resolve => setTimeout(resolve, 0));
}
