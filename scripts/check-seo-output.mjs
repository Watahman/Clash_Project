import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const pages = [
    {
        file: 'index.html',
        canonical: 'https://clashpanel.com/',
        title: 'Clash of Clans Clan Management, CWL Planner & Tracker | ClashPanel',
        h1: 'Plan, track and manage your Clash of Clans clan',
        links: ['/cwl-planner', '/cwl-tracker', '/clan-management', '/bracket-generator']
    },
    {
        file: 'cwl-planner.html',
        canonical: 'https://clashpanel.com/cwl-planner',
        title: 'Free Clash of Clans CWL Planner & Roster Optimizer | ClashPanel',
        h1: 'Clash of Clans CWL Planner',
        links: ['/cwl-tracker']
    },
    {
        file: 'cwl-tracker.html',
        canonical: 'https://clashpanel.com/cwl-tracker',
        title: 'Clash of Clans CWL Tracker, Stats & History | ClashPanel',
        h1: 'Clash of Clans CWL Tracker & Operation Board',
        links: ['/cwl-planner']
    },
    {
        file: 'clan-management.html',
        canonical: 'https://clashpanel.com/clan-management',
        title: 'Clash of Clans Clan Management & Clan Family Tool | ClashPanel',
        h1: 'Clash of Clans Clan Management',
        links: ['/cwl-planner']
    },
    {
        file: 'bracket-generator.html',
        canonical: 'https://clashpanel.com/bracket-generator',
        title: 'Clash of Clans Bracket Generator | ClashPanel',
        h1: 'Clash of Clans Bracket Generator',
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
    assert(h1s[0].textContent.trim() === page.h1, `${page.file}: incorrect H1`);
    assert(/\bindex\b/i.test(robots) && !/\bnoindex\b/i.test(robots), `${page.file}: not indexable`);
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
    structuredData.forEach(script => JSON.parse(script.textContent));
}

const expectedSitemapUrls = pages.map(page => page.canonical).concat([
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
assert(!sitemap.includes('/war-tracker'), 'Future War Tracker must not be in sitemap.xml');

const robots = await readFile(resolve('dist', 'robots.txt'), 'utf8');
assert(robots.includes('Disallow: /app/'), 'robots.txt must keep private app routes out of crawl');
assert(
    robots.includes('Sitemap: https://clashpanel.com/sitemap.xml'),
    'robots.txt must reference the production sitemap'
);

console.log(`Validated SEO metadata, content and links for ${pages.length} canonical pages.`);

function assert(condition, message) {
    if (!condition) throw new Error(message);
}
