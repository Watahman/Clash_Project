const EXPORT_ASSET_PATH = '/api/export-assets/clan-badge';
const CLAN_BADGE_HOST = 'api-assets.clashofclans.com';
const MAX_BADGE_BYTES = 2 * 1024 * 1024;

export function isExportAssetPath(pathname) {
    return String(pathname || '').toLowerCase() === EXPORT_ASSET_PATH;
}

export async function proxyExportAsset(request, incomingUrl) {
    if (!['GET', 'HEAD'].includes(request.method)) {
        return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Only GET and HEAD are supported.', {
            Allow: 'GET, HEAD'
        });
    }

    const source = allowedClanBadgeUrl(incomingUrl.searchParams.get('url'));
    if (!source) {
        return errorResponse(400, 'INVALID_BADGE_URL', 'A valid Clash of Clans badge URL is required.');
    }

    let response;
    try {
        response = await fetch(source, {
            method: request.method,
            headers: { Accept: 'image/png,image/*;q=0.8' },
            redirect: 'manual'
        });
    } catch {
        return errorResponse(502, 'BADGE_UNAVAILABLE', 'The clan badge is temporarily unavailable.');
    }

    const contentType = response.headers.get('Content-Type') || '';
    const contentLength = Number(response.headers.get('Content-Length')) || 0;
    if (!response.ok || !contentType.toLowerCase().startsWith('image/')) {
        return errorResponse(502, 'BADGE_UNAVAILABLE', 'The clan badge is temporarily unavailable.');
    }
    if (contentLength > MAX_BADGE_BYTES) {
        return errorResponse(413, 'BADGE_TOO_LARGE', 'The clan badge is too large to export.');
    }

    const headers = new Headers({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
        'X-Content-Type-Options': 'nosniff'
    });
    if (contentLength) headers.set('Content-Length', String(contentLength));
    return new Response(request.method === 'HEAD' ? null : response.body, {
        status: response.status,
        headers
    });
}

function allowedClanBadgeUrl(value) {
    try {
        const url = new URL(String(value || ''));
        const allowedPath = url.pathname.startsWith('/badges/') && url.pathname.toLowerCase().endsWith('.png');
        if (url.protocol !== 'https:' || url.hostname !== CLAN_BADGE_HOST || url.port || !allowedPath) return null;
        if (url.username || url.password) return null;
        return url.toString();
    } catch {
        return null;
    }
}

function errorResponse(status, code, error, extraHeaders = {}) {
    return Response.json({ error, code }, {
        status,
        headers: {
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            ...extraHeaders
        }
    });
}
