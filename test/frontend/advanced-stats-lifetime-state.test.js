import { describe, expect, it, vi } from 'vitest';
import { createLifetimeLoader } from '../../src/assets/js/pages/advanced-stats-lifetime-state.js?v=20260913-advanced-dashboard-v2';

describe('Advanced Stats lifetime loading', () => {
    it('starts loading without blocking the caller and caches the response', async () => {
        let resolveLifetime;
        const state = {
            api: { getLifetime: vi.fn(() => new Promise(resolve => { resolveLifetime = resolve; })) },
            playerTag: '#PLAYER', lifetimeGeneration: 0, lifetimePlayerTag: '',
            lifetimeLoadAttempted: false, lifetimeState: 'idle', lifetime: null
        };
        const renderPage = vi.fn();
        const loader = createLifetimeLoader({ state, renderPage });

        const loading = loader.loadLifetime();
        expect(state.lifetimeState).toBe('loading');
        expect(state.lifetime).toBeNull();
        expect(state.api.getLifetime).toHaveBeenCalledWith('#PLAYER');

        resolveLifetime({ data: { summary: { attacks: 4 } } });
        await loading;
        expect(state.lifetimeState).toBe('ready');
        expect(state.lifetime.data.summary.attacks).toBe(4);
    });

    it('discards a response after the player lifecycle changes', async () => {
        let resolveLifetime;
        const state = {
            api: { getLifetime: vi.fn(() => new Promise(resolve => { resolveLifetime = resolve; })) },
            playerTag: '#PLAYER', lifetimeGeneration: 0, lifetimePlayerTag: '',
            lifetimeLoadAttempted: false, lifetimeState: 'idle', lifetime: null
        };
        const loader = createLifetimeLoader({ state, renderPage: vi.fn() });
        const loading = loader.loadLifetime();

        state.playerTag = '#OTHER';
        loader.resetLifetimeState();
        resolveLifetime({ data: { summary: { attacks: 99 } } });
        await loading;

        expect(state.lifetime).toBeNull();
        expect(state.lifetimeState).toBe('idle');
    });
});
