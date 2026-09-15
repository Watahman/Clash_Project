import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    resolveAuthState: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signUpWithPassword: vi.fn(),
    signInWithGoogle: vi.fn(),
    requestPasswordReset: vi.fn(),
    redirectAfterLogin: vi.fn(),
    redirectAfterRegistration: vi.fn(),
    buildRegisterUrl: vi.fn(value => value
        ? `/subpages/register.html?next=${encodeURIComponent(value)}`
        : '/subpages/register.html'),
    buildLoginUrl: vi.fn(value => value
        ? `/subpages/login.html?next=${encodeURIComponent(value)}`
        : '/subpages/login.html'),
    getSafeReturnPath: vi.fn(value => value || '/dashboard'),
    getPostLoginDestination: vi.fn(value => value || '/dashboard'),
    getPostRegistrationDestination: vi.fn(value => value || '/dashboard'),
    initI18n: vi.fn(),
    t: vi.fn(key => key)
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
    signInWithPassword: mocks.signInWithPassword,
    signUpWithPassword: mocks.signUpWithPassword,
    signInWithGoogle: mocks.signInWithGoogle,
    requestPasswordReset: mocks.requestPasswordReset
}));

vi.mock('../../src/assets/js/auth/auth-navigation.js?v=20260915-auth-policy-v1', () => ({
    buildRegisterUrl: mocks.buildRegisterUrl,
    buildLoginUrl: mocks.buildLoginUrl,
    getSafeReturnPath: mocks.getSafeReturnPath,
    getPostLoginDestination: mocks.getPostLoginDestination,
    getPostRegistrationDestination: mocks.getPostRegistrationDestination,
    redirectAfterLogin: mocks.redirectAfterLogin,
    redirectAfterRegistration: mocks.redirectAfterRegistration
}));

vi.mock('../../src/assets/js/i18n/i18n.js?v=20260829-public-auth-v1', () => ({
    initI18n: mocks.initI18n,
    t: mocks.t
}));

vi.mock('../../src/assets/js/utils/password.js', () => ({
    isStrongPassword: vi.fn(() => true)
}));

function deferred() {
    let resolve;
    const promise = new Promise(release => { resolve = release; });
    return { promise, resolve };
}

function mountLogin(query = '') {
    window.history.replaceState({}, '', `/subpages/login.html${query}`);
    document.body.innerHTML = `
        <form id="auth-form">
            <input id="email" type="email" required>
            <input id="password" type="password" required>
            <button id="submit-button" type="submit"></button>
            <button id="forgot-password" type="button"></button>
            <button id="google-login" type="button"></button>
            <a href="register.html">Register</a>
            <p id="auth-status"></p>
        </form>`;
}

function mountRegister(query = '') {
    window.history.replaceState({}, '', `/subpages/register.html${query}`);
    document.body.innerHTML = `
        <form id="auth-form">
            <input id="username" required>
            <input id="email" type="email" required>
            <input id="password" type="password" required>
            <input id="password2" type="password" required>
            <i id="seg1"></i><i id="seg2"></i><i id="seg3"></i>
            <button id="submit-button" type="submit"></button>
            <button id="google-login" type="button"></button>
            <a href="login.html">Log in</a>
            <p id="auth-status"></p>
        </form>`;
}

async function importLogin() {
    await import('../../src/assets/js/pages/login.js?v=20260829-public-auth-v1');
    await Promise.resolve();
}

async function importRegister() {
    await import('../../src/assets/js/pages/register.js?v=20260829-public-auth-v1');
    await Promise.resolve();
}

let authStateCallback;

