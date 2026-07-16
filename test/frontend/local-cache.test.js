import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getCached,
    getCachedThenRefresh,
    removeCached,
    setCached
} from '../../src/assets/js/cache/local-cache.js';

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
});
