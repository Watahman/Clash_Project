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
    it('renders collection panels with real progress and a single completion crest', () => {
        const container = document.createElement('div');
        container.classList.add('achievement-category-detail');
        const chain = family('donations', { complete: false });
        const category = {
            key: 'clan',
            title: 'Clan',
            description: 'Grow the clan journey together.',
            icon: 'clan',
            totalCount: 2,
            completedCount: 1,
            completionPercent: 50,
            progressionFamilies: [chain],
            standaloneFamilies: [family('one-off', { tiers: [tier(1, { unlocked: true })], complete: true, state: 'complete' })],
            badgeDefinition: { label: 'Completion badge', state: 'locked' }
        };
        const onCategorySelect = vi.fn();

        renderAchievementHub(container, [category], { onCategorySelect });

        expect(container.classList.contains('achievement-category-detail')).toBe(false);
        expect(container.querySelectorAll('.achievement-hub-module')).toHaveLength(1);
        expect(container.querySelector('[data-achievement-category="clan"]')).toBeTruthy();
        expect(container.querySelector('.achievement-hub-module')?.tagName).toBe('BUTTON');
        expect(container.querySelector('.achievement-hub-module')?.getAttribute('aria-label')).toContain('View details');
        expect(container.textContent).toContain('1 / 2');
        expect(container.textContent).toContain('50% complete');
        expect(container.querySelectorAll('.achievement-hub-journey-connector')).toHaveLength(2);
        expect(container.querySelectorAll('.achievement-hub-journey')).toHaveLength(1);
        expect(container.querySelector('.achievement-hub-badge[data-state="locked"]')).toBeTruthy();
        expect(container.querySelector('.achievement-hub-badge-crest')).toBeTruthy();
        expect(container.querySelector('.achievement-hub-cta')).toBeNull();
        expect(container.textContent).not.toMatch(/Category preview|Waiting for data|Bronze|Silver|Gold|Master/);
        container.querySelector('.achievement-hub-module')?.click();
        expect(onCategorySelect).toHaveBeenCalledWith(category, 'clan');
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
        expect(container.textContent).toContain('Progress unavailable');
    });

    it('localizes the collection panel, completion badge and detail section in Dutch', () => {
        localStorage.setItem('clashtools_language', 'nl');
        const hub = document.createElement('div');
        const detail = document.createElement('div');
        const category = {
            key: 'planning',
            title: 'Planning',
            totalCount: 1,
            completedCount: 1,
            completionPercent: 100,
            progressionFamilies: [family('plan', { complete: true })],
            standaloneFamilies: [],
            badgeDefinition: { state: 'unlocked', label: 'Completion badge' }
        };

        renderAchievementHub(hub, [category]);
        renderAchievementCategory(detail, category);

        expect(hub.querySelector('.achievement-hub-module')?.getAttribute('aria-label')).toBe('Planning — Details bekijken');
        expect(hub.querySelector('.achievement-hub-badge')?.dataset.state).toBe('unlocked');
        expect(hub.querySelector('.achievement-hub-badge')?.textContent).toContain('Ontgrendeld');
        expect(detail.querySelector('[data-achievement-back="true"]')?.textContent).toContain('Terug naar Achievement Hub');
        expect(detail.querySelector('h2')?.textContent).toBe('Achievementkaart');
        expect(detail.querySelector('[data-achievement-back="true"]')?.getAttribute('aria-label')).toBe('Terug naar Achievement Hub');

        localStorage.setItem('clashtools_language', 'en');
    });
});
