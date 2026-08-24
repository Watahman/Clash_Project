import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../../worker/index.js';

const env = overrides => ({
    CLOUD_RUN_ORIGIN: 'https://backend.example',
    ASSETS: { fetch: vi.fn(async () => new Response('asset')) },
    ...overrides
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('Cloudflare API proxy', () => {
    it('checks backend health and readiness from the scheduled monitor', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ status: 'ok' })));
        let scheduledPromise;

        worker.scheduled({}, env(), { waitUntil: promise => { scheduledPromise = promise; } });
        await scheduledPromise;

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
            'https://backend.example/health',
            'https://backend.example/ready'
        ]);
    });
    it.each([
        ['/privacy', '/subpages/privacy'],
        ['/cookies', '/subpages/cookies'],
        ['/terms', '/subpages/terms'],
        ['/contact', '/subpages/contact']
    ])('serves preferred legal route %s from its existing public HTML asset', async (route, assetPath) => {
        const bindings = env({
            ASSETS: {
                fetch: vi.fn(async request => new Response(
                    `asset:${new URL(request.url).pathname}`,
                    {
                        headers: {
                            'Content-Type': 'text/html',
                            'X-Robots-Tag': 'noindex, nofollow'
                        }
                    }
                ))
            }
        });
        const request = new Request(`https://clashpanel.com${route}`);

        const response = await worker.fetch(request, bindings);

        expect(await response.text()).toBe(`asset:${assetPath}`);
        expect(new URL(bindings.ASSETS.fetch.mock.calls[0][0].url).pathname)
            .toBe(assetPath);
        expect(response.headers.get('X-Robots-Tag')).toBeNull();
    });

    it.each([
        ['/subpages/cwl-planner.html', '/cwl-planner'],
        ['/subPages/cwl-operation-board', '/cwl-tracker'],
        ['/subpages/groups/', '/clan-management'],
        ['/subpages/bracket-generator.html', '/bracket-generator'],
        ['/subpages/privacy', '/privacy'],
        ['/subpages/privacy.html', '/privacy'],
        ['/subpages/cookies', '/cookies'],
        ['/subpages/cookies.html', '/cookies'],
        ['/subpages/terms', '/terms'],
        ['/subpages/terms.html', '/terms'],
        ['/subpages/contact', '/contact'],
        ['/subpages/contact.html', '/contact'],
        ['/subpages/dashboard.html', '/dashboard'],
        ['/app/dashboard', '/dashboard'],
        ['/cwl-planner.html', '/cwl-planner'],
        ['/guides.html', '/guides'],
        ['/methodology.html', '/methodology'],
        ['/changelog.html', '/changelog']
    ])('permanently redirects %s to its public canonical route', async (source, destination) => {
        const response = await worker.fetch(
            new Request(`https://clashpanel.com${source}?ref=legacy`),
            env()
        );

        expect(response.status).toBe(301);
        expect(response.headers.get('Location'))
            .toBe(`https://clashpanel.com${destination}?ref=legacy`);
    });

    it.each([
        ['/privacy/', '/privacy'],
        ['/cookies/', '/cookies'],
        ['/terms/', '/terms'],
        ['/contact/', '/contact']
    ])('normalizes a trailing slash on the preferred legal route: %s', async (source, destination) => {
        const response = await worker.fetch(
            new Request(`https://clashpanel.com${source}`),
            env()
        );

        expect(response.status).toBe(301);
        expect(response.headers.get('Location'))
            .toBe(`https://clashpanel.com${destination}`);
    });

    it.each([
        ['http://clashpanel.com/guides.html?ref=legacy', 'https://clashpanel.com/guides?ref=legacy'],
        ['https://www.clashpanel.com/methodology', 'https://clashpanel.com/methodology'],
        ['http://www.clashpanel.com/changelog', 'https://clashpanel.com/changelog']
    ])('canonicalizes origin in one Worker redirect: %s', async (source, destination) => {
        const response = await worker.fetch(new Request(source), env());
        expect(response.status).toBe(301);
        expect(response.headers.get('Location')).toBe(destination);
    });

    it('serves private app routes from the existing tool HTML with noindex headers', async () => {
        const bindings = env({
            ASSETS: {
                fetch: vi.fn(async request => new Response(
                    `asset:${new URL(request.url).pathname}`,
                    { headers: { 'Content-Type': 'text/html' } }
                ))
            }
        });

        const response = await worker.fetch(
            new Request('https://clashpanel.com/app/cwl-tracker'),
            bindings
        );

        expect(await response.text()).toBe('asset:/subpages/cwl-operation-board');
        expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    });

    it('serves the dashboard on the clean top-level route', async () => {
        const bindings = env({
            ASSETS: {
                fetch: vi.fn(async request => new Response(
                    `asset:${new URL(request.url).pathname}`,
                    { headers: { 'Content-Type': 'text/html' } }
                ))
            }
        });

        const response = await worker.fetch(
            new Request('https://clashpanel.com/dashboard'),
            bindings
        );

        expect(await response.text()).toBe('asset:/subpages/dashboard');
        expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    });

    it('maps API paths and replaces client-controlled forwarding headers', async () => {
        const upstream = vi.fn(async (_url, init) => {
            expect(_url).toBe('https://backend.example/Player?tag=%23ABC');
            expect(init.headers.get('X-Forwarded-Host')).toBe('clashpanel.com');
            expect(init.headers.get('X-Forwarded-Proto')).toBe('https');
            expect(init.headers.get('X-Forwarded-For')).toBe('203.0.113.8');
            expect(init.headers.get('X-ClashPanel-Proxy-Secret')).toBe('shared-secret');
            return Response.json({ ok: true });
        });
        vi.stubGlobal('fetch', upstream);
        const request = new Request('https://clashpanel.com/api/Player?tag=%23ABC', {
            headers: {
                'CF-Connecting-IP': '203.0.113.8',
                'X-Forwarded-For': '198.51.100.99',
                'X-ClashPanel-Proxy-Secret': 'client-value'
            }
        });

        const response = await worker.fetch(request, env({ API_PROXY_SECRET: 'shared-secret' }));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ok: true });
    });

    it('streams official clan badges through the export asset route', async () => {
        const badgeBody = new Uint8Array([137, 80, 78, 71]);
        const upstream = vi.fn(async () => new Response(badgeBody, {
            headers: {
                'Content-Type': 'image/png',
                'Content-Length': String(badgeBody.byteLength)
            }
        }));
        vi.stubGlobal('fetch', upstream);
        const badgeUrl = 'https://api-assets.clashofclans.com/badges/200/example.png';

        const response = await worker.fetch(
            new Request(`https://clashpanel.com/api/export-assets/clan-badge?url=${encodeURIComponent(badgeUrl)}`),
            env()
        );

        expect(upstream).toHaveBeenCalledWith(badgeUrl, expect.objectContaining({ redirect: 'manual' }));
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('image/png');
        expect(response.headers.get('Cache-Control')).toContain('s-maxage=604800');
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(badgeBody);
    });

    it.each([
        'https://example.com/badges/200/example.png',
        'https://api-assets.clashofclans.com/other/example.png',
        'http://api-assets.clashofclans.com/badges/200/example.png'
    ])('rejects non-official export asset URLs: %s', async badgeUrl => {
        const upstream = vi.fn();
        vi.stubGlobal('fetch', upstream);

        const response = await worker.fetch(
            new Request(`https://clashpanel.com/api/export-assets/clan-badge?url=${encodeURIComponent(badgeUrl)}`),
            env()
        );

        expect(response.status).toBe(400);
        expect(upstream).not.toHaveBeenCalled();
    });

    it('normalizes an HTML 404 from the backend to a JSON API error', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('<h1>Not found</h1>', {
            status: 404,
            headers: { 'Content-Type': 'text/html' }
        })));

        const response = await worker.fetch(
            new Request('https://clashpanel.com/api/does-not-exist'),
            env()
        );

        expect(response.status).toBe(404);
        expect(response.headers.get('Content-Type')).toContain('application/json');
        expect(await response.json()).toEqual({
            error: 'API route not found.',
            code: 'API_ROUTE_NOT_FOUND'
        });
    });

    it('preserves structured backend errors', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => Response.json(
            { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
            { status: 401 }
        )));

        const response = await worker.fetch(
            new Request('https://clashpanel.com/api/private'),
            env()
        );

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({
            error: 'Unauthorized',
            code: 'AUTH_REQUIRED'
        });
    });

    it('returns a safe JSON response when the backend cannot be reached', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => {
            throw new Error('internal network detail');
        }));

        const response = await worker.fetch(
            new Request('https://clashpanel.com/api/health'),
            env()
        );

        expect(response.status).toBe(502);
        expect(await response.json()).toEqual({
            error: 'The API is temporarily unavailable.',
            code: 'API_UNAVAILABLE'
        });
    });
});
