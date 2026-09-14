import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it, vi } from 'vitest';

let renderAchievementCategory;

function tier(number, overrides = {}) {
    return {
        tier: number,
        tierLabel: `Tier ${number}`,
        thresholdText: String(number * 100),
        progress: number === 1 ? number * 100 : 20,
        target: number * 100,
        unlocked: number === 1,
        sourceAvailable: true,
        progressKnown: true,
        ...overrides
    };
}

function family(key, overrides = {}) {
    return {
        familyKey: key,
        title: 'Raid victories',
        description: 'Build a verified winning streak.',
        state: 'in_progress',
        sourceAvailable: true,
        tiers: [tier(1), tier(2), tier(3)],
        ...overrides
    };
}

beforeAll(async () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('localStorage', dom.window.localStorage);
    localStorage.setItem('clashtools_language', 'en');
    ({ renderAchievementCategory } = await import('../../src/assets/js/pages/achievement-category-renderer.js'));
});

describe('Achievement mastery cabinet', () => {
    it('renders progression and standalone families as separate collectible showcases', () => {
        const container = document.createElement('div');
        container.classList.add('achievement-hub');
        const unknown = family('waiting', {
            state: 'unknown',
            sourceAvailable: false,
            tiers: [tier(1, { state: 'unknown', sourceAvailable: false, progressKnown: false, progress: 0 })]
        });
        renderAchievementCategory(container, {
            key: 'collection',
            categoryLabel: 'Collection',
            badgeDefinition: { label: 'Collection Master', state: 'unlocked' },
            progressionFamilies: [family('raids', { orientation: 'vertical' })],
            standaloneFamilies: [unknown]
        });

        expect(container.classList.contains('achievement-hub')).toBe(false);
        expect(container.querySelectorAll('.achievement-category-showcase')).toHaveLength(1);
        expect(container.querySelectorAll('.achievement-family-showcase')).toHaveLength(1);
        expect(container.querySelector('.achievement-category-progression')).toBeNull();
        expect(container.querySelector('.achievement-category-standalone')).toBeNull();
        expect(container.querySelector('.achievement-category-crest')).toBeTruthy();
        expect(container.querySelector('.achievement-category-badge')?.dataset.reward).toBe('mastery');
        expect(container.querySelector('.achievement-category-badge')?.dataset.state).toBe('unknown');
        expect(container.querySelector('.achievement-mastery-mark')?.textContent).toBe('·');
        expect(container.querySelector('.achievement-mastery-copy small')?.textContent).toMatch(/Mastery reward|Masterybeloning/);
        expect(container.querySelectorAll('.achievement-family-showcase[data-structure="progression"]')).toHaveLength(1);
        expect(container.querySelectorAll('.achievement-standalone-showcase')).toHaveLength(1);
        expect(container.querySelectorAll('.achievement-medal-connector')).toHaveLength(2);
        expect(container.querySelector('.achievement-standalone-showcase .achievement-medal-connector')).toBeNull();
    });

    it('shows family names once while medals expose concise tier targets', () => {
        const container = document.createElement('div');
        renderAchievementCategory(container, {
            key: 'planning',
            categoryLabel: 'Planning',
            progressionFamilies: [family('raids')],
            standaloneFamilies: []
        });

        const track = container.querySelector('.achievement-family-showcase');
        expect(track.querySelector('h3')?.textContent).toBe('Raid victories');
        expect(track.textContent.match(/Raid victories/g)).toHaveLength(1);
        const nodes = [...container.querySelectorAll('.achievement-medal-item')];
        expect(nodes).toHaveLength(3);
        expect(nodes[0].textContent).toContain('Tier 1');
        expect(nodes[0].textContent).toContain('100');
        expect(nodes[0].textContent).not.toMatch(/Unlocked|Badge unlocked/);
        expect(nodes[0].querySelector('button')?.getAttribute('aria-label')).toMatch(/Unlocked|Freigeschaltet/);
        expect(nodes[0].dataset.state).toBe('unlocked');
        expect(nodes.every(node => node.querySelector('button')?.type === 'button')).toBe(true);
    });

    it('preserves unknown source state and invokes medal selection from keyboard-capable buttons', () => {
        const container = document.createElement('div');
        const onAchievementSelect = vi.fn();
        const unknown = family('waiting', {
            state: 'unknown',
            sourceAvailable: false,
            tiers: [tier(1, { state: 'unknown', sourceAvailable: false, progressKnown: false, progress: 0 })]
        });
        renderAchievementCategory(container, { key: 'collection', standaloneFamilies: [unknown] }, { onAchievementSelect });

        const node = container.querySelector('.achievement-medal-item');
        const button = node.querySelector('button');
        expect(node.dataset.state).toBe('unknown');
        expect(node.dataset.sourceAvailable).toBe('false');
        expect(button.getAttribute('aria-label')).toContain('Waiting for data');
        expect(button.tabIndex).toBe(0);
        button.click();
        expect(onAchievementSelect).toHaveBeenCalledWith(unknown.tiers[0], unknown);
    });

    it('inherits an unknown family state when a raw tier still looks locked', () => {
        const container = document.createElement('div');
        const waiting = family('waiting-family', {
            state: 'unknown', sourceAvailable: false,
            tiers: [tier(1, { state: 'locked', sourceAvailable: false })]
        });

        renderAchievementCategory(container, { key: 'clan', standaloneFamilies: [waiting] });

        expect(container.querySelector('.achievement-medal-item')?.dataset.state).toBe('unknown');
        expect(container.querySelector('.achievement-medal')?.getAttribute('aria-label')).toContain('Waiting for data');
    });

    it('gives every tooltip a unique family-scoped relationship', () => {
        const container = document.createElement('div');
        renderAchievementCategory(container, {
            key: 'collection',
            progressionFamilies: [family('raids'), family('wins')],
            standaloneFamilies: []
        });

        const buttons = [...container.querySelectorAll('.achievement-medal')];
        const tooltipIds = buttons.map(button => button.getAttribute('aria-controls'));
        expect(new Set(tooltipIds).size).toBe(buttons.length);
        buttons.forEach(button => {
            const tooltipId = button.getAttribute('aria-controls');
            expect(button.getAttribute('aria-describedby')).toBe(tooltipId);
            expect(container.querySelectorAll(`#${tooltipId}`)).toHaveLength(1);
        });
    });
});
