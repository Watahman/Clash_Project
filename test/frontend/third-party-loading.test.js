import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const htmlFiles = listHtmlFiles('src');
const directNetworkScript = /https:\/\/(?:www\.googletagmanager\.com|pagead2\.googlesyndication\.com|pl31261194\.profitableratecpmnetwork\.com|www\.highrevenueformat\.com)/i;

describe('Privacy-aware third-party loading', () => {
    it.each(htmlFiles)('%s does not start an advertising network directly from HTML', path => {
        const source = readFileSync(path, 'utf8');

        expect(source).not.toMatch(directNetworkScript);
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

    it('keeps ad loading behind the central consent and route manager', () => {
        const adsSource = readFileSync('src/assets/js/Data/ads.js', 'utf8');
        const source = [
            adsSource,
            existsSync('src/assets/js/Data/adsterra-manager.js')
                ? readFileSync('src/assets/js/Data/adsterra-manager.js', 'utf8')
                : ''
        ].join('\n');

        expect(source).toMatch(/(?:eligible|allowlist)/i);
        expect(source).toMatch(/(?:consent|adStorage|advertisingConsent)/i);
        expect(source).toMatch(/(?:hasAdvertisingConsent|ad-consent-changed)/i);
        expect(adsSource).toContain('CONSENT_MODE_DATA_READY');
        expect(adsSource).toContain('NOT_CONFIGURED');
        expect(adsSource).toContain('NOT_APPLICABLE');
        expect(adsSource.indexOf('import(AD_MANAGER_URL)'))
            .toBeGreaterThan(adsSource.indexOf('CONSENT_MODE_DATA_READY'));
        expect(adsSource).toContain('const CLIENT_ID = \'ca-pub-7361256415342967\'');
        expect(adsSource).toContain('window.ClashToolsCMP');
    });

    it('reveals public content without waiting for registered application tasks', () => {
        const bootstrap = readFileSync('src/assets/js/shell/workspace-bootstrap.js', 'utf8');
        const publicSite = readFileSync('src/assets/js/pages/public-site.js', 'utf8');
        const workspaceCss = readFileSync('src/assets/css/workspace-system.css', 'utf8');
        const publicCss = readFileSync('src/assets/css/public-home-v2.css', 'utf8');

        expect(bootstrap).toContain("document.body?.classList.contains('public-site')");
        expect(bootstrap).toContain("html.classList.contains('public-page')");
        expect(bootstrap).toContain("document.body?.dataset.workspaceAccess === 'public'");
        expect(bootstrap).toContain('function initialContentLoad()');
        expect(publicSite).toContain('onAuthStateChange');
        expect(publicSite).not.toContain('redirectReturningUser');
        expect(publicSite).not.toContain('location.replace(\'/dashboard\')');
        expect(publicSite).not.toContain('clashtoolsRegisterInitialLoad');
        expect(workspaceCss).not.toContain('@import url');
        expect(publicCss).not.toContain('@import url');
        expect(bootstrap).toContain('display=optional');
    });

    it('does not preload the removed battle artwork on the product-led homepage', () => {
        const homepage = readFileSync('src/index.html', 'utf8');

        expect(homepage).not.toContain('class="home3-product-stage"');
        expect(homepage).not.toMatch(/rel="preload"[^>]+\/assets\/css\/pictures\/hero\./);
    });
});

function listHtmlFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) return listHtmlFiles(file);
        return file.endsWith('.html') ? [file.replaceAll('\\', '/')] : [];
    }).sort();
}
