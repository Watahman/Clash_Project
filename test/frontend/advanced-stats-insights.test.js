import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    advancedStatsInsightsColumns,
    renderLeague,
    renderProgression,
    renderWarCwl,
    syncInsightTabs
} from '../../src/assets/js/pages/advanced-stats-insights-renderer.js?v=20260916-advanced-insights-v1';
import { advancedStatsInsightsLocales } from '../../src/assets/js/i18n/advanced-stats-insights-locales.js?v=20260916-advanced-insights-v1';
import { advancedStatsInsightsControlsLocales } from '../../src/assets/js/i18n/advanced-stats-insights-controls-locales.js?v=20260917-advanced-insights-v2';
import { translations } from '../../src/assets/js/i18n/runtime-translations.js?v=20260909-battledata-v1';

const page = () => new DOMParser().parseFromString(
    readFileSync('src/subpages/advanced-stats.html', 'utf8'),
    'text/html'
);

describe('Advanced Stats insights tabs', () => {
    it('defines four keyboard-addressable tabs and panels', () => {
        const document = page();
        const tabs = [...document.querySelectorAll('[role="tab"]')];
        const panels = [...document.querySelectorAll('[role="tabpanel"]')];

        expect(tabs).toHaveLength(4);
        expect(panels).toHaveLength(4);
        expect(tabs.map(tab => tab.dataset.advancedStatsTab)).toEqual([
            'overview', 'warCwl', 'progression', 'league'
        ]);
        tabs.forEach(tab => {
            const panel = document.getElementById(tab.getAttribute('aria-controls'));
            expect(panel?.getAttribute('aria-labelledby')).toBe(tab.id);
            expect(tab.type).toBe('button');
        });
        expect(tabs.filter(tab => tab.getAttribute('aria-selected') === 'true')).toHaveLength(1);
        expect(document.querySelector('#advanced-stats-tab-overview')?.getAttribute('aria-selected')).toBe('true');
        expect(document.querySelector('#advanced-stats-panel-overview')?.hidden).toBe(false);
        expect(document.querySelector('[data-insights-current-season]')?.getAttribute('aria-pressed')).toBe('false');
    });

    it('keeps every existing overview renderer hook inside the overview panel', () => {
        const document = page();
        const overview = document.querySelector('#advanced-stats-panel-overview');
        for (const id of [
            'advanced-stats-summary-section',
            'advanced-stats-lifetime-section',
            'advanced-stats-trends-section',
            'advanced-stats-armies-section',
            'advanced-stats-units-section',
            'advanced-stats-battles-section',
            'advanced-stats-categories',
            'advanced-stats-trend-metrics',
            'advanced-stats-units',
            'advanced-stats-armies',
            'advanced-stats-battles'
        ]) expect(overview?.querySelector(`#${id}`), id).not.toBeNull();
        expect(document.querySelector('.advanced-stats__toolbar--global #advanced-stats-periods')).not.toBeNull();
        expect(document.querySelectorAll('[data-advanced-stats-root]')).toHaveLength(3);
    });

    it('switches selected tab and panel state without changing root contracts', () => {
        const document = page();
        syncInsightTabs(document, 'progression');

        expect(document.querySelector('#advanced-stats-tab-progression')?.getAttribute('aria-selected')).toBe('true');
        expect(document.querySelector('#advanced-stats-tab-overview')?.getAttribute('aria-selected')).toBe('false');
        expect(document.querySelector('#advanced-stats-panel-progression')?.hidden).toBe(false);
        expect(document.querySelector('#advanced-stats-panel-overview')?.hidden).toBe(true);
        expect(document.querySelector('#advanced-stats-tab-progression')?.tabIndex).toBe(0);
        expect(document.querySelector('#advanced-stats-tab-overview')?.tabIndex).toBe(-1);
    });

    it('renders partial war data and leaves absent metrics unknown', () => {
        const document = page();
        const root = document.querySelector('#advanced-stats-war-cwl-root');
        renderWarCwl(root, {
            state: 'partial',
            rows: [{ season: '2026-09', mode: 'war', availableAttacks: 0, usedAttacks: 0 }]
        });

        expect(root.dataset.state).toBe('partial');
        expect(root.querySelector('[data-insights-state="partial"]')?.hidden).toBe(false);
        expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
        expect(root.querySelector('tbody tr')?.textContent).toContain('2026-09');
        expect(root.querySelector('tbody tr')?.textContent).toContain('0');
        expect(root.querySelectorAll('tbody td [data-state="unknown"]').length).toBeGreaterThan(0);
        expect(root.querySelector('tbody')?.textContent).not.toContain('undefined');
    });

    it('renders regular and CWL summaries from the scoped war response', () => {
        const document = page();
        const root = document.querySelector('#advanced-stats-war-cwl-root');
        const response = {
            section: 'warCwl', playerTag: '#PLAYER', period: '30d', status: 'ACTIVE',
            data: {
                status: 'partial',
                modes: {
                    regular: {
                        warCount: 2, attackCount: 33, avgStars: 2.4, avgDestruction: 81, tripleRate: 57.6,
                        starBuckets: { three: 19 }, matchups: { same: 10, up: 12, down: 11 },
                        trend: { points: [{ bucket: '2026-08', attackCount: 33, avgStars: 2.4 }] }
                    },
                    cwl: { status: 'unavailable' }
                },
                coverage: { state: 'partial', warCount: 2 }
            }
        };
        renderWarCwl(root, response);

        expect(root.dataset.state).toBe('partial');
        expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
        expect(root.querySelector('tbody')?.textContent).toMatch(/2[,.]4/);
        expect(root.querySelector('tbody')?.textContent).toContain('81');
        expect(root.querySelector('tbody')?.textContent).toMatch(/57[,.]6/);
        expect(root.querySelector('tbody')?.textContent).toContain('Same level');
        expect(root.querySelector('.advanced-stats__insights-coverage')?.textContent).toContain('2');
        expect(root.querySelector('.advanced-stats__insights-summary-grid')).not.toBeNull();
        expect(root.querySelector('.advanced-stats__insights-trends')).not.toBeNull();
        expect(root.querySelector('.advanced-stats__insights-summary')?.textContent).toContain('19/33');
        expect(root.querySelector('.advanced-stats__insights-trends')?.textContent).toContain('2026-08');
        expect(root.querySelector('[data-insights-mode="cwl"] .advanced-stats__insights-no-summary')).not.toBeNull();
    });

    it('replaces rendered insight content when the same response is rendered again', () => {
        const document = page();
        const root = document.querySelector('#advanced-stats-war-cwl-root');
        const response = {
            state: 'ready',
            rows: [{ season: '2026-09', mode: 'war', attacks: 2 }],
            coverage: { state: 'ready', warCount: 1 }
        };

        renderWarCwl(root, response);
        renderWarCwl(root, response);

        expect(root.querySelectorAll('.advanced-stats__insights-coverage')).toHaveLength(1);
        expect(root.querySelectorAll('.advanced-stats__insights-table-wrap')).toHaveLength(1);
        expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
    });

    it('shows source-backed CWL league and clan position only for a season', () => {
        const document = page();
        const root = document.querySelector('#advanced-stats-war-cwl-root');
        renderWarCwl(root, {
            data: {
                status: 'partial', regular: { status: 'ready', attackCount: 2 },
                cwl: { status: 'partial', seasons: [{
                    season: '2026-09', seasonBasis: 'clashking_player_cwl_history',
                    clanName: 'Old Clan', league: 'Master League II', position: 2, attackCount: 3,
                    missedAttacks: 1
                }] },
                coverage: { state: 'partial', source: 'ClashKing V2' }
            }
        });

        const headings = [...root.querySelectorAll('thead th')].map(cell => cell.textContent);
        const rows = [...root.querySelectorAll('tbody tr')];
        expect(headings).toContain('League');
        expect(headings).toContain('Clan');
        expect(headings).toContain('CWL position');
        expect(rows).toHaveLength(3);
        expect(rows[0].textContent).not.toContain('Master League II');
        expect(rows[2].textContent).toContain('Master League II');
        expect(rows[2].textContent).toContain('Old Clan');
        expect(rows[2].textContent).toContain('2');
        expect(root.querySelector('.advanced-stats__insights-coverage')?.textContent)
            .toContain('ClashKing V2');
    });

    it('renders progression events without inventing dates or levels', () => {
        const document = page();
        const root = document.querySelector('#advanced-stats-progression-root');
        renderProgression(root, {
            state: 'ready',
            coverage: { status: 'partial', eventCount: 1 },
            changes: [{ name: 'Town Hall', eventAt: '2026-09-14', previous: 16, current: 17, delta: 1 }]
        });

        expect(root.dataset.state).toBe('ready');
        expect(root.querySelector('[data-insights-content]')?.hidden).toBe(false);
        expect(root.querySelector('tbody tr')?.textContent).toContain('Town Hall');
        expect(root.querySelector('tbody tr')?.textContent).toContain('2026-09-14');
        expect(root.querySelector('tbody tr')?.textContent).toContain('16');
        expect(root.querySelector('tbody tr')?.textContent).toContain('17');
        expect(root.querySelector('tbody tr')?.textContent).toContain('1');
        expect(root.querySelector('.advanced-stats__insights-coverage')?.textContent).toContain('1');
        expect(root.querySelector('tbody tr')?.querySelectorAll('[data-state="unknown"]')).toHaveLength(0);
    });

    it('does not present a ready progression table without historical events', () => {
        const document = page();
        const root = document.querySelector('#advanced-stats-progression-root');
        renderProgression(root, {
            status: 'COMPLETE',
            coverage: { status: 'COMPLETE', hasHistoricalData: false },
            changes: [{ name: 'Ignored without history', delta: 1 }]
        });
        expect(root.dataset.state).toBe('empty');
        expect(root.querySelector('[data-insights-state="empty"]')?.hidden).toBe(false);
        expect(root.querySelector('tbody')).toBeNull();

        renderProgression(root, {
            status: 'COMPLETE',
            coverage: { status: 'COMPLETE', hasHistoricalData: false, sources: [{ state: 'degraded' }] },
            changes: []
        });
        expect(root.dataset.state).toBe('partial');
        expect(root.querySelector('[data-insights-state="partial"]')?.hidden).toBe(false);
        expect(root.querySelector('tbody')).toBeNull();

        renderProgression(root, {
            status: 'COMPLETE',
            coverage: { status: 'UNAVAILABLE', hasHistoricalData: false },
            changes: [{ name: 'No source', delta: 1 }]
        });
        expect(root.dataset.state).toBe('unavailable');
        expect(root.querySelector('[data-insights-state="unavailable"]')?.hidden).toBe(false);
        expect(root.querySelector('tbody')).toBeNull();
    });

    it('keeps null league data explicitly unavailable and empty rows honest', () => {
        const document = page();
        const root = document.querySelector('#advanced-stats-league-root');
        renderLeague(root, null);
        expect(root.dataset.state).toBe('unavailable');
        expect(root.querySelector('[data-insights-state="unavailable"]')?.hidden).toBe(false);
        expect(root.querySelector('[data-insights-content]')?.children).toHaveLength(0);

        renderLeague(root, { state: 'empty', rows: [] });
        expect(root.dataset.state).toBe('empty');
        expect(root.querySelector('[data-insights-state="empty"]')?.hidden).toBe(false);
    });

    it('renders separate Ranked and Legends season rows', () => {
        const document = page();
        const root = document.querySelector('#advanced-stats-league-root');
        renderLeague(root, {
            status: 'COMPLETE',
            modes: {
                ranked: { seasons: [{ season: '2026-08', summary: { league: 'Champion', position: 8, stars: 12 } }] },
                legend: { seasons: [{ season: '2026-08', summary: { league: 'Legends', rank: 1200, stars: 18 } }] }
            }
        });

        expect(root.dataset.state).toBe('ready');
        expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
        const tableText = root.querySelector('tbody')?.textContent || '';
        expect(tableText).toContain('Ranked');
        expect(tableText).toContain('Legends');
        expect(tableText).toContain('Champion');
        expect(tableText).toMatch(/1[.,]200/);
    });

    it('explains an unverified current season selection', () => {
        const document = page();
        const root = document.querySelector('#advanced-stats-league-root');
        renderLeague(root, {
            status: 'PARTIAL',
            lastUpdated: '2026-09-17T12:00:00Z',
            modes: {
                ranked: {
                    selection: { requested: 'current-season', verifiedCurrent: false, basis: 'latest_observed_player_history' },
                    seasons: [{ season: '2026-08', attacks: 4 }]
                }
            },
            coverage: { state: 'partial', source: 'clashking-v2', seasonCount: 1 }
        });
        expect(root.querySelector('.advanced-stats__insights-selection-note')?.textContent)
            .toContain('latest observed season');
        expect(root.querySelector('.advanced-stats__insights-coverage')?.textContent).toContain('clashking-v2');
        expect(root.querySelector('.advanced-stats__insights-coverage')?.textContent).toContain('Last updated');
    });

    it('keeps insight translations in parity and runtime dictionaries', () => {
        const languages = ['en', 'nl', 'fr', 'de', 'es'];
        const keys = Object.keys(advancedStatsInsightsLocales.en).sort();
        expect(keys.length).toBeGreaterThan(30);
        for (const language of languages) {
            expect(Object.keys(advancedStatsInsightsLocales[language]).sort(), language).toEqual(keys);
            keys.forEach(key => expect(translations[language][key], `${language}:${key}`).toBe(advancedStatsInsightsLocales[language][key]));
            Object.entries(advancedStatsInsightsControlsLocales[language]).forEach(([key, value]) => {
                expect(translations[language][key], `${language}:${key}`).toBe(value);
            });
        }
    });

    it('keeps the three section column definitions explicit', () => {
        expect(Object.keys(advancedStatsInsightsColumns)).toEqual(['warCwl', 'progression', 'league']);
        expect(advancedStatsInsightsColumns.warCwl.some(([key]) => key === 'missed')).toBe(true);
        expect(advancedStatsInsightsColumns.progression.some(([key]) => key === 'change')).toBe(true);
        expect(advancedStatsInsightsColumns.league.some(([key]) => key === 'league')).toBe(true);
    });
});
