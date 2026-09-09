import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { canonicalUrl, publicRoutes } from './public-routes.mjs';
import { APP_ALIASES } from '../worker/app-routes.js';

const titles = new Set();
const descriptions = new Set();
const knownPublicPaths = new Set(publicRoutes.map(route => route.path));
const authPaths = new Set(['/subpages/login', '/subpages/register']);
const redirectingTargets = new Set([
    ...APP_ALIASES,
    '/subpages/login.html',
    '/subpages/register.html'
]);
const publicDocuments = [];
const adLoader = '/assets/js/Data/ads.js?v=20260909-adsterra-v1';
const adEligibleFiles = new Set([
    'index.html',
    'guides.html',
    'methodology.html',
    'cwl-planner.html',
    'cwl-tracker.html',
    'clan-management.html',
    'bracket-generator.html',
    'minigames.html',
    'about.html',
    'changelog.html',
    'guides/cwl-attack-defense.html',
    'guides/cwl-availability.html',
    'guides/cwl-bonus-medals.html',
    'guides/cwl-rotation.html',
    'guides/cwl-season-history.html',
    'guides/fair-cwl-roster.html',
    'guides/missed-attacks.html',
    'guides/spreadsheet-vs-cwl-planner.html'
]);
const adExcludedFiles = new Set([
    '404.html',
    'advanced-stats.html',
    'achievements.html',
    'subpages/achievements.html',
    'subpages/advanced-stats.html',
    'subpages/bracket-generator.html',
    'subpages/contact.html',
    'subpages/cookies.html',
    'subpages/cwl-operation-board.html',
    'subpages/cwl-planner-drafts.html',
    'subpages/cwl-planner.html',
    'subpages/dashboard.html',
    'subpages/explore.html',
    'subpages/groups.html',
    'subpages/login.html',
    'subpages/minigames.html',
    'subpages/privacy.html',
    'subpages/profile.html',
    'subpages/register.html',
    'subpages/terms.html',
    'subpages/war-operation-board.html'
]);
const directNetworkScript = /https:\/\/(?:www\.googletagmanager\.com|pagead2\.googlesyndication\.com|pl31261194\.profitableratecpmnetwork\.com|www\.highrevenueformat\.com)/i;

for (const route of publicRoutes) {
    const source = await readFile(resolve('dist', route.file), 'utf8');
    const document = new JSDOM(source).window.document;
    const description = document.querySelector('meta[name="description"]')?.content.trim();
    const canonicals = document.querySelectorAll('link[rel="canonical"]');
    const h1s = document.querySelectorAll('h1');
    const robots = document.querySelector('meta[name="robots"]')?.content || '';
    const expectedCanonical = canonicalUrl(route);

    assert(document.documentElement.lang === 'en', `${route.file}: expected lang="en"`);
    assert(document.title.trim(), `${route.file}: missing title`);
    assert(!titles.has(document.title), `${route.file}: duplicate title`);
    titles.add(document.title);
    assert(description, `${route.file}: missing description`);
    assert(!descriptions.has(description), `${route.file}: duplicate description`);
    descriptions.add(description);
    assert(canonicals.length === 1, `${route.file}: expected exactly one canonical`);
    assert(canonicals[0].href === expectedCanonical, `${route.file}: incorrect canonical`);
    assert(h1s.length === 1, `${route.file}: expected exactly one H1`);
    assert(h1s[0].textContent.trim(), `${route.file}: empty H1`);
    assert(document.querySelector('meta[property="og:url"]')?.content === expectedCanonical, `${route.file}: og:url differs from canonical`);
    assert(document.querySelector('meta[name="twitter:card"]')?.content?.startsWith('summary'), `${route.file}: missing Twitter card`);

    if (route.indexable) {
        assert(/\bindex\b/i.test(robots) && !/\bnoindex\b/i.test(robots), `${route.file}: not indexable`);
    } else {
        assert(/\bnoindex\b/i.test(robots), `${route.file}: unavailable page must be noindex`);
    }

    [...document.querySelectorAll('script[type="application/ld+json"]')].forEach(script => {
        JSON.parse(script.textContent);
    });

    if (/sample data/i.test(document.body.textContent)) {
        assert(document.querySelector('.sample-label'), `${route.file}: sample data lacks a visible label`);
    }

    for (const link of document.querySelectorAll('a[href]')) {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || /^(https?:|mailto:|tel:)/i.test(href)) continue;
        const url = new URL(href, 'https://clashpanel.com');
        const allowedApplicationTarget = url.pathname === '/dashboard'
            || url.pathname.startsWith('/app/')
            || authPaths.has(url.pathname);
        assert(knownPublicPaths.has(url.pathname) || allowedApplicationTarget, `${route.file}: unknown internal target ${href}`);
        assert(!redirectingTargets.has(url.pathname.toLowerCase()), `${route.file}: internal target uses redirecting alias ${href}`);
    }
    publicDocuments.push({ route, document, source });
}

