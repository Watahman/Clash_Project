import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    ASSET_FALLBACKS,
    getLeagueAsset,
    getTownHallAsset,
    normalizeEntityId
} from '../../src/assets/js/assets/entity-assets.js';
import {
    getWorkspaceSections,
    WORKSPACE_MODULES
} from '../../src/assets/js/shell/module-registry.js';
import {
    isRedesignFixtureRequested
} from '../../src/assets/js/fixtures/redesign-fixture-mode.js';
import { APP_ALIASES, APP_ASSETS } from '../../worker/app-routes.js';

describe('redesign shared foundation', () => {
    it('keeps the exact workspace taxonomy in one registry', () => {
        expect(getWorkspaceSections().map(section => section.id)).toEqual([
            'home', 'manage', 'plan', 'compete', 'play', 'progress'
        ]);
        expect(WORKSPACE_MODULES.map(module => module.id)).toContain('advancedStats');
        expect(WORKSPACE_MODULES.map(module => module.id)).toContain('achievements');
    });

    it('normalizes entity names and provides safe local fallbacks', () => {
        expect(normalizeEntityId('  Electro Dragon ')).toBe('electro-dragon');
        expect(normalizeEntityId({ name: 'Barb King' })).toBe('barbarian-king');
        expect(getTownHallAsset(17)).toBe('/assets/game/town-halls/town-hall-17.webp');
        expect(getTownHallAsset(18)).toBe('/assets/game/town-halls/town-hall-18.webp');
        expect(getTownHallAsset('unknown')).toBe(ASSET_FALLBACKS.entity);
        expect(getTownHallAsset(99)).toBe(ASSET_FALLBACKS.entity);
        expect(getLeagueAsset('Titan League').image).toBe('/assets/game/leagues/multiplayer/leagues-titan.webp');
    });

    it('restricts deterministic fixture mode to localhost', () => {
        expect(isRedesignFixtureRequested(new URL('http://localhost/app?cpFixture=planner-empty'))).toBe(true);
        expect(isRedesignFixtureRequested(new URL('https://clashpanel.com/app?cpFixture=planner-empty'))).toBe(false);
        expect(isRedesignFixtureRequested(new URL('http://localhost/app'))).toBe(false);
    });

    it('serves clean app routes and preserves old aliases', () => {
        expect(APP_ASSETS.get('/app/explore')).toBe('/subpages/explore');
        expect(APP_ASSETS.get('/app/war-board')).toBe('/subpages/war-operation-board');
        expect(APP_ASSETS.get('/app/brackets')).toBe('/subpages/bracket-generator');
        expect(APP_ALIASES.get('/app/war-operation-board')).toBe('/app/war-board');
    });

    it('loads the new foundation after legacy compatibility styles', () => {
        const dashboard = readFileSync('src/subpages/dashboard.html', 'utf8');
        const shell = readFileSync('src/assets/js/shell/workspace-shell-markup.js', 'utf8');
        expect(dashboard.indexOf('workspace-v2.css')).toBeGreaterThan(dashboard.indexOf('workspace-polish-batch2.css'));
        expect(shell).toContain("from './module-registry.js'");
        expect(shell).not.toContain('comingSoonNavItem');
    });
});
