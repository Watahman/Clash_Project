export const PUBLIC_SITE_ORIGIN = 'https://clashpanel.com';

export const publicRoutes = Object.freeze([
    { path: '/', file: 'index.html', indexable: true, lastmod: '2026-08-12' },
    { path: '/about', file: 'about.html', indexable: true, lastmod: '2026-08-12' },
    { path: '/cwl-planner', file: 'cwl-planner.html', indexable: true, lastmod: '2026-08-12' },
    { path: '/cwl-tracker', file: 'cwl-tracker.html', indexable: true, lastmod: '2026-08-12' },
    { path: '/clan-management', file: 'clan-management.html', indexable: true, lastmod: '2026-08-12' },
    { path: '/advanced-stats', file: 'advanced-stats.html', indexable: true, lastmod: '2026-08-20' },
    { path: '/achievements', file: 'achievements.html', indexable: true, lastmod: '2026-08-20' },
    { path: '/minigames', file: 'minigames.html', indexable: true, lastmod: '2026-08-12' },
    { path: '/guides', file: 'guides.html', indexable: true, lastmod: '2026-08-12' },
    { path: '/methodology', file: 'methodology.html', indexable: true, lastmod: '2026-08-12' },
    { path: '/changelog', file: 'changelog.html', indexable: true, lastmod: '2026-08-14' },
    { path: '/privacy', file: 'subpages/privacy.html', indexable: true, lastmod: '2026-08-12' },
    { path: '/cookies', file: 'subpages/cookies.html', indexable: true, lastmod: '2026-08-12' },
    { path: '/terms', file: 'subpages/terms.html', indexable: true, lastmod: '2026-08-12' },
    { path: '/contact', file: 'subpages/contact.html', indexable: true, lastmod: '2026-08-12' },
    { path: '/bracket-generator', file: 'bracket-generator.html', indexable: false }
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

