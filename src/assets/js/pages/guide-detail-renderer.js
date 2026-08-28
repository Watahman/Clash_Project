import { t } from '../i18n/i18n.js';

const GUIDE_ANCHOR_ROUTES = Object.freeze({
    'fair-roster': '/guides/fair-cwl-roster',
    rotation: '/guides/cwl-rotation',
    availability: '/guides/cwl-availability',
    'two-sided': '/guides/cwl-attack-defense',
    'missed-guide': '/guides/missed-attacks',
    'bonus-guide': '/guides/cwl-bonus-medals',
    seasons: '/guides/cwl-season-history',
    spreadsheet: '/guides/spreadsheet-vs-cwl-planner'
});

export const GUIDE_DETAILS = Object.freeze({
    '/guides/fair-cwl-roster': Object.freeze({
        articleKey: 'guides.article1Html',
        titleKey: 'guides.detailFairTitle',
        descriptionKey: 'guides.detailFairDescription',
        canonical: 'https://clashpanel.com/guides/fair-cwl-roster',
        anchor: 'fair-roster'
    }),
    '/guides/cwl-rotation': Object.freeze({
        articleKey: 'guides.article2Html',
        titleKey: 'guides.detailRotationTitle',
        descriptionKey: 'guides.detailRotationDescription',
        canonical: 'https://clashpanel.com/guides/cwl-rotation',
        anchor: 'rotation'
    }),
    '/guides/cwl-availability': Object.freeze({
        articleKey: 'guides.article3Html',
        titleKey: 'guides.detailAvailabilityTitle',
        descriptionKey: 'guides.detailAvailabilityDescription',
        canonical: 'https://clashpanel.com/guides/cwl-availability',
        anchor: 'availability'
    }),
    '/guides/cwl-attack-defense': Object.freeze({
        articleKey: 'guides.article4Html',
        titleKey: 'guides.detailAttackDefenseTitle',
        descriptionKey: 'guides.detailAttackDefenseDescription',
        canonical: 'https://clashpanel.com/guides/cwl-attack-defense',
        anchor: 'two-sided'
    }),
    '/guides/missed-attacks': Object.freeze({
        articleKey: 'guides.article5Html',
        titleKey: 'guides.detailMissedTitle',
        descriptionKey: 'guides.detailMissedDescription',
        canonical: 'https://clashpanel.com/guides/missed-attacks',
        anchor: 'missed-guide'
    }),
    '/guides/cwl-bonus-medals': Object.freeze({
        articleKey: 'guides.article6Html',
        titleKey: 'guides.detailBonusTitle',
        descriptionKey: 'guides.detailBonusDescription',
        canonical: 'https://clashpanel.com/guides/cwl-bonus-medals',
        anchor: 'bonus-guide'
    }),
    '/guides/cwl-season-history': Object.freeze({
        articleKey: 'guides.article7Html',
        titleKey: 'guides.detailSeasonsTitle',
        descriptionKey: 'guides.detailSeasonsDescription',
        canonical: 'https://clashpanel.com/guides/cwl-season-history',
        anchor: 'seasons'
    }),
    '/guides/spreadsheet-vs-cwl-planner': Object.freeze({
        articleKey: 'guides.article8Html',
        titleKey: 'guides.detailSpreadsheetTitle',
        descriptionKey: 'guides.detailSpreadsheetDescription',
        canonical: 'https://clashpanel.com/guides/spreadsheet-vs-cwl-planner',
        anchor: 'spreadsheet'
    })
});

function setMeta(selector, value) {
    const element = document.querySelector(selector);
    if (element && value) element.setAttribute('content', value);
}

function setDetailMetadata(detail) {
    const title = t(detail.titleKey);
    const description = t(detail.descriptionKey);
    document.title = title;
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[property="og:url"]', detail.canonical);
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', detail.canonical);
}

function updateStructuredData(detail) {
    const script = document.querySelector('script[data-guide-structured-data]');
    if (!script) return;
    try {
        const graph = JSON.parse(script.textContent);
        const article = graph['@graph']?.find(node => node['@type'] === 'Article');
        if (!article) return;
        article.headline = t(detail.titleKey);
        article.description = t(detail.descriptionKey);
        article.url = detail.canonical;
        script.textContent = JSON.stringify(graph);
    } catch {
        // Keep the crawlable server-rendered JSON-LD when a custom page has bad JSON.
    }
}

export function rewriteGuideArticleLinks(root) {
    root.querySelectorAll('.resource-article a[href^="#"]').forEach(link => {
        const anchor = link.getAttribute('href').slice(1);
        const route = GUIDE_ANCHOR_ROUTES[anchor];
        if (route) link.setAttribute('href', `${route}#${anchor}`);
    });
}

function replaceDetailArticle(main, detail) {
    const article = main.querySelector('[data-guide-article]')
        || main.querySelector('.resource-content > .resource-article');
    if (!article) return;
    article.outerHTML = t(detail.articleKey);
    rewriteGuideArticleLinks(main);
    const heading = main.querySelector('.resource-hero h1');
    const articleHeading = main.querySelector('.resource-content > .resource-article h2');
    if (heading && articleHeading) heading.textContent = articleHeading.textContent;
}

export function renderGuideDetailPage(main, path) {
    const detail = GUIDE_DETAILS[path];
    if (!detail || !main?.matches('.guide-detail-page')) return false;
    setDetailMetadata(detail);
    updateStructuredData(detail);
    replaceDetailArticle(main, detail);
    return true;
}

export function guidePathForAnchor(anchor) {
    return GUIDE_ANCHOR_ROUTES[anchor] || null;
}
