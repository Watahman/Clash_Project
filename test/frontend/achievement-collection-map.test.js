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

describe('Achievement collection map', () => {
    it('renders progression and standalone families in one connected map', () => {
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
        expect(container.querySelectorAll('.achievement-category-map')).toHaveLength(1);
        expect(container.querySelectorAll('.achievement-category-section')).toHaveLength(1);
        expect(container.querySelector('.achievement-category-progression')).toBeNull();
        expect(container.querySelector('.achievement-category-standalone')).toBeNull();
        expect(container.querySelector('.achievement-category-crest')).toBeTruthy();
        expect(container.querySelector('.achievement-category-badge')?.dataset.reward).toBe('final');
        expect(container.querySelector('.achievement-category-badge')?.dataset.state).toBe('unknown');
        expect(container.querySelector('.achievement-badge-mark')?.textContent).toBe('◇');
        expect(container.querySelector('.achievement-badge-kicker')?.textContent).toMatch(/Completion reward|Voltooiingsbeloning/);
        expect(container.querySelectorAll('.achievement-map-track-shell')).toHaveLength(1);
        expect(container.querySelector('.achievement-map-track-shell')?.dataset.layout).toBeUndefined();
        expect(container.querySelectorAll('.achievement-map-constellation')).toHaveLength(1);
        expect(container.querySelectorAll('.achievement-map-path')).toHaveLength(2);
        expect([...container.querySelectorAll('.achievement-map-path')].every(path => path.localName === 'svg')).toBe(true);
        expect([...container.querySelectorAll('.achievement-map-path path')].every(path => path.getAttribute('d')?.includes('C'))).toBe(true);
        expect(container.querySelector('.achievement-map-constellation .achievement-map-path')).toBeNull();
    });

    it('shows family names once while nodes expose concise tier targets', () => {
        const container = document.createElement('div');
        renderAchievementCategory(container, {
            key: 'planning',
            categoryLabel: 'Planning',
            progressionFamilies: [family('raids')],
            standaloneFamilies: []
        });

        const track = container.querySelector('.achievement-progression-path');
        expect(track.querySelector('h3')?.textContent).toBe('Raid victories');
        expect(track.textContent.match(/Raid victories/g)).toHaveLength(1);
        const nodes = [...container.querySelectorAll('.achievement-map-node')];
        expect(nodes).toHaveLength(3);
        expect(nodes[0].textContent).toContain('Tier 1');
        expect(nodes[0].textContent).toContain('100');
        expect(nodes[0].textContent).not.toMatch(/Unlocked|Badge unlocked/);
        expect(nodes[0].querySelector('button')?.getAttribute('aria-label')).toMatch(/Unlocked|Badge unlocked/);
        expect(nodes[0].dataset.state).toBe('unlocked');
        expect(nodes.every(node => node.querySelector('button')?.type === 'button')).toBe(true);
    });

    it('preserves unknown source state and invokes node selection from keyboard-capable buttons', () => {
        const container = document.createElement('div');
        const onAchievementSelect = vi.fn();
        const unknown = family('waiting', {
            state: 'unknown',
            sourceAvailable: false,
            tiers: [tier(1, { state: 'unknown', sourceAvailable: false, progressKnown: false, progress: 0 })]
        });
        renderAchievementCategory(container, { key: 'collection', standaloneFamilies: [unknown] }, { onAchievementSelect });

        const node = container.querySelector('.achievement-map-node');
        const button = node.querySelector('button');
        expect(node.dataset.state).toBe('unknown');
        expect(node.dataset.sourceAvailable).toBe('false');
        expect(button.getAttribute('aria-label')).toContain('Progress unavailable');
        expect(button.tabIndex).toBe(0);
        button.click();
        expect(onAchievementSelect).toHaveBeenCalledWith(unknown.tiers[0], unknown);
    });
});
