import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clearPrivateCache,
    getCached,
    getCachedThenRefresh,
    invalidatePrivateCache,
    removeCached,
    setCached
} from '../../src/assets/js/cache/local-cache.js?v=20260829-public-auth-v1';

describe('IndexedDB stale-while-revalidate cache', () => {
    let currentTime;

    beforeEach(() => {
        currentTime = new Date('2026-07-16T12:00:00Z').getTime();
        vi.spyOn(Date, 'now').mockImplementation(() => currentTime);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns a fresh hit without calling the source', async () => {
        const key = `test:fresh:${crypto.randomUUID()}`;
        await setCached(key, { value: 'cached' }, 10_000, 5_000);
        const source = vi.fn();

        await expect(getCachedThenRefresh(key, source, { ttlMs: 10_000, staleMs: 5_000 }))
            .resolves.toEqual({ value: 'cached' });
        expect(source).not.toHaveBeenCalled();
    });

    it('returns stale data immediately and coalesces background refreshes', async () => {
        const key = `test:stale:${crypto.randomUUID()}`;
        await setCached(key, { value: 'old' }, 10_000, 1_000);
        currentTime += 2_000;
        const source = vi.fn().mockResolvedValue({ value: 'new' });

        const [left, right] = await Promise.all([
            getCachedThenRefresh(key, source, { ttlMs: 10_000, staleMs: 1_000 }),
            getCachedThenRefresh(key, source, { ttlMs: 10_000, staleMs: 1_000 })
        ]);

        expect(left).toEqual({ value: 'old' });
        expect(right).toEqual({ value: 'old' });
        expect(source).toHaveBeenCalledTimes(1);
        await vi.waitFor(async () => {
            expect((await getCached(key))?.data).toEqual({ value: 'new' });
        });
    });

    it('coalesces two simultaneous misses into one source call', async () => {
        const key = `test:miss:${crypto.randomUUID()}`;
        await removeCached(key);
        const source = vi.fn().mockResolvedValue({ value: 'source' });

        const values = await Promise.all([
            getCachedThenRefresh(key, source, { ttlMs: 10_000 }),
            getCachedThenRefresh(key, source, { ttlMs: 10_000 })
        ]);

        expect(values).toEqual([{ value: 'source' }, { value: 'source' }]);
        expect(source).toHaveBeenCalledTimes(1);
    });

    it('does not return an expired fallback beyond its maximum age', async () => {
        const key = `test:expired:${crypto.randomUUID()}`;
        await setCached(key, { value: 'too-old' }, 1_000, 500);
        currentTime += 2_000;

        await expect(getCachedThenRefresh(
            key,
            () => Promise.reject(new Error('offline')),
            { ttlMs: 1_000, staleMs: 500, maxFallbackAgeMs: 1_500 }
        )).rejects.toThrow('offline');
    });

    it('does not hide a failed forced refresh behind cached data', async () => {
        const key = `test:forced:${crypto.randomUUID()}`;
        await setCached(key, { value: 'cached' }, 10_000, 5_000);

        await expect(getCachedThenRefresh(
            key,
            () => Promise.reject(new Error('live source unavailable')),
            { ttlMs: 10_000, staleMs: 5_000, forceRefresh: true }
        )).rejects.toThrow('live source unavailable');
    });

    it('never falls back to stale private data after a session expiry', async () => {
        const key = `test:auth-expired:${crypto.randomUUID()}`;
        await setCached(key, { value: 'private-old' }, 10_000, 1_000);
        currentTime += 2_000;
        const error = Object.assign(new Error('session expired'), { status: 401 });

        await expect(getCachedThenRefresh(
            key,
            () => Promise.reject(error),
            { ttlMs: 10_000, staleMs: 1_000, source: 'supabase' }
        )).rejects.toBe(error);
        expect(await getCached(key, { allowExpired: true })).toBeNull();
    });

    it('keeps stale public Clash data after a public 401 refresh failure', async () => {
        const key = `test:clash-unauthorized:${crypto.randomUUID()}`;
        await setCached(key, { value: 'public-old' }, 10_000, 1_000);
        currentTime += 2_000;
        const error = Object.assign(new Error('public unauthorized'), {
            status: 401,
            sessionBound: false
        });
        const onRefreshError = vi.fn();

        await expect(getCachedThenRefresh(
            key,
            () => Promise.reject(error),
            {
                ttlMs: 10_000,
                staleMs: 1_000,
                source: 'clash',
                onRefreshError
            }
        )).resolves.toEqual({ value: 'public-old' });

        await vi.waitFor(() => expect(onRefreshError).toHaveBeenCalledWith(error));
        expect((await getCached(key, { allowExpired: true }))?.data).toEqual({ value: 'public-old' });
    });

    it.each([403, 500])('keeps stale private data after a session-bound %s refresh failure', async status => {
        const key = `test:private-transient-${status}:${crypto.randomUUID()}`;
        await setCached(key, { value: 'private-old' }, 10_000, 1_000, 'supabase');
        currentTime += 2_000;
        const error = Object.assign(new Error(`private ${status}`), {
            status,
            sessionBound: true
        });

        await expect(getCachedThenRefresh(
            key,
            () => Promise.reject(error),
            { ttlMs: 10_000, staleMs: 1_000, source: 'supabase' }
        )).resolves.toEqual({ value: 'private-old' });
        expect((await getCached(key, { allowExpired: true }))?.data).toEqual({ value: 'private-old' });
    });

    it('invalidates private entries immediately while preserving public cache entries', async () => {
        const privateKey = `test:private-epoch:${crypto.randomUUID()}`;
        const publicKey = `test:public-epoch:${crypto.randomUUID()}`;
        await setCached(privateKey, { value: 'private' }, 10_000, 5_000, 'supabase');
        await setCached(publicKey, { value: 'public' }, 10_000, 5_000, 'clash');

        invalidatePrivateCache();

        await expect(getCached(privateKey, { allowExpired: true })).resolves.toBeNull();
        await expect(getCached(publicKey, { allowExpired: true })).resolves.toMatchObject({
            data: { value: 'public' }
        });
        await clearPrivateCache();
        await removeCached(publicKey);
    });

    it('does not write a private response that finishes after invalidation', async () => {
        const key = `test:private-refresh-race:${crypto.randomUUID()}`;
        let releaseRefresh;
        const source = vi.fn(() => new Promise(resolve => { releaseRefresh = resolve; }));
        const pending = getCachedThenRefresh(key, source, {
            ttlMs: 10_000,
            source: 'supabase'
        });

        await vi.waitFor(() => expect(source).toHaveBeenCalledTimes(1));
        invalidatePrivateCache();
        releaseRefresh({ value: 'account-a' });

        await expect(pending).rejects.toMatchObject({
            code: 'PRIVATE_CACHE_INVALIDATED',
            sessionBound: true
        });
        await expect(getCached(key, { allowExpired: true })).resolves.toBeNull();
    });

    it('rejects a private refresh invalidated by its post-write callback', async () => {
        const key = `test:private-callback-race:${crypto.randomUUID()}`;
        const onRefresh = vi.fn(() => invalidatePrivateCache());
        const refreshed = vi.fn();
        window.addEventListener('clashtools:cache-refreshed', refreshed);
        const pending = getCachedThenRefresh(
            key,
            () => Promise.resolve({ value: 'account-a' }),
            { ttlMs: 10_000, source: 'supabase', onRefresh }
        );

        try {
            await expect(pending).rejects.toMatchObject({
                code: 'PRIVATE_CACHE_INVALIDATED',
                sessionBound: true
            });
        } finally {
            window.removeEventListener('clashtools:cache-refreshed', refreshed);
        }
        expect(onRefresh).toHaveBeenCalledTimes(1);
        expect(refreshed).not.toHaveBeenCalled();
        await expect(getCached(key, { allowExpired: true })).resolves.toBeNull();
    });

    it('synchronizes private entries when another tab changes the persisted epoch', async () => {
        const key = `test:private-cross-tab:${crypto.randomUUID()}`;
        await setCached(key, { value: 'account-a' }, 10_000, 5_000, 'supabase');
        const previousEpoch = localStorage.getItem('clashtools.private-cache-epoch');
        const nextEpoch = `cross-tab-${crypto.randomUUID()}`;

        localStorage.setItem('clashtools.private-cache-epoch', nextEpoch);
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'clashtools.private-cache-epoch',
            oldValue: previousEpoch,
            newValue: nextEpoch,
            storageArea: localStorage
        }));
        await expect(getCached(key, { allowExpired: true })).resolves.toBeNull();

        localStorage.setItem('clashtools.private-cache-epoch', previousEpoch);
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'clashtools.private-cache-epoch',
            oldValue: nextEpoch,
            newValue: previousEpoch,
            storageArea: localStorage
        }));
        await expect(getCached(key, { allowExpired: true })).resolves.toMatchObject({
            data: { value: 'account-a' }
        });
        await removeCached(key);
    });
});
