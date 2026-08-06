import { t } from '../i18n/i18n.js';

function normalizedPath() {
    return String(window.location.pathname || '/')
        .replace(/\/index\.html$/i, '/')
        .replace(/\/$/, '') || '/';
}

function setText(selector, key) {
    const element = document.querySelector(selector);
    if (element) element.textContent = t(key);
}

function setHtml(selector, key) {
    const element = document.querySelector(selector);
    if (element) element.innerHTML = t(key);
}

function setAttribute(selector, attribute, key) {
    const element = document.querySelector(selector);
    if (element) element.setAttribute(attribute, t(key));
}

function setMeta(selector, key) {
    setAttribute(selector, 'content', key);
}

function renderHomepageCopy() {
    if (normalizedPath() !== '/') return;

    document.title = t('homeV2.documentTitle');
    setMeta('meta[name="description"]', 'homeV2.metaDescription');
    setMeta('meta[property="og:title"]', 'homeV2.ogTitle');
    setMeta('meta[property="og:description"]', 'homeV2.ogDescription');
    setMeta('meta[name="twitter:title"]', 'homeV2.ogTitle');
    setMeta('meta[name="twitter:description"]', 'homeV2.ogDescription');

    setText('.home-v2-hero-copy > .eyebrow', 'homeV2.heroKicker');
    setHtml('.home-v2-hero-copy > h1', 'homeV2.heroTitle');
    setText('.home-v2-hero-copy > .home-v2-lead', 'homeV2.heroLead');
    setText('.home-v2-hero-copy .home-v2-actions > a:first-child', 'homeV2.startPlanning');
    setText('.home-v2-hero-copy .home-v2-actions > a:last-child', 'auth.login');
    setText('.home-v2-hero-copy > .hero-footnote', 'public.freeNote');

    setText('.home-v2-product-section:nth-of-type(1) .home-v2-product-copy > .eyebrow', 'homeV2.plannerKicker');
    setText('.home-v2-product-section:nth-of-type(1) .home-v2-product-seo-link', 'homeV2.plannerLink');
    setText('.home-v2-product-section:nth-of-type(2) .home-v2-product-copy > .eyebrow', 'homeV2.trackerKicker');
    setText('.home-v2-product-section:nth-of-type(2) .home-v2-product-seo-link', 'homeV2.trackerLink');
    setText('.home-v2-product-section:nth-of-type(3) .home-v2-product-seo-link', 'homeV2.familyLink');

    setText('.home-v2-tool-links > span', 'homeV2.toolsLabel');
    setText('.home-v2-tool-links > a:nth-of-type(1)', 'homeV2.toolPlanner');
    setText('.home-v2-tool-links > a:nth-of-type(2)', 'homeV2.toolTracker');
    setText('.home-v2-tool-links > a:nth-of-type(3)', 'homeV2.toolFamily');

    setText('.resource-page[aria-labelledby="home-resources-title"] .resource-kicker', 'homeV2.resourcesKicker');
    setText('#home-resources-title', 'homeV2.resourcesTitle');
    setText('.resource-page[aria-labelledby="home-resources-title"] .resource-article > p:not(.resource-kicker)', 'homeV2.resourcesIntro');
    setText('.resource-page[aria-labelledby="home-resources-title"] .resource-links > a:nth-child(1)', 'homeV2.resourcesMethod');
    setText('.resource-page[aria-labelledby="home-resources-title"] .resource-links > a:nth-child(2)', 'homeV2.resourcesGuides');
    setText('.resource-page[aria-labelledby="home-resources-title"] .resource-links > a:nth-child(3)', 'homeV2.resourcesChangelog');

    setAttribute('.home-v2-workflow-art img', 'alt', 'homeV2.workflowAlt');
    setAttribute('.home-v2-artwork-planner .home-v2-artwork-main', 'alt', 'homeV2.plannerMainAlt');
    setAttribute('.home-v2-artwork-planner .home-v2-artwork-inset', 'alt', 'homeV2.plannerInsetAlt');
    setAttribute('.home-v2-artwork-operation .home-v2-artwork-main', 'alt', 'homeV2.trackerMainAlt');
    setAttribute('.home-v2-artwork-operation .home-v2-artwork-inset', 'alt', 'homeV2.trackerInsetAlt');
    setAttribute('.home-v2-artwork-family .home-v2-artwork-main', 'alt', 'homeV2.familyMainAlt');
    setAttribute('.home-v2-artwork-family .home-v2-artwork-inset', 'alt', 'homeV2.familyInsetAlt');
}

export function initPublicPageBindings() {
    renderHomepageCopy();
    window.addEventListener('clashtools:language-changed', renderHomepageCopy);
}
