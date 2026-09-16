const ACCESS_PATH = '/api/preview-progress-access';
const PRIVATE_PATHS = new Map([
    ['/app/advanced-stats', '/app/advanced-stats'],
    ['/app/advanced-stats.html', '/app/advanced-stats'],
    ['/subpages/advanced-stats', '/app/advanced-stats'],
    ['/subpages/advanced-stats.html', '/app/advanced-stats'],
    ['/app/achievements', '/app/achievements'],
    ['/app/achievements.html', '/app/achievements'],
    ['/subpages/achievements', '/app/achievements'],
    ['/subpages/achievements.html', '/app/achievements']
]);

export function isPreviewProgressAccessPath(pathname) {
    return pathname.toLowerCase() === ACCESS_PATH;
}

export function previewProgressCanonicalPath(pathname) {
    return PRIVATE_PATHS.get(pathname.toLowerCase().replace(/\/+$/, '')) || null;
}

export function isPreviewProgressConfigured(env) {
    return String(env.DISABLE_CANONICAL_REDIRECT).toLowerCase() === 'true'
        && String(env.PREVIEW_PROGRESS_ACCESS_ENABLED).toLowerCase() === 'true'
        && Boolean(String(env.PREVIEW_PROGRESS_TESTER_EMAIL || '').trim());
}

function sessionCookies(headers) {
    if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
    const cookie = headers.get('Set-Cookie');
    return cookie ? [cookie] : [];
}

function privateHeaders(headers = new Headers(), cookies = []) {
    const result = new Headers(headers);
    result.set('Cache-Control', 'private, no-store');
    result.set('X-Robots-Tag', 'noindex, nofollow');
    for (const cookie of cookies) result.append('Set-Cookie', cookie);
    return result;
}

export async function previewProgressAccess(request, env, incomingUrl, createBackendHeaders) {
    if (!isPreviewProgressConfigured(env) || !env.CLOUD_RUN_ORIGIN) {
        return { enabled: false, cookies: [] };
    }

    try {
        const backendOrigin = new URL(env.CLOUD_RUN_ORIGIN);
        if (!['http:', 'https:'].includes(backendOrigin.protocol)) throw new Error('Invalid origin');
        const target = new URL('/AuthSession', backendOrigin);
        const headers = createBackendHeaders(request, incomingUrl, env);
        headers.set('Content-Type', 'application/json');
        const response = await fetch(target, {
            method: 'POST', headers, body: '{}', redirect: 'manual',
            signal: AbortSignal.timeout(5000)
        });
        const cookies = sessionCookies(response.headers);
        if (!response.ok) return { enabled: false, cookies };
        const user = (await response.json())?.session?.user;
        const email = String(user?.email || '').trim().toLowerCase();
        const expected = String(env.PREVIEW_PROGRESS_TESTER_EMAIL).trim().toLowerCase();
        return {
            enabled: Boolean(user?.id && user?.email_confirmed_at && email === expected),
            cookies
        };
    } catch {
        return { enabled: false, cookies: [] };
    }
}

export function previewProgressAccessResponse(request, result) {
    if (request.method !== 'GET') {
        return new Response(null, {
            status: 405,
            headers: privateHeaders(new Headers({ Allow: 'GET' }))
        });
    }
    return new Response(JSON.stringify({ enabled: result.enabled }), {
        headers: privateHeaders(new Headers({ 'Content-Type': 'application/json; charset=utf-8' }), result.cookies)
    });
}

export function previewProgressRouteResponse(request, incomingUrl, canonical, result, assetResponse) {
    if (!['GET', 'HEAD'].includes(request.method)) {
        return new Response(null, { status: 405, headers: privateHeaders(new Headers({ Allow: 'GET, HEAD' })) });
    }
    if (!result.enabled || incomingUrl.pathname.toLowerCase() !== canonical) {
        const destination = result.enabled ? canonical : '/dashboard';
        const target = new URL(destination, incomingUrl);
        target.search = incomingUrl.search;
        return new Response(null, {
            status: 302,
            headers: privateHeaders(new Headers({ Location: target.toString() }), result.cookies)
        });
    }
    if (!assetResponse) return new Response(null, { status: 404, headers: privateHeaders() });
    return new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers: privateHeaders(assetResponse.headers, result.cookies)
    });
}
