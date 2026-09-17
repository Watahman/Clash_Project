export const PUBLIC_ASSETS = new Map([
    ['/privacy', '/subpages/privacy'],
    ['/cookies', '/subpages/cookies'],
    ['/terms', '/subpages/terms'],
    ['/contact', '/subpages/contact']
]);

const PUBLIC_ROUTE_REDIRECTS = new Map([
    ['/privacy.html', '/privacy'],
    ['/cookies.html', '/cookies'],
    ['/terms.html', '/terms'],
    ['/contact.html', '/contact'],
    ['/subpages/privacy', '/privacy'],
    ['/subpages/privacy.html', '/privacy'],
    ['/subpages/cookies', '/cookies'],
    ['/subpages/cookies.html', '/cookies'],
    ['/subpages/terms', '/terms'],
    ['/subpages/terms.html', '/terms'],
    ['/subpages/contact', '/contact'],
    ['/subpages/contact.html', '/contact']
]);

function trimTrailingSlashes(pathname) {
    return pathname.replace(/\/+$/, '') || '/';
}

export function publicRouteRedirect(pathname) {
    const rawPath = String(pathname || '/');
    const normalizedPath = trimTrailingSlashes(rawPath.toLowerCase());
    const alias = PUBLIC_ROUTE_REDIRECTS.get(normalizedPath);
    if (alias) return alias;
    if (PUBLIC_ASSETS.has(normalizedPath) && rawPath !== normalizedPath) {
        return normalizedPath;
    }
    return null;
}
