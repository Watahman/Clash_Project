import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    callback: null,
    resolveAuthState: vi.fn(),
    onAuthStateChange: vi.fn(callback => {
        mocks.callback = callback;
        return () => { mocks.callback = null; };
    }),
    buildLoginUrl: vi.fn(path => `/subpages/login.html?next=${encodeURIComponent(path)}`)
}));

vi.mock('../../src/assets/js/auth/auth-client.js?v=20260915-auth-policy-v1', () => ({
    AUTH_STATES: {
        LOADING: 'loading',
        GUEST: 'guest',
        AUTHENTICATED: 'authenticated',
        UNAVAILABLE: 'auth-unavailable'
    },
    resolveAuthState: mocks.resolveAuthState,
    onAuthStateChange: mocks.onAuthStateChange,
    buildLoginUrl: mocks.buildLoginUrl
}));

vi.mock('../../src/assets/js/i18n/i18n.js?v=20260831-master-live-v1', () => ({
    initI18n: vi.fn(),
    t: key => key
}));

function deferred() {
    let resolve;
    const promise = new Promise(release => { resolve = release; });
    return { promise, resolve };
}

function mountExplore() {
    document.body.innerHTML = `
        <button data-explore-filter="all"></button>
        <section class="explore-grid"></section>`;
}

function protectedCards() {
    return [...document.querySelectorAll(
        '[data-module-access="auth"]:not([data-module-state="coming-soon"])'
    )];
}

describe('Explore auth-state presentation', () => {
    beforeEach(() => {
        vi.resetModules();
        mountExplore();
        mocks.callback = null;
        mocks.resolveAuthState.mockReset();
        mocks.onAuthStateChange.mockClear();
        mocks.buildLoginUrl.mockClear();
        window.clashtoolsRegisterInitialLoad = vi.fn();
    });

    it('keeps protected cards inert until guest is confirmed', async () => {
        const auth = deferred();
        mocks.resolveAuthState.mockReturnValue(auth.promise);

        await import('../../src/assets/js/pages/explore.js?v=20260915-auth-policy-v1');
        await vi.waitFor(() => expect(protectedCards().length).toBeGreaterThan(0));
        protectedCards().forEach(card => {
            expect(card.dataset.moduleState).toBe('auth-loading');
            expect(card.tagName).toBe('DIV');
            expect(card.hasAttribute('href')).toBe(false);
            expect(card.textContent).not.toContain('auth.login');
        });

        auth.resolve({ status: 'guest', session: null });
        await vi.waitFor(() => expect(protectedCards()[0]?.dataset.moduleState)
            .toBe('auth-required'));
        expect(protectedCards().every(card => card.tagName === 'A')).toBe(true);
        expect(protectedCards().every(card => card.getAttribute('href')?.includes('next=')))
            .toBe(true);
    });

    it('removes guest login actions when auth becomes unavailable', async () => {
        mocks.resolveAuthState.mockResolvedValue({ status: 'guest', session: null });
        await import('../../src/assets/js/pages/explore.js?v=20260915-auth-policy-v2');
        await vi.waitFor(() => expect(protectedCards()[0]?.dataset.moduleState)
            .toBe('auth-required'));

        mocks.callback(null, { status: 'auth-unavailable', session: null });

        protectedCards().forEach(card => {
            expect(card.dataset.moduleState).toBe('auth-unavailable');
            expect(card.tagName).toBe('DIV');
            expect(card.hasAttribute('href')).toBe(false);
            expect(card.textContent).toContain('auth.sessionUnavailable');
        });
    });
});
