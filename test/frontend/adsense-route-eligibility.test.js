import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const excludedFiles = [
    'src/404.html',
    'src/about.html',
    'src/advanced-stats.html',
    'src/achievements.html',
    'src/bracket-generator.html',
    'src/cwl-planner.html',
    'src/cwl-tracker.html',
    'src/clan-management.html',
    'src/guides.html',
    'src/methodology.html',
    'src/changelog.html',
    'src/subpages/contact.html',
    'src/subpages/cookies.html',
    'src/subpages/privacy.html',
    'src/subpages/terms.html',
    'src/subpages/login.html',
    'src/subpages/register.html',
    'src/subpages/dashboard.html',
    'src/subpages/groups.html',
    'src/subpages/advanced-stats.html',
    'src/subpages/achievements.html',
    'src/subpages/cwl-planner.html',
    'src/subpages/cwl-planner-drafts.html',
    'src/subpages/cwl-operation-board.html',
    'src/subpages/war-operation-board.html',
    'src/subpages/bracket-generator.html'
];

describe('AdSense route eligibility', () => {
    it.each(excludedFiles)('%s never imports the AdSense loader', file => {
        expect(readFileSync(file, 'utf8')).not.toContain('Data/ads.js');
    });

    it('uses one conservative allowlist and the published Google CMP consent state', () => {
        const source = readFileSync('src/assets/js/Data/ads.js', 'utf8');
        expect(source).toContain("const AD_ELIGIBLE_ROUTES = new Set(['/'])");
        expect(source).toContain('CONSENT_MODE_DATA_READY');
        expect(source).toContain('ConsentModePurposeStatusEnum');
        expect(source).toContain('showRevocationMessage');
        expect(source).toContain('hasAdvertisingConsent: () => advertisingConsent');
        expect(source).toContain("robots.includes('noindex')");
        expect(source).toContain('navigation.responseStatus === 200');
        expect(source).toContain("'/app/'");
        expect(source).toContain("'/subpages/'");
    });
});
