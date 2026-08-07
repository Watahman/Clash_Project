import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../../worker/index.js';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('Advanced Stats API proxy privacy', () => {
    it('forces no-store on Advanced Stats responses even if upstream marks them cacheable', async () => {
        const upstreamFetch = vi.fn(async () => new Response(
            JSON.stringify({ status: 'ACTIVE' }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=3600'
                }
            }
        ));
        vi.stubGlobal('fetch', upstreamFetch);

        const response = await worker.fetch(
            new Request('https://clashpanel.com/api/AdvancedStatsTrackingGet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerTag: '#P0Y2' })
            }),
            { CLOUD_RUN_ORIGIN: 'https://backend.example' }
        );

        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(response.headers.get('Pragma')).toBe('no-cache');
        expect(upstreamFetch).toHaveBeenCalledTimes(1);
    });

    it('does not change caching headers for unrelated API responses', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(
            JSON.stringify({ ok: true }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=60'
                }
            }
        )));

        const response = await worker.fetch(
            new Request('https://clashpanel.com/api/Player', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}'
            }),
            { CLOUD_RUN_ORIGIN: 'https://backend.example' }
        );

        expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
        expect(response.headers.get('Pragma')).toBeNull();
    });
});