describe('auth page navigation flows', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '';
        Object.values(mocks).forEach(mock => mock.mockReset());
        mocks.getSafeReturnPath.mockImplementation(value => value || '/dashboard');
        mocks.getPostLoginDestination.mockImplementation(value => value || '/dashboard');
        mocks.getPostRegistrationDestination.mockImplementation(value => value || '/dashboard');
        mocks.buildLoginUrl.mockImplementation(value => value
            ? `/subpages/login.html?next=${encodeURIComponent(value)}`
            : '/subpages/login.html');
        mocks.buildRegisterUrl.mockImplementation(value => value
            ? `/subpages/register.html?next=${encodeURIComponent(value)}`
            : '/subpages/register.html');
        mocks.t.mockImplementation(key => key);
        authStateCallback = null;
        mocks.onAuthStateChange.mockImplementation(callback => {
            authStateCallback = callback;
            return () => {
                if (authStateCallback === callback) authStateCallback = null;
            };
        });
        mocks.signInWithPassword.mockResolvedValue({ session: { user: { id: 'user-1' } } });
        mocks.signUpWithPassword.mockResolvedValue({ session: { user: { id: 'user-1' } } });
        window.clashtoolsRegisterInitialLoad = vi.fn();
    });

    it('keeps login inert until a slow session restore confirms guest', async () => {
        const session = deferred();
        mocks.resolveAuthState.mockReturnValue(session.promise);
        mountLogin();

        await importLogin();
        expect(document.body.dataset.authState).toBe('loading');
        expect(document.querySelector('#submit-button')).toHaveProperty('disabled', true);
        expect(document.querySelector('#auth-form')).toHaveProperty('inert', true);

        session.resolve({ status: 'guest', session: null });
        await vi.waitFor(() => expect(document.body.dataset.authState).toBe('guest'));
        expect(document.querySelector('#submit-button')).toHaveProperty('disabled', false);
        expect(document.querySelector('#email')).toHaveProperty('disabled', false);
        expect(mocks.redirectAfterLogin).not.toHaveBeenCalled();
    });

    it('redirects an already authenticated login page exactly once', async () => {
        mocks.resolveAuthState.mockResolvedValue({
            status: 'authenticated',
            session: { user: { id: 'user-1' } }
        });
        mountLogin('?next=%2Fapp%2Fcwl-tracker');

        await importLogin();
        await vi.waitFor(() => expect(mocks.redirectAfterLogin).toHaveBeenCalledTimes(1));
        expect(mocks.redirectAfterLogin).toHaveBeenCalledWith('/app/cwl-tracker');
        expect(document.querySelector('#auth-form')).toHaveProperty('inert', true);
    });

    it('keeps auth unavailable distinct from guest', async () => {
        mocks.resolveAuthState.mockRejectedValue(new Error('offline'));
        mountLogin();

        await importLogin();
        await vi.waitFor(() => expect(document.body.dataset.authState).toBe('auth-unavailable'));
        expect(document.querySelector('#auth-status').dataset.state).toBe('error');
        expect(document.querySelector('#auth-form')).toHaveProperty('inert', true);
        expect(document.querySelector('#email')).toHaveProperty('disabled', true);
        expect(mocks.redirectAfterLogin).not.toHaveBeenCalled();
    });

    it('uses the authenticated destination after a successful login', async () => {
        mocks.resolveAuthState.mockResolvedValue({ status: 'guest', session: null });
        mountLogin();
        await importLogin();
        await vi.waitFor(() => expect(document.body.dataset.authState).toBe('guest'));

        document.querySelector('#email').value = 'user@example.com';
        document.querySelector('#password').value = 'Password1!';
        const form = document.querySelector('#auth-form');
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() => expect(mocks.redirectAfterLogin).toHaveBeenCalledTimes(1));
        expect(mocks.redirectAfterLogin).toHaveBeenCalledWith('/dashboard');
    });

    it('does not navigate twice when auth state is emitted repeatedly', async () => {
        mocks.resolveAuthState.mockResolvedValue({ status: 'guest', session: null });
        mountLogin('?next=%2Fapp%2Fcwl-tracker');
        await importLogin();
        await vi.waitFor(() => expect(document.body.dataset.authState).toBe('guest'));

        const authenticated = { status: 'authenticated', session: { user: { id: 'user-1' } } };
        const notifyAuthState = authStateCallback;
        notifyAuthState(null, authenticated);
        notifyAuthState(null, authenticated);

        expect(mocks.redirectAfterLogin).toHaveBeenCalledTimes(1);
        expect(mocks.redirectAfterLogin).toHaveBeenCalledWith('/app/cwl-tracker');
    });

    it('uses one replace policy for an authenticated registration page', async () => {
        mocks.resolveAuthState.mockResolvedValue({
            status: 'authenticated',
            session: { user: { id: 'user-1' } }
        });
        mountRegister();
        await importRegister();

        await vi.waitFor(() => expect(mocks.redirectAfterRegistration).toHaveBeenCalledTimes(1));
        expect(mocks.redirectAfterRegistration).toHaveBeenCalledWith('/dashboard');
        expect(document.querySelector('#auth-form')).toHaveProperty('inert', true);
    });

    it('keeps registration inert when auth is unavailable', async () => {
        mocks.resolveAuthState.mockRejectedValue(new Error('offline'));
        mountRegister();
        await importRegister();

        await vi.waitFor(() => expect(document.body.dataset.authState).toBe('auth-unavailable'));
        expect(document.querySelector('#auth-form')).toHaveProperty('inert', true);
        expect(document.querySelector('#username')).toHaveProperty('disabled', true);
        expect(mocks.redirectAfterRegistration).not.toHaveBeenCalled();
    });
});
