import { beforeEach, describe, expect, it } from 'vitest';
import {
    buildLoginUrl,
    getCurrentReturnPath,
    getSafeReturnPath
} from '../../src/assets/js/auth/auth-navigation.js?v=20260829-public-auth-v1';

describe('auth navigation return policy', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/app/cwl-tracker?clan=%23ABC123#standings');
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
        '/subpages/login.html',
        '/subpages/login.html?next=%2Fapp%2Fcwl-tracker',
        '/subpages/register',
        '/subpages/register?next=%2Fapp%2Fcwl-tracker'
    ])('falls back for unsafe or auth-entry destination %s', value => {
        expect(getSafeReturnPath(value)).toBe('/dashboard');
    });
});
