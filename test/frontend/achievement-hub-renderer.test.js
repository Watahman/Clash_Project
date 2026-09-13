import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it, vi } from 'vitest';

let renderAchievementHub;
let renderAchievementCategory;

function tier(number, overrides = {}) {
    return {
        tier: number,
        title: `Donate ${number * 100}`,
        progress: overrides.progress ?? (number === 1 ? 100 : 20),
        target: 100,
        unlocked: overrides.unlocked ?? number === 1,
        sourceAvailable: overrides.sourceAvailable ?? true,
        ...overrides
    };
}

function family(key, overrides = {}) {
    return {
        familyKey: key,
        title: overrides.title || key,
        description: 'A tracked achievement family.',
        state: overrides.state || 'in_progress',
        sourceAvailable: overrides.sourceAvailable ?? true,
        tiers: overrides.tiers || [tier(1), tier(2), tier(3)],
        ...overrides
    };
}

beforeAll(async () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('localStorage', dom.window.localStorage);
    ({ renderAchievementHub } = await import('../../src/assets/js/pages/achievement-hub-renderer.js'));
    ({ renderAchievementCategory } = await import('../../src/assets/js/pages/achievement-category-renderer.js'));
});

describe('Achievement hub and category renderers', () => {
    it('renders compact category modules with real progress and CTA identity', () => {
        const container = document.createElement('div');
        const chain = family('donations', { complete: false });
        const category = {
            key: 'clan',
            categoryLabel: 'Clan',
            familyCount: 2,
            completedFamilyCount: 1,
            completionPercent: 50,
            progressionFamilies: [chain],
            standaloneFamilies: [family('one-off', { tiers: [tier(1, { unlocked: true })], complete: true, state: 'complete' })],
            badge: { state: 'silver', percentage: 50 }
        };

        renderAchievementHub(container, [category]);

        expect(container.querySelectorAll('.achievement-hub-module')).toHaveLength(1);
        expect(container.querySelector('[data-achievement-category="clan"]')).toBeTruthy();
        expect(container.textContent).toContain('1 / 2');
        expect(container.textContent).toContain('50% complete');
        expect(container.querySelectorAll('.achievement-hub-journey-connector')).toHaveLength(2);
    });

    it('keeps family paths separate and preserves waiting state in detail view', () => {
        const container = document.createElement('div');
        const category = {
            key: 'history',
            categoryLabel: 'History',
            progressionFamilies: [family('first', { tiers: [tier(1), tier(2), tier(3)] })],
            standaloneFamilies: [family('waiting', { tiers: [tier(1, { state: 'unknown', sourceAvailable: false, progress: 0 })], state: 'unknown', sourceAvailable: false })],
            badge: { state: 'unknown' }
        };

        renderAchievementCategory(container, category);

        expect(container.querySelector('[data-achievement-back="true"]')).toBeTruthy();
        expect(container.querySelectorAll('.achievement-progression-path')).toHaveLength(1);
        expect(container.querySelectorAll('.achievement-progression-tier')).toHaveLength(3);
        expect(container.querySelectorAll('.achievement-progression-connector')).toHaveLength(2);
        expect(container.querySelectorAll('.achievement-standalone-challenge')).toHaveLength(1);
        expect(container.querySelector('.achievement-standalone-challenge')?.dataset.state).toBe('unknown');
        expect(container.textContent).toContain('Waiting for data');
    });

    it('localizes CTA, badge tier, back action and detail section in Dutch', () => {
        localStorage.setItem('clashtools_language', 'nl');
        const hub = document.createElement('div');
        const detail = document.createElement('div');
        const category = {
            key: 'planning',
            categoryLabel: 'Planning',
            familyCount: 1,
            completedFamilyCount: 1,
            completionPercent: 100,
            progressionFamilies: [family('plan', { complete: true })],
            standaloneFamilies: [],
            badge: { state: 'silver' }
        };

        renderAchievementHub(hub, [category]);
        renderAchievementCategory(detail, category);

        expect(hub.querySelector('.achievement-hub-cta')?.textContent).toContain('Details bekijken');
        expect(hub.querySelector('.achievement-hub-cta')?.getAttribute('aria-label')).toBe('Details bekijken: Planning');
        expect(hub.querySelector('.achievement-badge')?.textContent).toContain('Zilver');
        expect(detail.querySelector('[data-achievement-back="true"]')?.textContent).toContain('Terug naar Achievement Hub');
        expect(detail.querySelector('h2')?.textContent).toBe('Voortgangsketens');
        expect(detail.querySelector('[data-achievement-back="true"]')?.getAttribute('aria-label')).toBe('Terug naar Achievement Hub');

        localStorage.setItem('clashtools_language', 'en');
    });
});
