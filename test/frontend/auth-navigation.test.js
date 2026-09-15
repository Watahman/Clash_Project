import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildLoginUrl,
    buildRegisterUrl,
    getCurrentReturnPath,
    getSafeReturnPath,
    getPostLoginDestination,
    getPostRegistrationDestination,
    redirectAfterLogin,
    redirectAfterLogout,
    redirectAfterRegistration
} from '../../src/assets/js/auth/auth-navigation.js?v=20260915-auth-policy-v1';

describe('auth navigation return policy', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/app/cwl-tracker?clan=%23ABC123#standings');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('builds ordinary auth links without a return destination', () => {
        expect(buildLoginUrl()).toBe('/subpages/login.html');
        expect(buildRegisterUrl()).toBe('/subpages/register.html');
    });

    it('keeps post-auth destinations out of auth pages and falls back safely', () => {
        expect(getPostLoginDestination('/login')).toBe('/dashboard');
        expect(getPostRegistrationDestination('/subpages/register.html')).toBe('/dashboard');
        expect(getPostLoginDestination('https://evil.example/steal')).toBe('/dashboard');
    });

    it('deduplicates internal auth state navigation', () => {
        const replace = vi.fn();
        vi.stubGlobal('window', { location: { replace } });

        expect(redirectAfterLogin('/app/auth-once')).toBe('/app/auth-once');
        expect(redirectAfterLogin('/app/auth-once')).toBe('/app/auth-once');
        expect(replace).toHaveBeenCalledTimes(1);
        expect(replace).toHaveBeenCalledWith('/app/auth-once');
    });

    it('uses replace for registration and logout transitions', () => {
        const replace = vi.fn();
        vi.stubGlobal('window', { location: { replace } });

        redirectAfterRegistration('/app/registered');
        redirectAfterLogout();

        expect(replace.mock.calls).toEqual([['/app/registered'], ['/']]);
    });

    it('preserves safe public and app destinations including query and hash', () => {
        expect(getSafeReturnPath('/guides/cwl-availability?from=planner#workflow'))
            .toBe('/guides/cwl-availability?from=planner#workflow');
        expect(getSafeReturnPath('/guides?from=planner#workflow'))
            .toBe('/guides?from=planner#workflow');
        expect(getSafeReturnPath('/subpages/groups?tab=polls#active'))
            .toBe('/subpages/groups?tab=polls#active');
        expect(getCurrentReturnPath())
            .toBe('/app/cwl-tracker?clan=%23ABC123#standings');
        expect(buildLoginUrl('/dashboard?from=public#return'))
            .toBe('/subpages/login.html?next=%2Fdashboard%3Ffrom%3Dpublic%23return');
    });

    it.each([
        'https://evil.example/steal',
        '//evil.example/steal',
        '/app\\evil',
        '/app/evil%5cnext',
        '/app/evil%0d%0aLocation:%20https://evil.example',
        '/app/%zz',
        '/login',
        '/login.html',
        '/register',
        '/register.html',
        '/subpages/login.html',
        '/subpages/login.html?next=%2Fapp%2Fcwl-tracker',
        '/subpages/register',
        '/subpages/register?next=%2Fapp%2Fcwl-tracker'
    ])('falls back for unsafe or auth-entry destination %s', value => {
        expect(getSafeReturnPath(value)).toBe('/dashboard');
    });
});
