import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGoogleSignInUrl } from '../../src/assets/js/auth/auth-client.js';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('Google authentication', () => {
    it('requests a server-side OAuth URL while preserving an internal destination', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(
            JSON.stringify({ url: 'https://project.supabase.co/auth/v1/authorize?provider=google' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        vi.stubGlobal('fetch', fetchMock);

        await expect(getGoogleSignInUrl('/subpages/groups.html?tab=polls'))
            .resolves.toContain('provider=google');

        const [, options] = fetchMock.mock.calls[0];
        expect(JSON.parse(options.body)).toEqual({ next: '/subpages/groups.html?tab=polls' });
        expect(options.credentials).toBe('include');
    });

    it('rejects an invalid OAuth-start response', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
            JSON.stringify({}),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        )));

        await expect(getGoogleSignInUrl()).rejects.toMatchObject({
            code: 'INVALID_GOOGLE_AUTH_RESPONSE'
        });
    });

    it('keeps Google controls on login and registration pages', () => {
        const login = readFileSync('src/subpages/login.html', 'utf8');
        const register = readFileSync('src/subpages/register.html', 'utf8');
        expect(login).toContain('id="google-login"');
        expect(register).toContain('id="google-login"');
    });
});
