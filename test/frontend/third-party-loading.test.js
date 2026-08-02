import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const htmlFiles = [
    'src/index.html',
    'src/about.html',
    'src/cwl-planner.html',
    'src/cwl-tracker.html',
    'src/clan-management.html',
    'src/bracket-generator.html',
    'src/404.html',
    'src/subpages/contact.html',
    'src/subpages/cookies.html',
    'src/subpages/privacy.html',
    'src/subpages/terms.html',
    'src/subpages/login.html',
    'src/subpages/register.html',
    'src/subpages/dashboard.html',
    'src/subpages/groups.html',
    'src/subpages/cwl-planner.html',
    'src/subpages/cwl-planner-drafts.html',
    'src/subpages/cwl-operation-board.html',
    'src/subpages/war-operation-board.html',
    'src/subpages/bracket-generator.html'
];

describe('Privacy-aware third-party loading', () => {
    it.each(htmlFiles)('%s does not start Google network scripts directly from HTML', path => {
        const source = readFileSync(path, 'utf8');
        expect(source).not.toContain('https://www.googletagmanager.com/gtag/js');
        expect(source).not.toContain('https://pagead2.googlesyndication.com/pagead/js');
    });

    it('sets denied consent defaults before configuring analytics', () => {
        const source = readFileSync('src/assets/js/Data/analytics.js', 'utf8');
        const consentIndex = source.indexOf("window.gtag('consent', 'default'");
        const configIndex = source.indexOf("window.gtag('config'");

        expect(consentIndex).toBeGreaterThan(-1);
        expect(configIndex).toBeGreaterThan(consentIndex);
        expect(source).toContain("analytics_storage: 'denied'");
        expect(source).toContain("ad_storage: 'denied'");
    });

    it('loads analytics and ads after window load or idle time', () => {
        const analytics = readFileSync('src/assets/js/Data/analytics.js', 'utf8');
        const ads = readFileSync('src/assets/js/Data/ads.js', 'utf8');

        expect(analytics).toContain("window.addEventListener('load'");
        expect(analytics).toContain('requestIdleCallback');
        expect(analytics).toContain("'pointerdown'");
        expect(analytics).toContain('12000');
        expect(ads).toContain("window.addEventListener('load'");
        expect(ads).toContain('requestIdleCallback');
        expect(ads).toContain('navigator.connection?.saveData');
    });

    it('reveals public content without waiting for registered application tasks', () => {
        const bootstrap = readFileSync('src/assets/js/shell/workspace-bootstrap.js', 'utf8');
        const publicSite = readFileSync('src/assets/js/pages/public-site.js', 'utf8');
        const workspaceCss = readFileSync('src/assets/css/workspace-system.css', 'utf8');
        const publicCss = readFileSync('src/assets/css/public-home-v2.css', 'utf8');

        expect(bootstrap).toContain("document.body?.classList.contains('public-site')");
        expect(bootstrap).toContain("html.classList.contains('public-page')");
        expect(publicSite).toContain('void redirectReturningUser()');
        expect(publicSite).not.toContain('clashtoolsRegisterInitialLoad');
        expect(workspaceCss).not.toContain('@import url');
        expect(publicCss).not.toContain('@import url');
        expect(bootstrap).toContain('display=optional');
    });

    it('preloads the homepage LCP artwork with high priority', () => {
        const homepage = readFileSync('src/index.html', 'utf8');
        expect(homepage).toMatch(
            /<link rel="preload" as="image" href="\/assets\/css\/pictures\/hero\.[a-f0-9]{10}\.avif" fetchpriority="high">/
        );
    });
});
