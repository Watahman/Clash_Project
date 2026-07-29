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
    it('leaves non-API requests with the static asset binding', async () => {
        const bindings = env();
        const request = new Request('https://clashpanel.com/subpages/privacy');

        const response = await worker.fetch(request, bindings);

        expect(await response.text()).toBe('asset');
        expect(bindings.ASSETS.fetch).toHaveBeenCalledWith(request);
    });

    it.each([
        ['/subpages/cwl-planner.html', '/cwl-planner'],
        ['/subPages/cwl-operation-board', '/cwl-tracker'],
        ['/subpages/groups/', '/clan-management'],
        ['/subpages/bracket-generator.html', '/bracket-generator'],
        ['/subpages/privacy.html', '/subpages/privacy'],
        ['/subpages/cookies.html', '/subpages/cookies'],
        ['/subpages/terms.html', '/subpages/terms'],
        ['/subpages/contact.html', '/subpages/contact'],
        ['/subpages/dashboard.html', '/dashboard'],
        ['/app/dashboard', '/dashboard'],
        ['/cwl-planner.html', '/cwl-planner']
    ])('permanently redirects %s to its public canonical route', async (source, destination) => {
        const response = await worker.fetch(
            new Request(`https://clashpanel.com${source}?ref=legacy`),
            env()
        );

        expect(response.status).toBe(301);
        expect(response.headers.get('Location'))
            .toBe(`https://clashpanel.com${destination}?ref=legacy`);
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
