import { beforeEach, describe, expect, it } from 'vitest';
import {
    hasKnownLoot,
    normalizeLootSummary,
    renderLootSummary,
    renderLootTrend
} from '../../src/assets/js/pages/advanced-stats-loot.js?v=20260911-loot-v1';
import { advancedStatsExtraLocales } from '../../src/assets/js/i18n/advanced-stats-extra-locales.js';
import { advancedStatsLocales } from '../../src/assets/js/i18n/advanced-stats-locales.js';
import { advancedStatsUiLocales } from '../../src/assets/js/i18n/advanced-stats-ui-locales.js';

beforeEach(() => {
    document.body.replaceChildren();
});

function lootCards() {
    const root = document.createElement('div');
    root.innerHTML = ['gold', 'elixir', 'darkElixir'].map(resource => `
        <article data-loot-resource="${resource}">
            <strong data-loot-total></strong><dd data-loot-average></dd><dd data-loot-best></dd>
        </article>
    `).join('');
    document.body.append(root);
    return root;
}

describe('Advanced Stats loot presentation', () => {
    it('normalizes flat server fields and keeps each resource independent', () => {
        const summary = normalizeLootSummary({
            goldLooted: 1000,
            elixirLooted: 2000,
            darkElixirLooted: 0,
            averageGoldLooted: 100,
            averageElixirLooted: 200,
            averageDarkElixirLooted: 0,
            bestGoldLooted: { amount: 350, battleAt: '2026-09-01T12:00:00Z', opponentName: 'Gold Base' },
            bestElixirLooted: 420,
            bestDarkElixirLooted: 0
        });

        expect(summary).toEqual({
            gold: { total: 1000, average: 100, bestAttack: expect.objectContaining({ amount: 350, opponentName: 'Gold Base' }) },
            elixir: { total: 2000, average: 200, bestAttack: expect.objectContaining({ amount: 420 }) },
            darkElixir: { total: 0, average: 0, bestAttack: expect.objectContaining({ amount: 0 }) }
        });
        expect(hasKnownLoot(summary)).toBe(true);
    });

    it('preserves null as unknown while accepting the compatibility nested shape', () => {
        expect(normalizeLootSummary({
            goldLooted: null,
            averageGoldLooted: null,
            bestGoldLooted: null,
            loot: {
                gold: { total: 500, average: 50, bestAttack: { amount: 120 } },
                dark_elixir: { total: 0, average: 0, bestAttack: 0 }
            }
        })).toMatchObject({
            gold: { total: null, average: null, bestAttack: null },
            elixir: { total: null, average: null, bestAttack: null },
            darkElixir: { total: 0, average: 0, bestAttack: expect.objectContaining({ amount: 0 }) }
        });
        expect(normalizeLootSummary({ loot: {
            gold: { total: 500, average: 50, bestAttack: { amount: 120 } }
        } }).gold).toEqual({
            total: 500,
            average: 50,
            bestAttack: expect.objectContaining({ amount: 120 })
        });
        expect(hasKnownLoot({ gold: { total: null, average: null, bestAttack: null } })).toBe(false);
    });

    it('renders local WebP identifiers and resource-specific totals, averages and best attacks', () => {
        const root = lootCards();
        const attackCount = document.createElement('small');
        renderLootSummary({ lootCards: root, lootAttackCount: attackCount }, { overview: { data: { summary: {
            goldLooted: 1000, averageGoldLooted: 100, bestGoldLooted: { amount: 200 },
            elixirLooted: 0, averageElixirLooted: 0, bestElixirLooted: 0,
            darkElixirLooted: null, averageDarkElixirLooted: null, bestDarkElixirLooted: null,
            lootAttackCount: 2
        } } } });

        expect(attackCount.textContent).toContain('2');
        expect(root.querySelector('[data-loot-resource="gold"] [data-loot-total]').textContent).toBe('1,000');
        expect(root.querySelector('[data-loot-resource="gold"] [data-loot-average]').textContent).toBe('100');
        expect(root.querySelector('[data-loot-resource="gold"] [data-loot-best]').textContent).toBe('200');
        expect(root.querySelector('[data-loot-resource="elixir"] [data-loot-total]').textContent).toBe('0');
        expect(root.querySelector('[data-loot-resource="darkElixir"] [data-loot-total]').textContent).toBe('—');
        expect(root.querySelector('[data-loot-resource="darkElixir"]').dataset.known).toBe('false');
    });

    it('shows only reliable loot trend values and keeps zero distinct from missing', () => {
        const root = document.createElement('div');
        renderLootTrend(root, [
            { date: '2026-08-01', goldLooted: 100, elixirLooted: null, darkElixirLooted: 0 },
            { date: '2026-09-01', goldLooted: null, elixirLooted: null, darkElixirLooted: null }
        ], date => date.slice(0, 7));

        expect(root.hidden).toBe(false);
        expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
        expect(root.textContent).toContain('100');
        expect(root.textContent).toContain('0');
        expect(root.textContent).not.toContain('2026-09');
    });

    it('keeps loot copy complete in every supported locale', () => {
        const locales = ['en', 'nl', 'fr', 'de', 'es'].map(language => ({
            ...(advancedStatsLocales[language] || {}),
            ...(advancedStatsExtraLocales[language] || {}),
            ...(advancedStatsUiLocales[language] || {})
        }));
        const keys = ['lootTitle', 'lootText', 'lootNote', 'lootTotal', 'lootAverage', 'lootBest', 'lootAttackCount', 'lootAttackCountUnknown', 'lootTrendTitle', 'lootTrendText', 'resourceGold', 'resourceElixir', 'resourceDarkElixir', 'period', 'unitScopeNote'];
        locales.forEach(locale => keys.forEach(key => expect(locale[`advancedStats.${key}`]).toBeTruthy()));
    });
});
