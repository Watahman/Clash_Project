export const PUBLIC_SITE_ORIGIN = 'https://clashpanel.com';

export const publicRoutes = Object.freeze([
    { path: '/', file: 'index.html', indexable: true, lastmod: '2026-08-28' },
    { path: '/about', file: 'about.html', indexable: true, lastmod: '2026-08-21' },
    { path: '/cwl-planner', file: 'cwl-planner.html', indexable: true, lastmod: '2026-08-24' },
    { path: '/cwl-tracker', file: 'cwl-tracker.html', indexable: true, lastmod: '2026-08-28' },
    { path: '/clan-management', file: 'clan-management.html', indexable: true, lastmod: '2026-08-28' },
    { path: '/advanced-stats', file: 'advanced-stats.html', indexable: true, lastmod: '2026-08-31' },
    { path: '/achievements', file: 'achievements.html', indexable: true, lastmod: '2026-08-31' },
    { path: '/minigames', file: 'minigames.html', indexable: true, lastmod: '2026-08-28' },
    { path: '/guides', file: 'guides.html', indexable: true, lastmod: '2026-08-28' },
    { path: '/guides/fair-cwl-roster', file: 'guides/fair-cwl-roster.html', indexable: true, lastmod: '2026-08-27' },
    { path: '/guides/cwl-rotation', file: 'guides/cwl-rotation.html', indexable: true, lastmod: '2026-08-27' },
    { path: '/guides/cwl-availability', file: 'guides/cwl-availability.html', indexable: true, lastmod: '2026-08-27' },
    { path: '/guides/cwl-attack-defense', file: 'guides/cwl-attack-defense.html', indexable: true, lastmod: '2026-08-27' },
    { path: '/guides/missed-attacks', file: 'guides/missed-attacks.html', indexable: true, lastmod: '2026-08-27' },
    { path: '/guides/cwl-bonus-medals', file: 'guides/cwl-bonus-medals.html', indexable: true, lastmod: '2026-08-27' },
    { path: '/guides/cwl-season-history', file: 'guides/cwl-season-history.html', indexable: true, lastmod: '2026-08-27' },
    { path: '/guides/spreadsheet-vs-cwl-planner', file: 'guides/spreadsheet-vs-cwl-planner.html', indexable: true, lastmod: '2026-08-27' },
    { path: '/methodology', file: 'methodology.html', indexable: true, lastmod: '2026-08-12' },
    { path: '/changelog', file: 'changelog.html', indexable: true, lastmod: '2026-08-14' },
    { path: '/privacy', file: 'subpages/privacy.html', indexable: true, lastmod: '2026-08-27' },
    { path: '/cookies', file: 'subpages/cookies.html', indexable: true, lastmod: '2026-08-27' },
    { path: '/terms', file: 'subpages/terms.html', indexable: true, lastmod: '2026-08-27' },
    { path: '/contact', file: 'subpages/contact.html', indexable: true, lastmod: '2026-08-27' },
    { path: '/bracket-generator', file: 'bracket-generator.html', indexable: true, lastmod: '2026-08-28' }
]);

export function canonicalUrl(route, origin = PUBLIC_SITE_ORIGIN) {
    return route.path === '/' ? `${origin}/` : `${origin}${route.path}`;
}

export function renderSitemap(origin = PUBLIC_SITE_ORIGIN) {
    const urls = publicRoutes.filter(route => route.indexable).map(route =>
        `  <url><loc>${canonicalUrl(route, origin)}</loc><lastmod>${route.lastmod}</lastmod></url>`
    );
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export function renderRobots(origin = PUBLIC_SITE_ORIGIN) {
    return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /subpages/popup_htmls/\n\nSitemap: ${origin}/sitemap.xml\n`;
}
