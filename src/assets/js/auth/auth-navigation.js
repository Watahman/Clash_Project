const DEFAULT_RETURN_PATH = '/dashboard';
const AUTH_LOGIN_PATH = '/subpages/login.html';
const AUTH_REGISTER_PATH = '/subpages/register.html';
const PUBLIC_AFTER_LOGOUT_PATH = '/';

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
    '/login',
    '/login.html',
    '/register',
    '/register.html',
    '/subpages/login',
    '/subpages/login.html',
    '/subpages/register',
    '/subpages/register.html'
]);

// Auth pages can be reached through static aliases and must never be a post-auth target.
function isAuthEntryPath(pathname) {
    return AUTH_ENTRY_PATHS.has(pathname)
        || Array.from(AUTH_ENTRY_PATHS).some(path => pathname.startsWith(`${path}/`));
}

function containsUnsafeCharacters(value) {
    return /[\\\u0000-\u001f\u007f]/.test(value)
        || /%(?![0-9a-f]{2})/i.test(value)
        || /%(?:00|0[1-9a-f]|1[0-9a-f]|7f|0d|0a|5c)/i.test(value);
}

function isAllowedPath(pathname) {
    if (isAuthEntryPath(pathname)) return false;
    return ALLOWED_EXACT_PATHS.has(pathname)
        || ALLOWED_SUBPAGE_PATHS.has(pathname)
        || ALLOWED_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

function baseOrigin() {
    return globalThis.location?.origin || 'https://clashpanel.local';
}

function safePath(value, fallback, origin = baseOrigin()) {
    if (typeof value !== 'string' || !value.trim() || containsUnsafeCharacters(value)) {
        return fallback;
    }
    try {
        const url = new URL(value.trim(), origin);
        if (url.origin !== origin || !isAllowedPath(url.pathname)) return fallback;
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return fallback;
    }
}

function fallbackPath(value) {
    return safePath(value, DEFAULT_RETURN_PATH, 'https://clashpanel.local');
}

export function getSafeReturnPath(value, fallback = DEFAULT_RETURN_PATH) {
    const safeFallback = fallbackPath(fallback);
    return safePath(value, safeFallback);
}

export function getCurrentReturnPath(location = globalThis.location) {
    if (!location) return DEFAULT_RETURN_PATH;
    return getSafeReturnPath(`${location.pathname || '/'}${location.search || ''}${location.hash || ''}`);
}

function buildAuthUrl(path, returnTo, includeNext) {
    if (!includeNext) return path;
    const safeReturnPath = getSafeReturnPath(returnTo);
    return `${path}?next=${encodeURIComponent(safeReturnPath)}`;
}

function safeNavigationTarget(value) {
    if (typeof value !== 'string' || !value.trim() || containsUnsafeCharacters(value)) {
        return PUBLIC_AFTER_LOGOUT_PATH;
    }
    try {
        const url = new URL(value.trim(), baseOrigin());
        if (url.origin !== baseOrigin()) return PUBLIC_AFTER_LOGOUT_PATH;
        if (isAuthEntryPath(url.pathname)) {
            const next = url.searchParams.get('next');
            if (next !== null) {
                return buildAuthUrl(url.pathname, next, true);
            }
            return `${url.pathname}${url.search}${url.hash}`;
        }
        return getSafeReturnPath(value, PUBLIC_AFTER_LOGOUT_PATH);
    } catch {
        return PUBLIC_AFTER_LOGOUT_PATH;
    }
}

/**
 * Build a normal auth link without a return destination. Passing a destination
 * explicitly preserves the legacy/protected-route contract; guards should use
 * redirectToLogin so the intent is unambiguous at call sites.
 */
export function buildLoginUrl(returnTo, { includeNext = returnTo !== undefined } = {}) {
    return buildAuthUrl(AUTH_LOGIN_PATH, returnTo, includeNext);
}

export function buildRegisterUrl(returnTo, { includeNext = returnTo !== undefined } = {}) {
    return buildAuthUrl(AUTH_REGISTER_PATH, returnTo, includeNext);
}

export function getPostLoginDestination(returnTo) {
    return getSafeReturnPath(returnTo, DEFAULT_RETURN_PATH);
}

export function getPostRegistrationDestination(returnTo) {
    return getSafeReturnPath(returnTo, DEFAULT_RETURN_PATH);
}

export const getPostRegisterDestination = getPostRegistrationDestination;

export function getPostLogoutDestination() {
    return PUBLIC_AFTER_LOGOUT_PATH;
}

let lastInternalNavigation = '';

/** Navigate an internal auth transition once for this document lifetime. */
export function replaceAuthNavigation(destination) {
    const path = safeNavigationTarget(destination);
    if (lastInternalNavigation === path) return false;
    lastInternalNavigation = path;
    if (typeof window !== 'undefined' && window.location?.replace) {
        window.location.replace(path);
    }
    return true;
}

export function redirectToLogin(returnTo = getCurrentReturnPath()) {
    const loginUrl = buildLoginUrl(getSafeReturnPath(returnTo), { includeNext: true });
    replaceAuthNavigation(loginUrl);
    return loginUrl;
}

export function redirectAfterLogin(returnTo) {
    const destination = getPostLoginDestination(returnTo);
    replaceAuthNavigation(destination);
    return destination;
}

export function redirectAfterRegistration(returnTo) {
    const destination = getPostRegistrationDestination(returnTo);
    replaceAuthNavigation(destination);
    return destination;
}

export function redirectAfterLogout() {
    const destination = getPostLogoutDestination();
    replaceAuthNavigation(destination);
    return destination;
}

export {
    AUTH_LOGIN_PATH,
    AUTH_REGISTER_PATH,
    DEFAULT_RETURN_PATH,
    PUBLIC_AFTER_LOGOUT_PATH
};
