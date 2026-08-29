import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';

function normalizedPath() {
    return String(window.location.pathname || '/')
        .replace(/\/index\.html$/i, '/')
        .replace(/\/$/, '') || '/';
}

function setText(selector, key) {
    const element = document.querySelector(selector);
    if (element) element.textContent = t(key);
}

function setAttribute(selector, attribute, key) {
    const element = document.querySelector(selector);
    if (element) element.setAttribute(attribute, t(key));
}

function setMeta(selector, key) {
    setAttribute(selector, 'content', key);
}

function setPageMetadata(prefix) {
    document.title = t(`${prefix}.documentTitle`);
    setMeta('meta[name="description"]', `${prefix}.metaDescription`);
    setMeta('meta[property="og:title"]', `${prefix}.documentTitle`);
    setMeta('meta[property="og:description"]', `${prefix}.metaDescription`);
    setMeta('meta[name="twitter:title"]', `${prefix}.documentTitle`);
    setMeta('meta[name="twitter:description"]', `${prefix}.metaDescription`);
}

function setSimpleMetadata(titleKey, descriptionKey) {
    document.title = t(titleKey);
    setMeta('meta[name="description"]', descriptionKey);
}

function replaceResourceArticle(sectionSelector, key) {
    const article = document.querySelector(`${sectionSelector} > .resource-article`);
    if (article) article.innerHTML = t(key);
}

function renderHomepageCopy() {
    document.title = t('homeV3.documentTitle');
    setMeta('meta[name="description"]', 'homeV3.metaDescription');
    setMeta('meta[property="og:title"]', 'homeV3.documentTitle');
    setMeta('meta[property="og:description"]', 'homeV3.metaDescription');
    setMeta('meta[name="twitter:title"]', 'homeV3.documentTitle');
    setMeta('meta[name="twitter:description"]', 'homeV3.metaDescription');
}

function renderAboutCopy() {
    setPageMetadata('feature.about');
    replaceResourceArticle('.resource-page[aria-labelledby="trust-title"]', 'feature.about.trustHtml');
    setAttribute('.feature-v2-workflow .home-v2-workflow-art img', 'alt', 'feature.about.workflowAlt');
    setAttribute('.home-v2-products .home-v2-product-section:nth-child(1) .home-v2-artwork-main', 'alt', 'aboutPage.problem.imageAltMain');
    setAttribute('.home-v2-products .home-v2-product-section:nth-child(1) .home-v2-artwork-inset', 'alt', 'aboutPage.problem.imageAltInset');
    setAttribute('.home-v2-products .home-v2-product-section:nth-child(2) .home-v2-artwork-main', 'alt', 'aboutPage.independent.imageAltMain');
    setAttribute('.home-v2-products .home-v2-product-section:nth-child(2) .home-v2-artwork-inset', 'alt', 'aboutPage.independent.imageAltInset');
}

function renderPlannerCopy() {
    setPageMetadata('feature.planner');
    replaceResourceArticle('.resource-page[aria-labelledby="planner-sample-title"]', 'feature.planner.sampleHtml');
    setAttribute('.feature-v2-workflow .home-v2-workflow-art img', 'alt', 'feature.planner.workflowAlt');
    setAttribute('.home-v2-products .home-v2-product-section:nth-child(1) .home-v2-artwork-main', 'alt', 'planner.week.imageAltMain');
    setAttribute('.home-v2-products .home-v2-product-section:nth-child(1) .home-v2-artwork-inset', 'alt', 'planner.week.imageAltInset');
    setAttribute('.home-v2-products .home-v2-product-section:nth-child(2) .home-v2-artwork-main', 'alt', 'planner.control.imageAltMain');
    setAttribute('.home-v2-products .home-v2-product-section:nth-child(2) .home-v2-artwork-inset', 'alt', 'planner.control.imageAltInset');
}

function renderTrackerCopy() {
    setPageMetadata('feature.tracker');
    replaceResourceArticle('.resource-page[aria-labelledby="tracker-sample-title"]', 'feature.tracker.sampleHtml');
    setAttribute('.feature-v2-workflow .home-v2-workflow-art img', 'alt', 'feature.tracker.workflowAlt');
    setAttribute('.home-v2-products .home-v2-product-section:nth-child(1) .home-v2-artwork-main', 'alt', 'tracker.live.imageAltMain');
    setAttribute('.home-v2-products .home-v2-product-section:nth-child(1) .home-v2-artwork-inset', 'alt', 'tracker.live.imageAltInset');
    setAttribute('.home-v2-products .home-v2-product-section:nth-child(2) .home-v2-artwork-main', 'alt', 'tracker.history.imageAltMain');
    setAttribute('.home-v2-products .home-v2-product-section:nth-child(2) .home-v2-artwork-inset', 'alt', 'tracker.history.imageAltInset');
}

function renderFamilyCopy() {
    setPageMetadata('feature.family');
    replaceResourceArticle('.resource-page[aria-labelledby="family-sample-title"]', 'feature.family.sampleHtml');
    setAttribute('.feature-v2-workflow .home-v2-workflow-art img', 'alt', 'feature.family.workflowAlt');
    setAttribute('.home-v2-products .home-v2-product-section:nth-child(1) .home-v2-artwork-main', 'alt', 'family.network.imageAltMain');
    setAttribute('.home-v2-products .home-v2-product-section:nth-child(1) .home-v2-artwork-inset', 'alt', 'family.network.imageAltInset');
    setAttribute('.home-v2-products .home-v2-product-section:nth-child(2) .home-v2-artwork-main', 'alt', 'family.people.imageAltMain');
    setAttribute('.home-v2-products .home-v2-product-section:nth-child(2) .home-v2-artwork-inset', 'alt', 'family.people.imageAltInset');
}

function renderBracketCopy() {
    setPageMetadata('feature.bracket');
    setAttribute('.feature-v2-workflow .home-v2-workflow-art img', 'alt', 'feature.bracket.workflowAlt');
    setAttribute('.home-v2-products .home-v2-product-section:nth-child(1) .home-v2-artwork-main', 'alt', 'bracket.matchups.imageAltMain');
    setAttribute('.home-v2-products .home-v2-product-section:nth-child(1) .home-v2-artwork-inset', 'alt', 'bracket.matchups.imageAltInset');
    setAttribute('.home-v2-products .home-v2-product-section:nth-child(2) .home-v2-artwork-main', 'alt', 'bracket.winner.imageAltMain');
    setAttribute('.home-v2-products .home-v2-product-section:nth-child(2) .home-v2-artwork-inset', 'alt', 'bracket.winner.imageAltInset');
}

function renderCurrentPageCopy() {
    switch (normalizedPath()) {
        case '/':
            renderHomepageCopy();
            break;
        case '/about':
            renderAboutCopy();
            break;
        case '/cwl-planner':
            renderPlannerCopy();
            break;
        case '/cwl-tracker':
            renderTrackerCopy();
            break;
        case '/clan-management':
            renderFamilyCopy();
            break;
        case '/bracket-generator':
            renderBracketCopy();
            break;
        case '/subpages/login':
        case '/subpages/login.html':
            setSimpleMetadata('authPage.loginTitle', 'authPage.loginDescription');
            break;
        case '/subpages/register':
        case '/subpages/register.html':
            setSimpleMetadata('authPage.registerTitle', 'authPage.registerDescription');
            break;
        default:
            break;
    }
}

export function initPublicPageBindings() {
    renderCurrentPageCopy();
    window.addEventListener('clashtools:language-changed', renderCurrentPageCopy);
}
