const DEFAULT_RETURN_PATH = '/dashboard';
const ALLOWED_EXACT_PATHS = new Set([
    '/',
    '/404',
    '/dashboard',
    '/about',
    '/achievements',
    '/advanced-stats',
    '/bracket-generator',
    '/changelog',
    '/clan-management',
    '/contact',
    '/cookies',
    '/cwl-planner',
    '/cwl-tracker',
    '/guides',
    '/methodology',
    '/minigames',
    '/privacy',
    '/terms'
]);
const ALLOWED_PATH_PREFIXES = Object.freeze(['/app/', '/guides/']);
const ALLOWED_SUBPAGE_PATHS = new Set([
    '/subpages/achievements',
    '/subpages/achievements.html',
    '/subpages/advanced-stats',
    '/subpages/advanced-stats.html',
    '/subpages/bracket-generator',
    '/subpages/bracket-generator.html',
    '/subpages/contact',
    '/subpages/contact.html',
    '/subpages/cookies',
    '/subpages/cookies.html',
    '/subpages/cwl-operation-board',
    '/subpages/cwl-operation-board.html',
    '/subpages/cwl-planner-drafts',
    '/subpages/cwl-planner-drafts.html',
    '/subpages/cwl-planner',
    '/subpages/cwl-planner.html',
    '/subpages/dashboard',
    '/subpages/dashboard.html',
    '/subpages/explore',
    '/subpages/explore.html',
    '/subpages/groups',
    '/subpages/groups.html',
    '/subpages/minigames',
    '/subpages/minigames.html',
    '/subpages/privacy',
    '/subpages/privacy.html',
    '/subpages/profile',
    '/subpages/profile.html',
    '/subpages/terms',
    '/subpages/terms.html',
    '/subpages/war-operation-board',
    '/subpages/war-operation-board.html'
]);
const AUTH_ENTRY_PATHS = new Set([
    '/subpages/login',
    '/subpages/login.html',
    '/subpages/register',
    '/subpages/register.html'
]);

function containsUnsafeCharacters(value) {
    return /[\\\r\n]/.test(value)
        || /%(?:0d|0a|5c)/i.test(value);
}

function isAuthEntryPath(pathname) {
    return AUTH_ENTRY_PATHS.has(pathname)
        || Array.from(AUTH_ENTRY_PATHS).some(path => pathname.startsWith(`${path}/`));
}

function isAllowedPath(pathname) {
    if (isAuthEntryPath(pathname)) return false;
    return ALLOWED_EXACT_PATHS.has(pathname)
        || ALLOWED_SUBPAGE_PATHS.has(pathname)
        || ALLOWED_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

function fallbackPath(value) {
    if (typeof value !== 'string' || !value) return DEFAULT_RETURN_PATH;
    if (containsUnsafeCharacters(value)) return DEFAULT_RETURN_PATH;
    try {
        const url = new URL(value, 'https://clashpanel.local');
        return isAllowedPath(url.pathname)
            ? `${url.pathname}${url.search}${url.hash}`
            : DEFAULT_RETURN_PATH;
    } catch {
        return DEFAULT_RETURN_PATH;
    }
}

export function getSafeReturnPath(value, fallback = DEFAULT_RETURN_PATH) {
    const safeFallback = fallbackPath(fallback);
    if (typeof value !== 'string' || !value.trim()) return safeFallback;
    if (containsUnsafeCharacters(value)) return safeFallback;

    try {
        const base = globalThis.location?.origin || 'https://clashpanel.local';
        const url = new URL(value, base);
        if (url.origin !== base || !isAllowedPath(url.pathname)) return safeFallback;
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return safeFallback;
    }
}

export function getCurrentReturnPath(location = globalThis.location) {
    if (!location) return DEFAULT_RETURN_PATH;
    return getSafeReturnPath(`${location.pathname || '/'}${location.search || ''}${location.hash || ''}`);
}

export function buildLoginUrl(returnTo = getCurrentReturnPath()) {
    const safeReturnPath = getSafeReturnPath(returnTo);
    return `/subpages/login.html?next=${encodeURIComponent(safeReturnPath)}`;
}

export function redirectToLogin(returnTo = getCurrentReturnPath()) {
    const loginUrl = buildLoginUrl(returnTo);
    if (typeof window !== 'undefined' && window.location) window.location.replace(loginUrl);
    return loginUrl;
}

export { DEFAULT_RETURN_PATH };
