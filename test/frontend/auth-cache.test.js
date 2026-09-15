import { beforeEach, describe, expect, it, vi } from 'vitest';

const { clearCachePrefix, invalidatePrivateCache } = vi.hoisted(() => ({
    clearCachePrefix: vi.fn().mockResolvedValue(undefined),
    invalidatePrivateCache: vi.fn()
}));

vi.mock('../../src/assets/js/cache/local-cache.js?v=20260829-public-auth-v1', () => ({
    clearCachePrefix,
    clearPrivateCache: undefined,
    invalidatePrivateCache
}));

import { signInWithPassword, signOut } from '../../src/assets/js/auth/auth-client.js?v=20260915-auth-policy-v1';

describe('authentication cache isolation', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        clearCachePrefix.mockReset().mockResolvedValue(undefined);
        invalidatePrivateCache.mockClear();
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
        const auth = await import('../../src/assets/js/auth/auth-client.js?v=20260915-auth-policy-v1');
        expect(auth.getAuthState()).toMatchObject({
            status: 'guest', reason: 'signed-out', cause: 'explicit-sign-out'
        });
    });

    it('does not let a late account A notification overwrite account B', async () => {
        localStorage.setItem('id', 'old-user');
        const releases = [];
        clearCachePrefix.mockImplementation(() => new Promise(resolve => releases.push(resolve)));
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                session: { user: { id: 'account-a' } }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                session: { user: { id: 'account-b' } }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        vi.stubGlobal('fetch', fetchMock);

        const accountA = signInWithPassword('a@example.com', 'Password1!');
        await vi.waitFor(() => expect(releases).toHaveLength(1));
        const accountB = signInWithPassword('b@example.com', 'Password1!');
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

        releases[0]();
        await vi.waitFor(() => expect(releases).toHaveLength(2));
        releases[1]();
        await Promise.all([accountA, accountB]);

        expect(localStorage.getItem('id')).toBe('account-b');
    });

    it('keeps a valid auth state when legacy storage fails and still completes logout', async () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('storage unavailable');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('storage unavailable');
        });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            session: { user: { id: 'storage-user' } }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

        const auth = await import('../../src/assets/js/auth/auth-client.js?v=20260915-auth-policy-v1');
        await signInWithPassword('storage@example.com', 'Password1!');
        expect(auth.getAuthState()).toMatchObject({ status: 'authenticated' });

        vi.restoreAllMocks();
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw new Error('storage unavailable');
        });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        )));

        await expect(signOut()).resolves.toBeUndefined();
        expect(auth.getAuthState()).toMatchObject({ status: 'guest', reason: 'signed-out' });
    });
});
