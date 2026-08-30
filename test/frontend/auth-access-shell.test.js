import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

describe('auth state and action access contracts', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.resetModules();
        vi.unstubAllGlobals();
    });

    it('keeps a backend outage distinct from guest and preserves the cached identity', async () => {
        localStorage.setItem('id', 'known-user');
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
        const auth = await import('../../src/assets/js/auth/auth-client.js?v=20260829-public-auth-v1');

        const state = await auth.resolveAuthState();

        expect(state.status).toBe(auth.AUTH_STATES.UNAVAILABLE);
        expect(state.error).toBeInstanceOf(auth.AuthUnavailableError);
        expect(state.error).toMatchObject({ code: 'AUTH_UNAVAILABLE', status: 0 });
        expect(localStorage.getItem('id')).toBe('known-user');
    });

    it('keeps a server failure unavailable instead of treating it as guest', async () => {
        localStorage.setItem('id', 'known-user');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
        const auth = await import('../../src/assets/js/auth/auth-client.js?v=20260829-public-auth-v1');

        const state = await auth.resolveAuthState();

        expect(state.status).toBe(auth.AUTH_STATES.UNAVAILABLE);
        expect(state.error).toMatchObject({ code: 'AUTH_UNAVAILABLE', status: 503 });
        expect(localStorage.getItem('id')).toBe('known-user');
    });

    it('maps only a real 401 to guest', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
        const auth = await import('../../src/assets/js/auth/auth-client.js?v=20260829-public-auth-v1');

        const state = await auth.resolveAuthState();

        expect(state).toMatchObject({ status: auth.AUTH_STATES.GUEST, session: null });
    });

    it('propagates a private API 401 to guest and clears the remembered identity', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ session: { user: { id: 'u1' } } }), { status: 200 }))
            .mockResolvedValueOnce(new Response('', { status: 401 }));
        vi.stubGlobal('fetch', fetchMock);
        const auth = await import('../../src/assets/js/auth/auth-client.js?v=20260829-public-auth-v1');
        const cache = await import('../../src/assets/js/cache/local-cache.js?v=20260829-public-auth-v1');
        const { requestJson } = await import('../../src/assets/js/utils/request-json.js?v=20260829-public-auth-v1');
        const cacheKey = `auth-expired:${crypto.randomUUID()}`;

        await auth.resolveAuthState();
        await cache.setCached(cacheKey, { value: 'private' }, 10_000, 10_000, 'supabase');
        expect(localStorage.getItem('id')).toBe('u1');
        await expect(requestJson('/private-data', { body: {}, sessionBound: true }))
            .rejects.toMatchObject({ status: 401, sessionBound: true });
        await vi.waitFor(() => expect(auth.getAuthState().status).toBe(auth.AUTH_STATES.GUEST));
        expect(localStorage.getItem('id')).toBeNull();
        await vi.waitFor(async () => expect(await cache.getCached(cacheKey)).toBeNull());
    });

    it('executes authenticated actions and does not execute guest actions', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ session: { user: { id: 'u1' } } }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ session: { user: { id: 'u1' } } }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        const auth = await import('../../src/assets/js/auth/auth-client.js?v=20260829-public-auth-v1');
        const action = vi.fn().mockResolvedValue('saved');

        const result = await auth.requireAuthForAction({ action, reason: 'save-plan' });

        expect(result).toMatchObject({ executed: true, result: 'saved' });
        expect(action).toHaveBeenCalledWith(expect.objectContaining({ user: { id: 'u1' } }));
    });

    it('creates a safe same-origin login return path for guest actions', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
        const auth = await import('../../src/assets/js/auth/auth-client.js?v=20260829-public-auth-v1');
        const onGuest = vi.fn();

        const result = await auth.requireAuthForAction({
            reason: 'saved-plan',
            returnTo: 'https://evil.example/steal',
            onGuest
        });

        expect(result.executed).toBe(false);
        expect(result.returnTo).toBe('/dashboard');
        expect(result.loginUrl).toBe('/subpages/login.html?next=%2Fdashboard');
        expect(onGuest).toHaveBeenCalledWith(expect.objectContaining({
            reason: 'saved-plan',
            loginUrl: result.loginUrl
        }));
    });

    it('preserves an allowed public route in a login return path', async () => {
        const { getSafeReturnPath, buildLoginUrl } = await import('../../src/assets/js/auth/auth-navigation.js?v=20260829-public-auth-v1');

        expect(getSafeReturnPath('/guides/cwl-availability?from=planner#workflow'))
            .toBe('/guides/cwl-availability?from=planner#workflow');
        expect(buildLoginUrl('/dashboard?from=public'))
            .toBe('/subpages/login.html?next=%2Fdashboard%3Ffrom%3Dpublic');
    });

    it('does not let a late session response restore auth after sign-out', async () => {
        let releaseSession;
        const sessionResponse = new Promise(resolve => { releaseSession = resolve; });
        const fetchMock = vi.fn()
            .mockImplementationOnce(() => sessionResponse)
            .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        const auth = await import('../../src/assets/js/auth/auth-client.js?v=20260829-public-auth-v1');

        const pendingSession = auth.resolveAuthState();
        await auth.signOut();
        releaseSession(new Response(JSON.stringify({ session: { user: { id: 'late-user' } } }), { status: 200 }));
        await pendingSession;

        expect(auth.getAuthState()).toMatchObject({ status: auth.AUTH_STATES.GUEST, session: null });
        expect(localStorage.getItem('id')).toBeNull();
    });

    it('ignores a late private 401 from account A after account B is authenticated', async () => {
        let releasePrivateRequest;
        const privateResponse = new Promise(resolve => { releasePrivateRequest = resolve; });
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                session: { user: { id: 'account-a' } }
            }), { status: 200 }))
            .mockImplementationOnce(() => privateResponse)
            .mockResolvedValueOnce(new Response(JSON.stringify({
                session: { user: { id: 'account-b' } }
            }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        const auth = await import('../../src/assets/js/auth/auth-client.js?v=20260829-public-auth-v1');
        const { requestJson } = await import('../../src/assets/js/utils/request-json.js?v=20260829-public-auth-v1');

        await auth.resolveAuthState();
        const accountARequest = requestJson('/private-account-a', {
            body: {},
            sessionBound: true
        });
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

        await auth.signInWithPassword('account-b@example.com', 'Password1!');
        expect(auth.getAuthState()).toMatchObject({
            status: auth.AUTH_STATES.AUTHENTICATED,
            session: { user: { id: 'account-b' } }
        });

        releasePrivateRequest(new Response('', { status: 401 }));
        await expect(accountARequest).rejects.toMatchObject({
            status: 401,
            sessionBound: true
        });
        expect(auth.getAuthState()).toMatchObject({
            status: auth.AUTH_STATES.AUTHENTICATED,
            session: { user: { id: 'account-b' } }
        });
    });
});