const expectedSitemapUrls = publicRoutes.filter(route => route.indexable).map(route => canonicalUrl(route));
const sitemap = await readFile(resolve('dist', 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
assert(JSON.stringify(sitemapUrls) === JSON.stringify(expectedSitemapUrls), 'sitemap does not match the canonical public route configuration');
assert(!sitemap.includes('/app/') && !sitemap.includes('/dashboard'), 'private route appears in sitemap');

const robots = await readFile(resolve('dist', 'robots.txt'), 'utf8');
assert(robots.includes('Sitemap: https://clashpanel.com/sitemap.xml'), 'robots.txt does not reference the canonical sitemap');
assert(!robots.includes('replace-with-production-domain.invalid'), 'robots.txt contains the placeholder production domain');
assert(!robots.includes('Disallow: /app/'), 'robots.txt must allow crawlers to observe app noindex responses');

const initialHtmlPolicyFiles = ['subpages/privacy.html', 'subpages/cookies.html', 'subpages/terms.html', 'subpages/contact.html'];
for (const file of initialHtmlPolicyFiles) {
    const { document } = publicDocuments.find(item => item.route.file === file);
    const words = document.querySelector('[data-policy-document]')?.textContent.trim().split(/\s+/).length || 0;
    assert(words >= 150, `${file}: policy/support body is not complete in initial HTML`);
}

const generatedHtmlFiles = await listHtmlFiles(resolve('dist'));
const expectedHtmlFiles = [...adEligibleFiles, ...adExcludedFiles].sort();
assert(JSON.stringify(generatedHtmlFiles) === JSON.stringify(expectedHtmlFiles), 'HTML inventory changed without an explicit ad eligibility decision');

for (const file of generatedHtmlFiles) {
    const source = await readFile(resolve('dist', file), 'utf8');
    assertAdContract(file, source, adEligibleFiles.has(file));
    assert(!directNetworkScript.test(source), `${file}: advertising network script is embedded in HTML`);
}

console.log(`Validated ${publicRoutes.length} public route definitions, ${expectedSitemapUrls.length} sitemap URLs, initial policy HTML, structured data, links and ad route exclusions.`);

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function assertAdContract(file, source, eligible) {
    const imports = [...source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
        .filter(match => match[1] === adLoader);
    const expectedCount = eligible ? 1 : 0;

    assert(imports.length === expectedCount, `${file}: expected ${expectedCount} central ad manager import(s)`);
    if (eligible) assert(/\bdefer\b/i.test(imports[0][0]), `${file}: ad manager must be deferred`);
}

async function listHtmlFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(entries.map(async entry => {
        const file = resolve(directory, entry.name);
        if (entry.isDirectory()) return listHtmlFiles(file);
        return entry.name.endsWith('.html') ? [file.slice(resolve('dist').length + 1).replaceAll('\\', '/')] : [];
    }));
    return files.flat().sort();
}
