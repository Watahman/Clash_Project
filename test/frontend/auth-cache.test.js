import { beforeEach, describe, expect, it, vi } from 'vitest';

const { clearCachePrefix } = vi.hoisted(() => ({
    clearCachePrefix: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/assets/js/cache/local-cache.js', () => ({ clearCachePrefix }));

import { signInWithPassword, signOut } from '../../src/assets/js/auth/auth-client.js';

describe('authentication cache isolation', () => {
    beforeEach(() => {
        localStorage.clear();
        clearCachePrefix.mockClear();
        vi.unstubAllGlobals();
    });

    it('clears every cached response before switching accounts', async () => {
        localStorage.setItem('id', 'old-user');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            session: { user: { id: 'new-user' } }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

        await signInWithPassword('new@example.com', 'Password1!');

        expect(clearCachePrefix).toHaveBeenCalledWith('');
        expect(localStorage.getItem('id')).toBe('new-user');
    });

    it('clears every cached response when signing out', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        )));

        await signOut();

        expect(clearCachePrefix).toHaveBeenCalledWith('');
        expect(localStorage.getItem('id')).toBeNull();
    });
});