describe('workspace access registry and guest shell markup', () => {
    it('exposes the definitive public and auth route matrix', async () => {
        const { ACCESS, WORKSPACE_MODULES, getWorkspaceAccessForPath } = await import('../../src/assets/js/shell/module-registry.js?v=20260829-public-dashboard-v1');
        const access = Object.fromEntries(WORKSPACE_MODULES.map(module => [module.id, module.access]));

        expect(access).toEqual({
            dashboard: ACCESS.PUBLIC,
            explore: ACCESS.PUBLIC,
            groups: ACCESS.AUTH,
            planner: ACCESS.PUBLIC,
            drafts: ACCESS.AUTH,
            operation: ACCESS.PUBLIC,
            warOperation: ACCESS.PUBLIC,
            bracket: ACCESS.PUBLIC,
            minigames: ACCESS.PUBLIC,
            advancedStats: ACCESS.AUTH,
            achievements: ACCESS.AUTH,
            profile: ACCESS.AUTH
        });
        expect(getWorkspaceAccessForPath('/app/cwl-tracker/')).toBe(ACCESS.PUBLIC);
        expect(getWorkspaceAccessForPath('/app/profile')).toBe(ACCESS.AUTH);
    });

    it('marks private navigation and identity controls without removing them from the shell', async () => {
        const { buildWorkspaceShellMarkup } = await import('../../src/assets/js/shell/workspace-shell-markup.js?v=20260829-public-auth-v1');
        const { sidebar, topbar } = buildWorkspaceShellMarkup('explore');

        expect(sidebar).toContain('data-workspace-access="auth"');
        expect(sidebar).toContain('workspace-nav-lock');
        expect(sidebar).toContain('data-auth-only');
        expect(sidebar).toContain('data-guest-only');
        expect(sidebar).toContain('shell.publicWebsite');
        expect(topbar).toContain('workspace-auth-status');
        expect(topbar).toContain('data-auth-only');
        expect(topbar).toContain('data-guest-only');
    });

    it('marks planner private-source locks for authenticated shell presentation', async () => {
        const planner = await readFile(
            resolve(process.cwd(), 'src/subpages/cwl-planner.html'),
            'utf8'
        );
        const markup = document.createElement('template');
        markup.innerHTML = planner;
        const privateSourceTabs = markup.content.querySelectorAll('[data-auth-required]');

        expect(privateSourceTabs).toHaveLength(2);
        privateSourceTabs.forEach(tab => {
            expect(tab.querySelector('[data-workspace-auth-lock]')).not.toBeNull();
        });
    });
});
