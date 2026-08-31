import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
    buildChronicleBranches,
    chronicleBranchKey,
    isChronicleMilestone,
    isChronicleReached
} from '../../src/assets/js/pages/achievement-chronicle-model.js';

let applyAchievementChronicleI18n;
let renderAchievementChronicle;

function family(overrides = {}) {
    const unlocked = overrides.unlocked === true;
    const tier = {
        rarity: overrides.rarity || 'rare',
        progress: overrides.progress ?? (unlocked ? 100 : 40),
        target: 100,
        thresholdText: '100',
        unlocked,
        unlocked_at: unlocked ? '2026-08-09T10:00:00.000Z' : null,
        hasStoredProgress: overrides.hasStoredProgress ?? true
    };
    return {
        familyKey: overrides.familyKey || 'FAMILY',
        title: overrides.title || 'Tactical milestone',
        description: overrides.description || 'Complete a real tracked milestone.',
        category: overrides.category || 'clashpanel_workflow',
        source: overrides.source || 'clashpanel',
        priority: overrides.priority || 'P2',
        state: overrides.state || (unlocked ? 'unlocked' : 'in_progress'),
        sourceAvailable: overrides.sourceAvailable ?? true,
        complete: overrides.complete || false,
        currentTier: tier,
        highestUnlocked: unlocked ? tier : null,
        unlockedTiers: unlocked ? [tier] : [],
        totalXp: unlocked ? 50 : 0
    };
}

beforeAll(async () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('localStorage', dom.window.localStorage);
    vi.stubGlobal('CustomEvent', dom.window.CustomEvent);
    ({
        applyAchievementChronicleI18n,
        renderAchievementChronicle
    } = await import('../../src/assets/js/pages/achievement-chronicle-renderer.js'));
});

describe('Achievement Chronicle', () => {
    it('maps real categories into stable thematic branches', () => {
        const families = [
            family({ familyKey: 'CWL', category: 'clan_war_league' }),
            family({ familyKey: 'WAR', category: 'regular_war_offense' }),
            family({ familyKey: 'PLAN', category: 'clashpanel_workflow' }),
            family({ familyKey: 'STATS', category: 'legend_and_ranked_performance' })
        ];

        expect(families.map(chronicleBranchKey)).toEqual(['cwl', 'wars', 'planning', 'stats']);
        expect(buildChronicleBranches(families).map(branch => branch.key)).toEqual(['cwl', 'wars', 'planning', 'stats']);
    });

    it('derives milestones and reached paths without changing achievement state', () => {
        expect(isChronicleMilestone(family({ priority: 'P0' }))).toBe(true);
        expect(isChronicleReached(family({ unlocked: true }))).toBe(true);
        expect(isChronicleReached(family({ state: 'in_progress' }))).toBe(false);
    });

    it('renders connected, keyboard-operable nodes and complete tooltips without cards', () => {
        const container = document.createElement('div');
        document.body.replaceChildren(container);
        renderAchievementChronicle(container, [
            family({ familyKey: 'PLAN_A', title: 'Plan A', unlocked: true }),
            family({ familyKey: 'PLAN_B', title: 'Plan B', priority: 'P0', state: 'locked', progress: 0 })
        ]);

        const nodes = [...container.querySelectorAll('.achievement-chronicle-node')];
        expect(nodes).toHaveLength(2);
        expect(container.querySelector('.achievement-card')).toBeNull();
        expect(container.querySelectorAll('.achievement-chronicle-paths path')).toHaveLength(1);
        expect(container.textContent).toContain('◆');
        expect(container.textContent).toContain('★');
        expect(container.querySelector('.achievement-chronicle-tooltip')?.textContent).toContain('Unlock date');
        const planNode = nodes.find(node => node.getAttribute('aria-label')?.includes('Plan A'));
        expect(planNode).toBeDefined();

        planNode.click();
        expect(planNode.getAttribute('aria-expanded')).toBe('true');
        expect(planNode.closest('.achievement-chronicle-stop')?.classList.contains('is-pinned')).toBe(true);
        planNode.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(planNode.getAttribute('aria-expanded')).toBe('false');
    });

    it('keeps missing sources visibly distinct from zero progress', () => {
        const container = document.createElement('div');
        renderAchievementChronicle(container, [family({
            familyKey: 'WAITING',
            state: 'unknown',
            sourceAvailable: false,
            progress: 0,
            hasStoredProgress: false
        })]);

        const node = container.querySelector('.achievement-chronicle-node');
        expect(node?.dataset.state).toBe('unknown');
        expect(node?.dataset.sourceAvailable).toBe('false');
        expect(node?.getAttribute('aria-label')).toContain('Waiting for this data source');
    });

    it('localizes Chronicle-only copy without changing the shared translation graph', () => {
        localStorage.setItem('clashtools_language', 'nl');
        const root = document.createElement('div');
        root.innerHTML = '<span data-chronicle-i18n="achievements.chronicle.locked">Locked</span>';

        applyAchievementChronicleI18n(root);

        expect(root.textContent).toBe('Vergrendeld');
        localStorage.setItem('clashtools_language', 'en');
    });
});
