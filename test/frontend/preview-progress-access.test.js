import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../../worker/index.js';

const TESTER = 'emile.vandewaetere@gmail.com';
const PREVIEW_HOST = 'https://clashpanel-phase8-preview.example';
const privatePaths = [
    '/app/advanced-stats', '/app/advanced-stats.html',
    '/subpages/advanced-stats', '/subpages/advanced-stats.html',
    '/app/achievements', '/app/achievements.html',
    '/subpages/achievements', '/subpages/achievements.html'
];

function bindings(overrides = {}) {
    return {
        CLOUD_RUN_ORIGIN: 'https://backend.example',
        DISABLE_CANONICAL_REDIRECT: 'true',
        PREVIEW_PROGRESS_ACCESS_ENABLED: 'true',
        PREVIEW_PROGRESS_TESTER_EMAIL: TESTER,
        ASSETS: {
            fetch: vi.fn(async request => new Response(
                `asset:${new URL(request.url).pathname}`,
                { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=3600' } }
            ))
        },
        ...overrides
    };
}

function sessionResponse(email = TESTER, confirmed = true) {
    return new Response(JSON.stringify({
        session: { user: { id: 'verified-user', email, email_confirmed_at: confirmed ? '2026-01-01T00:00:00Z' : null } }
    }), {
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'ct_access=refreshed; Path=/; HttpOnly' }
    });
}

function request(path) {
    return new Request(`${PREVIEW_HOST}${path}`, { headers: { Cookie: 'ct_access=original' } });
}

afterEach(() => vi.unstubAllGlobals());

describe('Development preview Progress access', () => {
    it('unlocks both canonical pages only for the confirmed tester account', async () => {
        const upstream = vi.fn(async () => sessionResponse());
        vi.stubGlobal('fetch', upstream);
        const env = bindings();

        for (const [path, assetPath] of [
            ['/app/advanced-stats', '/subpages/advanced-stats'],
            ['/app/achievements', '/subpages/achievements']
        ]) {
            const response = await worker.fetch(request(path), env);
            expect(response.status).toBe(200);
            expect(await response.text()).toBe(`asset:${assetPath}`);
            expect(response.headers.get('Cache-Control')).toBe('private, no-store');
            expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
            expect(response.headers.get('Set-Cookie')).toContain('ct_access=refreshed');
        }
        expect(upstream).toHaveBeenCalledTimes(2);
        expect(upstream.mock.calls[0][0].toString()).toBe('https://backend.example/AuthSession');
        expect(upstream.mock.calls[0][1].headers.get('Cookie')).toBe('ct_access=original');
    });

    it.each(privatePaths)('denies %s to another account', async path => {
        vi.stubGlobal('fetch', vi.fn(async () => sessionResponse('other@example.com')));
        const env = bindings();

        const response = await worker.fetch(request(path), env);

        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toBe(`${PREVIEW_HOST}/dashboard`);
        expect(env.ASSETS.fetch).not.toHaveBeenCalled();
    });

    it.each(privatePaths)('denies %s if auth is unavailable', async path => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
        const env = bindings();

        const response = await worker.fetch(request(path), env);

        expect(response.status).toBe(302);
        expect(env.ASSETS.fetch).not.toHaveBeenCalled();
    });

    it.each([
        ['guest', new Response(JSON.stringify({ session: null }))],
        ['backend error', new Response('{"error":"unavailable"}', { status: 503 })],
        ['malformed response', new Response('not-json')]
    ])('denies the page for %s', async (_reason, upstreamResponse) => {
        vi.stubGlobal('fetch', vi.fn(async () => upstreamResponse));
        const env = bindings();
        const response = await worker.fetch(request('/app/achievements'), env);
        expect(response.status).toBe(302);
        expect(env.ASSETS.fetch).not.toHaveBeenCalled();
    });

    it('requires confirmed email and returns only a boolean capability', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => sessionResponse(TESTER, false)));
        const denied = await worker.fetch(request('/api/preview-progress-access'), bindings());
        expect(await denied.json()).toEqual({ enabled: false });

        vi.stubGlobal('fetch', vi.fn(async () => sessionResponse()));
        const allowed = await worker.fetch(request('/api/preview-progress-access'), bindings());
        expect(await allowed.json()).toEqual({ enabled: true });
        expect(allowed.headers.get('Cache-Control')).toBe('private, no-store');
    });

    it('routes legacy paths to the canonical private page for the tester', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => sessionResponse()));
        const response = await worker.fetch(request('/subpages/achievements.html?from=legacy'), bindings());
        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toBe(`${PREVIEW_HOST}/app/achievements?from=legacy`);
    });

    it('leaves production Coming Soon redirects intact without the preview binding', async () => {
        const upstream = vi.fn();
        vi.stubGlobal('fetch', upstream);
        const env = bindings({ PREVIEW_PROGRESS_TESTER_EMAIL: undefined });
        const page = await worker.fetch(request('/app/achievements'), env);
        const capability = await worker.fetch(request('/api/preview-progress-access'), env);

        expect(page.status).toBe(301);
        expect(page.headers.get('Location')).toBe(`${PREVIEW_HOST}/dashboard`);
        expect(await capability.json()).toEqual({ enabled: false });
        expect(upstream).not.toHaveBeenCalled();
    });

    it('does not unlock production if the tester email is set without the preview marker', async () => {
        const upstream = vi.fn();
        vi.stubGlobal('fetch', upstream);
        const response = await worker.fetch(
            request('/app/advanced-stats'),
            bindings({ PREVIEW_PROGRESS_ACCESS_ENABLED: undefined })
        );
        expect(response.status).toBe(301);
        expect(response.headers.get('Location')).toBe(`${PREVIEW_HOST}/dashboard`);
        expect(upstream).not.toHaveBeenCalled();
    });
});
