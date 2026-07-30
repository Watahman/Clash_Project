import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const pages = [
    {
        file: 'index.html',
        canonical: 'https://clashpanel.com/',
        title: 'Clash of Clans Clan Management, CWL Planner & Tracker | ClashPanel',
        h1: 'Plan better. Win more wars.',
        indexable: true,
        links: ['/cwl-planner', '/cwl-tracker', '/clan-management']
    },
    {
        file: 'about.html',
        canonical: 'https://clashpanel.com/about',
        title: 'About ClashPanel | Clash of Clans Clan Management Toolkit',
        h1: 'Built for clan leaders.',
        indexable: true,
        links: ['/cwl-planner']
    },
    {
        file: 'cwl-planner.html',
        canonical: 'https://clashpanel.com/cwl-planner',
        title: 'Free Clash of Clans CWL Planner & Roster Optimizer | ClashPanel',
        h1: 'Build your CWL roster plan.',
        indexable: true,
        links: ['/cwl-tracker']
    },
    {
        file: 'cwl-tracker.html',
        canonical: 'https://clashpanel.com/cwl-tracker',
        title: 'Clash of Clans CWL Tracker, Stats & History | ClashPanel',
        h1: 'See the whole CWL.',
        indexable: true,
        links: ['/cwl-planner']
    },
    {
        file: 'clan-management.html',
        canonical: 'https://clashpanel.com/clan-management',
        title: 'Clash of Clans Clan Management & Clan Family Tool | ClashPanel',
        h1: 'Run every clan together.',
        indexable: true,
        links: ['/cwl-planner']
    },
    {
        file: 'bracket-generator.html',
        canonical: 'https://clashpanel.com/bracket-generator',
        title: 'Clash of Clans Bracket Generator | ClashPanel',
        h1: 'Build a better bracket.',
        indexable: false,
        comingSoon: true,
        links: ['/cwl-planner']
    }
];

const descriptions = new Set();
const titles = new Set();

for (const page of pages) {
    const source = await readFile(resolve('dist', page.file), 'utf8');
    const document = new JSDOM(source).window.document;
    const description = document.querySelector('meta[name="description"]')?.content.trim();
    const canonicalLinks = document.querySelectorAll('link[rel="canonical"]');
    const h1s = document.querySelectorAll('h1');
    const robots = document.querySelector('meta[name="robots"]')?.content || '';
    const ogUrl = document.querySelector('meta[property="og:url"]')?.content;
    const ogImage = document.querySelector('meta[property="og:image"]')?.content;
    const twitterCard = document.querySelector('meta[name="twitter:card"]')?.content;

    assert(document.documentElement.lang === 'en', `${page.file}: expected lang="en"`);
    assert(document.title === page.title, `${page.file}: unexpected title`);
    assert(!titles.has(document.title), `${page.file}: duplicate title`);
    titles.add(document.title);
    assert(description, `${page.file}: missing description`);
    assert(!descriptions.has(description), `${page.file}: duplicate description`);
    descriptions.add(description);
    assert(canonicalLinks.length === 1, `${page.file}: expected exactly one canonical`);
    assert(canonicalLinks[0].href === page.canonical, `${page.file}: incorrect canonical`);
    assert(!canonicalLinks[0].href.includes('/subpages/'), `${page.file}: legacy canonical`);
    assert(h1s.length === 1, `${page.file}: expected exactly one H1`);
    const h1Text = h1s[0].textContent.replace(/\s+/g, ' ').trim();
    assert(h1Text === page.h1, `${page.file}: incorrect H1`);
    if (page.indexable) {
        assert(/\bindex\b/i.test(robots) && !/\bnoindex\b/i.test(robots), `${page.file}: not indexable`);
    } else {
        assert(/\bnoindex\b/i.test(robots), `${page.file}: unavailable page must be noindex`);
        assert(/\bfollow\b/i.test(robots), `${page.file}: unavailable page should keep link discovery`);
    }
    assert(ogUrl === page.canonical, `${page.file}: og:url differs from canonical`);
    assert(ogImage?.startsWith('https://clashpanel.com/assets/social/'), `${page.file}: missing social image`);
    assert(twitterCard === 'summary_large_image', `${page.file}: expected large Twitter card`);
    page.links.forEach(href => {
        assert(
            document.querySelector(`a[href="${href}"]`),
            `${page.file}: missing crawlable link to ${href}`
        );
    });

    const structuredData = [...document.querySelectorAll('script[type="application/ld+json"]')];
    assert(structuredData.length === 1, `${page.file}: expected one JSON-LD block`);
    const parsedStructuredData = structuredData.map(script => JSON.parse(script.textContent));
    if (page.comingSoon) {
        assert(
            !JSON.stringify(parsedStructuredData).includes('"WebApplication"'),
            `${page.file}: coming-soon page must not claim to be a live WebApplication`
        );
    }
}

const expectedSitemapUrls = pages.filter(page => page.indexable).map(page => page.canonical).concat([
    'https://clashpanel.com/subpages/privacy',
    'https://clashpanel.com/subpages/cookies',
    'https://clashpanel.com/subpages/terms',
    'https://clashpanel.com/subpages/contact'
]);
const sitemap = await readFile(resolve('dist', 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
assert(
    JSON.stringify(sitemapUrls) === JSON.stringify(expectedSitemapUrls),
    'sitemap.xml does not contain only the canonical public URLs'
);
assert(!sitemap.includes('/bracket-generator'), 'Coming-soon Bracket Generator must not be in sitemap.xml');
assert(!sitemap.includes('/war-tracker'), 'Future War Tracker must not be in sitemap.xml');

const robots = await readFile(resolve('dist', 'robots.txt'), 'utf8');
assert(
    !robots.includes('Disallow: /app/'),
    'robots.txt must allow crawlers to see X-Robots-Tag noindex on private app routes'
);
assert(
    robots.includes('Sitemap: https://clashpanel.com/sitemap.xml'),
    'robots.txt must reference the production sitemap'
);

const redirects = await readFile(resolve('dist', '_redirects'), 'utf8');
for (const name of ['privacy', 'cookies', 'terms', 'contact']) {
    assert(
        redirects.includes(`/subpages/${name}.html /subpages/${name} 301`),
        `_redirects must permanently canonicalize ${name}.html`
    );
}

const legalPaths = [
    '/subpages/privacy',
    '/subpages/cookies',
    '/subpages/terms',
    '/subpages/contact'
];
const publicHtmlFiles = pages.map(page => page.file).concat([
    'subpages/privacy.html',
    'subpages/cookies.html',
    'subpages/terms.html',
    'subpages/contact.html'
]);
for (const file of publicHtmlFiles) {
    const source = await readFile(resolve('dist', file), 'utf8');
    const document = new JSDOM(source).window.document;
    for (const path of legalPaths) {
        assert(document.querySelector(`a[href="${path}"]`), `${file}: missing canonical legal link to ${path}`);
        assert(!document.querySelector(`a[href="${path}.html"]`), `${file}: links to non-canonical ${path}.html`);
    }
}

console.log('Validated SEO metadata, crawl controls, sitemap and canonical links for 5 indexable pages and 1 coming-soon page.');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}