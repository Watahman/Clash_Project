import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchClashAPIRequest } from '../../src/assets/js/API/API-Client.js';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('Clash API live refresh', () => {
    it('sends a cache-bypass header for a forced refresh', async () => {
        const source = vi.fn(async () => Response.json({ ok: true }));
        vi.stubGlobal('fetch', source);

        await fetchClashAPIRequest(
            '/api/test',
            '{}',
            {
                key: `test:api-refresh:${crypto.randomUUID()}`,
                ttlMs: 10_000,
                staleMs: 5_000
            },
            { forceRefresh: true }
        );

        expect(source).toHaveBeenCalledTimes(1);
        expect(source.mock.calls[0][1].headers['Cache-Control']).toBe('no-cache');
    });
});
