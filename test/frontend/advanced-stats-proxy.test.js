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

    it('keeps canonical redirect enabled by default', async () => {
        const response = await worker.fetch(
            new Request('https://phase8-preview.example/app/advanced-stats'),
            { ASSETS: { fetch: vi.fn() } }
        );

        expect(response.status).toBe(301);
        expect(response.headers.get('Location')).toBe('https://clashpanel.com/app/advanced-stats');
    });

    it('allows an explicit isolated preview environment to keep its own host', async () => {
        const assetResponse = new Response('<html>preview</html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
        });
        const assetFetch = vi.fn(async () => assetResponse);

        const response = await worker.fetch(
            new Request('https://clashpanel-phase8-preview.example/app/advanced-stats'),
            {
                DISABLE_CANONICAL_REDIRECT: 'true',
                ASSETS: { fetch: assetFetch }
            }
        );

        expect(response.status).toBe(200);
        expect(response.headers.get('Location')).toBeNull();
        expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
        expect(assetFetch).toHaveBeenCalledTimes(1);
    });

    it('uses the trusted production origin upstream only when the preview override is explicit', async () => {
        const upstreamFetch = vi.fn(async (_url, options) => {
            expect(options.headers.get('Origin')).toBe('https://clashpanel.com');
            expect(options.headers.get('Referer')).toBe('https://clashpanel.com/');
            expect(options.headers.get('X-Forwarded-Host')).toBe('clashpanel-phase8-preview.example');
            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        });
        vi.stubGlobal('fetch', upstreamFetch);

        const response = await worker.fetch(
            new Request('https://clashpanel-phase8-preview.example/api/Player', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': 'https://clashpanel-phase8-preview.example'
                },
                body: '{}'
            }),
            {
                CLOUD_RUN_ORIGIN: 'https://backend.example',
                DISABLE_CANONICAL_REDIRECT: 'true',
                UPSTREAM_ORIGIN_OVERRIDE: 'https://clashpanel.com',
                API_PROXY_SECRET: 'preview-proxy-secret'
            }
        );

        expect(response.status).toBe(200);
        expect(upstreamFetch).toHaveBeenCalledTimes(1);
    });
});
