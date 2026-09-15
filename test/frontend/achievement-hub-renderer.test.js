import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it, vi } from 'vitest';

let renderAchievementHub;
let renderAchievementCategory;
let badgeInfo;
let stateOf;

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
    ({ renderAchievementHub, badgeInfo, stateOf } = await import('../../src/assets/js/pages/achievement-hub-renderer.js'));
    ({ renderAchievementCategory } = await import('../../src/assets/js/pages/achievement-category-renderer.js'));
});

describe('Achievement hub and category renderers', () => {
    it('renders collection trophies with real progress and one mastery reward', () => {
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
        expect(container.querySelectorAll('.achievement-trophy-preview-medal')).toHaveLength(2);
        expect(container.querySelector('.achievement-mastery-reward[data-state="progressing"]')).toBeTruthy();
        expect(container.querySelector('.achievement-mastery-medal')).toBeTruthy();
        expect(container.querySelector('.achievement-hub-cta')).toBeNull();
        expect(container.textContent).not.toMatch(/Category preview|Waiting for data|Bronze|Silver|Gold/);
        container.querySelector('.achievement-hub-module')?.click();
        expect(onCategorySelect).toHaveBeenCalledWith(category, 'clan');
    });

    it('cleans shared grid classes across detail and back rendering', () => {
        const container = document.createElement('div');
        const category = { key: 'war-cwl', title: 'War & CWL', progressionFamilies: [], standaloneFamilies: [] };

        renderAchievementHub(container, [category]);
        renderAchievementCategory(container, category);
        expect(container.classList.contains('achievement-trophy-wall')).toBe(false);
        expect(container.classList.contains('achievement-mastery-cabinet')).toBe(true);

        renderAchievementHub(container, [category]);
        expect(container.classList.contains('achievement-mastery-cabinet')).toBe(false);
        expect(container.classList.contains('achievement-trophy-wall')).toBe(true);
    });

    it('keeps progression families separate from standalone medals and preserves waiting state', () => {
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
        expect(container.querySelectorAll('.achievement-family-showcase[data-structure="progression"]')).toHaveLength(1);
        expect(container.querySelectorAll('.achievement-family-showcase[data-structure="progression"] .achievement-medal-item')).toHaveLength(3);
        expect(container.querySelectorAll('.achievement-medal-connector')).toHaveLength(2);
        expect(container.querySelectorAll('.achievement-standalone-showcase')).toHaveLength(1);
        expect(container.querySelector('.achievement-family-group[data-state="unknown"], .achievement-medal-item[data-state="unknown"]')).toBeTruthy();
        expect(container.textContent).toContain('Waiting for data');
        expect(container.textContent).not.toContain('Waiting for data · Waiting for data');
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
            progressionFamilies: [family('plan', {
                complete: true,
                tiers: [
                    tier(1, { unlocked: true, progress: 100 }),
                    tier(2, { unlocked: true, progress: 100 }),
                    tier(3, { unlocked: true, progress: 100 })
                ]
            })],
            standaloneFamilies: [],
            badgeDefinition: { state: 'unlocked', label: 'Completion badge' }
        };

        renderAchievementHub(hub, [category]);
        renderAchievementCategory(detail, category);

        expect(hub.querySelector('.achievement-hub-module')?.getAttribute('aria-label')).toBe('Planning — Details bekijken');
        expect(hub.querySelector('.achievement-mastery-reward')?.dataset.state).toBe('unlocked');
        expect(hub.querySelector('.achievement-mastery-reward')?.textContent).toContain('Ontgrendeld');
        expect(detail.querySelector('[data-achievement-back="true"]')?.textContent).toContain('Terug naar Achievement Hub');
        expect(detail.querySelector('h2')?.textContent).toBe('Achievementsets');
        expect(detail.querySelector('[data-achievement-back="true"]')?.getAttribute('aria-label')).toBe('Terug naar Achievement Hub');

        localStorage.setItem('clashtools_language', 'en');
    });

    it('never renders a tier or collection badge as unlocked below its comparator threshold', () => {
        const container = document.createElement('div');
        const invalid = family('regressive', {
            complete: true,
            state: 'complete',
            tiers: [tier(1, {
                progress: 49, target: 100, comparison: 'GTE', unlocked: true, state: 'complete'
            })]
        });
        const category = {
            key: 'combat',
            totalCount: 1,
            completedCount: 1,
            completionPercent: 100,
            progressionFamilies: [invalid],
            badgeDefinition: { state: 'unlocked', unlocked: true, label: 'Completion badge' }
        };

        renderAchievementHub(container, [category]);

        expect(stateOf(invalid.tiers[0])).toBe('in_progress');
        expect(container.querySelector('.achievement-trophy-preview-medal')?.dataset.state).toBe('in_progress');
        expect(container.querySelector('.achievement-mastery-reward')?.dataset.state).toBe('locked');
        expect(badgeInfo(category).state).toBe('locked');
        expect(container.textContent).toContain('0 / 1');
    });

    it('requires 100 percent evidence even when a stale badge says unlocked', () => {
        expect(badgeInfo({
            totalCount: 2,
            completedCount: 1,
            completionPercent: 50,
            badgeDefinition: { state: 'unlocked', unlocked: true }
        }).state).toBe('locked');
        expect(badgeInfo({
            totalCount: 1,
            progressionFamilies: [family('waiting', {
                state: 'unknown', sourceAvailable: false,
                tiers: [tier(1, { state: 'unknown', sourceAvailable: false })]
            })]
        }).state).toBe('unknown');
    });
});
