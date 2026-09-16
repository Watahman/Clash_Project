import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const htmlFiles = listHtmlFiles('src');
const directNetworkScript = /https:\/\/(?:www\.googletagmanager\.com|pagead2\.googlesyndication\.com|resources\.infolinks\.com)/i;

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
        const managerSource = readFileSync('src/assets/js/Data/infolinks-manager.js', 'utf8');
        const source = [adsSource, managerSource].join('\n');

        expect(source).toMatch(/(?:eligible|allowlist)/i);
        expect(source).toMatch(/(?:consent|adStorage|advertisingConsent)/i);
        expect(source).toMatch(/(?:hasAdvertisingConsent|ad-consent-changed)/i);
        expect(adsSource).not.toMatch(/googlefc|CONSENT_MODE_DATA_READY|googletagmanager|pagead\.googlesyndication/i);
        expect(adsSource).not.toMatch(/ca-pub-|publisher(?:-|\s)?tag|CLIENT_ID/i);
        expect(adsSource).toContain("fetch('/api/ads-context'");
        expect(adsSource).toContain('localStorage');
        expect(adsSource).toContain('STORAGE_KEY');
        expect(adsSource).toContain('DECISIONS');
        expect(adsSource).toMatch(/protected/);
        expect(adsSource).toMatch(/non-eea|non-protected/);
        expect(adsSource).toContain('advertisingConsent');
        expect(adsSource).toMatch(/!state\.advertisingConsent[\s\S]*import\([^)]*MANAGER/);
        expect(adsSource).toContain('window.ClashToolsCMP');
        expect(managerSource).toContain('initInfolinksAds');
        expect(managerSource).toContain('hasConfiguredIntegration');
        expect(managerSource).not.toMatch(/data-[a-z-]*slot|cp-ad-slot|placeholder/i);
    });

    it('skips CMP UI and regional context requests when the provider is disabled', () => {
        const source = readFileSync('src/assets/js/Data/ads.js', 'utf8');
        const disabledStart = source.indexOf('if (!state.providerConfigured)');
        const configuredStart = source.indexOf('appendStylesheet(); installFacade(true)', disabledStart);
        const disabledBranch = source.slice(disabledStart, configuredStart);

        expect(disabledStart).toBeGreaterThan(-1);
        expect(configuredStart).toBeGreaterThan(disabledStart);
        expect(disabledBranch).toContain("state.reason = 'provider-disabled'");
        expect(disabledBranch).toContain('installFacade(false)');
        expect(disabledBranch).toContain('return;');
        expect(disabledBranch).not.toContain('showPanel');
        expect(disabledBranch).not.toContain('loadRegionContext');
    });

    it('keeps configured providers behind the existing CMP and regional consent flow', () => {
        const source = readFileSync('src/assets/js/Data/ads.js', 'utf8');

        expect(source).toContain('configuredProvider');
        expect(source).toContain("config?.enabled !== true");
        expect(source).toContain("new URL(source, window.location.origin).protocol === 'https:'");
        expect(source).toContain('appendStylesheet(); installFacade(true)');
        expect(source).toContain('updateFromContext(await loadRegionContext())');
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
