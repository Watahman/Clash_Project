import { t } from '../i18n/i18n.js';
import { renderGuideDetailPage, rewriteGuideArticleLinks } from './guide-detail-renderer.js';

function normalizedPath() {
    return String(window.location.pathname || '/')
        .replace(/\/index\.html$/i, '/')
        .replace(/\/$/, '') || '/';
}

function setMeta(selector, value) {
    const element = document.querySelector(selector);
    if (element && value) element.setAttribute('content', value);
}

function setDocumentCopy(prefix) {
    const title = t(`${prefix}.documentTitle`);
    const description = t(`${prefix}.metaDescription`);
    document.title = title;
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);
}

function restoreHashPosition() {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
}

function changelogBadges(main) {
    const moduleKeys = {
        'august-14': ['changelog.badgeUi', 'changelog.badgeFix'],
        'august-12': ['changelog.badgeCwl', 'changelog.badgeStats', 'changelog.badgeUi'],
        'august-11': ['changelog.badgeCwl', 'changelog.badgeUi'],
        'august-6': ['changelog.badgeUi', 'changelog.badgeFix'],
        'august-4': ['public.nav.guides', 'public.nav.methodology', 'public.nav.about'],
        'august-3': ['public.nav.guides'],
        'august-2': ['nav.operation', 'nav.cwl'],
        'august-1': ['nav.cwl', 'nav.groups']
    };
    Object.entries(moduleKeys).forEach(([id, keys]) => {
        const article = main.querySelector(`#${id}`);
        const title = article?.querySelector('h2');
        if (!title || article.querySelector('.changelog-module-badges')) return;
        const badges = document.createElement('div');
        badges.className = 'changelog-module-badges';
        badges.setAttribute('aria-label', t('changelog.modulesLabel'));
        keys.forEach(key => {
            const badge = document.createElement('span');
            badge.textContent = t(key);
            badges.append(badge);
        });
        title.after(badges);
    });
}

function renderGuideLibrary() {
    return `
        <section class="guide-library" aria-labelledby="guide-library-title">
            <div class="guide-library-head"><p class="resource-kicker">Guide library</p><h2 id="guide-library-title">Start with the decision in front of you.</h2><p>${t('guides.heroIntro')}</p></div>
            <a class="guide-featured" href="/guides/fair-cwl-roster"><div><p class="resource-kicker">Featured guide</p><h3>${t('guides.tocFair')}</h3><p>${t('guides.heroMeta')}</p></div></a>
            <div class="guide-category-grid">
                <a class="guide-category-card" href="/guides/fair-cwl-roster"><span class="guide-category-label">Planning</span><strong>${t('guides.tocFair')}</strong><span class="guide-mini-flow" aria-hidden="true"><span>Pool</span><i>→</i><span>Rules</span><i>→</i><span>Roster</span></span></a>
                <a class="guide-category-card" href="/guides/cwl-rotation"><span class="guide-category-label">Planning</span><strong>${t('guides.tocRotation')}</strong><span class="guide-mini-flow" aria-hidden="true"><span>Core</span><i>→</i><span>Rotate</span><i>→</i><span>Review</span></span></a>
                <a class="guide-category-card" href="/guides/cwl-availability"><span class="guide-category-label">Availability</span><strong>${t('guides.tocAvailability')}</strong><span class="guide-mini-flow" aria-hidden="true"><span>Known</span><i>→</i><span>Change</span><i>→</i><span>Cover</span></span></a>
                <a class="guide-category-card" href="/guides/missed-attacks"><span class="guide-category-label">Availability</span><strong>${t('guides.tocMissed')}</strong><span class="guide-mini-flow" aria-hidden="true"><span>Check</span><i>→</i><span>Context</span><i>→</i><span>Act</span></span></a>
                <a class="guide-category-card" href="/guides/cwl-attack-defense"><span class="guide-category-label">Review</span><strong>${t('guides.tocTwoSided')}</strong><span class="guide-mini-flow" aria-hidden="true"><span>Attack</span><i>→</i><span>Defence</span><i>→</i><span>Context</span></span></a>
                <a class="guide-category-card" href="/guides/cwl-season-history"><span class="guide-category-label">Review</span><strong>${t('guides.tocSeasons')}</strong><span class="guide-mini-flow" aria-hidden="true"><span>Seasons</span><i>→</i><span>Compare</span><i>→</i><span>Context</span></span></a>
                <a class="guide-category-card" href="/guides/cwl-bonus-medals"><span class="guide-category-label">Workflow</span><strong>${t('guides.tocBonus')}</strong><span class="guide-mini-flow" aria-hidden="true"><span>Rules</span><i>→</i><span>Signals</span><i>→</i><span>Explain</span></span></a>
                <a class="guide-category-card" href="/guides/spreadsheet-vs-cwl-planner"><span class="guide-category-label">Workflow</span><strong>${t('guides.tocSpreadsheet')}</strong><span class="guide-mini-flow" aria-hidden="true"><span>Sheet</span><i>→</i><span>Import</span><i>→</i><span>Review</span></span></a>
            </div>
        </section>`;
}

function renderAutoPlanFlow() {
    return `<figure class="methodology-flow" aria-labelledby="auto-plan-flow-title"><figcaption id="auto-plan-flow-title">Auto Plan decision flow</figcaption><ol><li><span class="methodology-flow-step">1</span><strong>Inputs</strong><small>Clans, roles and availability</small></li><li><span class="methodology-flow-step">2</span><strong>Guardrails</strong><small>Locks, league and roster size</small></li><li><span class="methodology-flow-step">3</span><strong>Assignment</strong><small>Core, Rotation, then Reserve</small></li><li><span class="methodology-flow-step">4</span><strong>Review</strong><small>Warnings before applying</small></li></ol><p class="methodology-flow-note">The output is a reversible starting point. A leader reviews every proposed assignment against current information.</p></figure>`;
}

function removeIllustrativeGuideExamples(main) {
    main.querySelectorAll('.sample-panel, .resource-article .resource-note').forEach(element => element.remove());
    const markers = /\b(sample|example|voorbeeld|beispiel|ejemplo|exemple)\b/i;
    main.querySelectorAll('.resource-article > p').forEach(paragraph => {
        const label = paragraph.querySelector(':scope > strong')?.textContent || '';
        if (markers.test(label)) paragraph.remove();
    });
}

function renderConfidenceFlow() {
    return `<figure class="methodology-flow" aria-labelledby="confidence-flow-title"><figcaption id="confidence-flow-title">Confidence and fallback paths</figcaption><div class="methodology-branch-grid"><div class="methodology-branch"><strong>Known history → measured signals → confidence shown</strong><p>Performance, reliability and matchup context can contribute when the provider supplies usable history.</p></div><div class="methodology-branch" data-state="missing"><strong>Missing history → Town Hall fallback → confidence penalty</strong><p>Ordering can continue, but the fallback is not presented as measured player history.</p></div></div></figure>`;
}

function renderMissingDataFlow() {
    return `<figure class="methodology-flow" aria-labelledby="missing-data-flow-title"><figcaption id="missing-data-flow-title">When required data is missing</figcaption><ol><li><span class="methodology-flow-step">1</span><strong>Source check</strong><small>Provider or war detail is incomplete</small></li><li><span class="methodology-flow-step">2</span><strong>Mark unknown</strong><small>No fabricated zero or result</small></li><li><span class="methodology-flow-step">3</span><strong>Leader review</strong><small>Confirm before acting on the signal</small></li><li><span class="methodology-flow-step">4</span><strong>Safe next step</strong><small>Wait, correct or use a labelled fallback</small></li></ol></figure>`;
}

function renderGuides(main) {
    setDocumentCopy('guides');
    main.innerHTML = `
        <header class="resource-hero">
            <p class="resource-kicker">${t('guides.heroKicker')}</p>
            <h1>${t('guides.heroTitle')}</h1>
            <p>${t('guides.heroIntro')}</p>
            <p class="resource-meta">${t('guides.heroMeta')}</p>
            <nav class="resource-categories" aria-label="Guide categories">
                <a href="#fair-roster">${t('nav.cwl')}</a>
                <a href="#availability">${t('nav.groups')}</a>
                <a href="#seasons">${t('nav.operation')}</a>
                <a href="/methodology">${t('public.nav.methodology')}</a>
            </nav>
        </header>
        ${renderGuideLibrary()}
        <div class="resource-layout">
            <nav class="resource-toc" aria-label="${t('guides.tocLabel')}">
                <strong>${t('guides.tocTitle')}</strong>
                <a href="/guides/fair-cwl-roster#fair-roster">${t('guides.tocFair')}</a>
                <a href="/guides/cwl-rotation#rotation">${t('guides.tocRotation')}</a>
                <a href="/guides/cwl-availability#availability">${t('guides.tocAvailability')}</a>
                <a href="/guides/cwl-attack-defense#two-sided">${t('guides.tocTwoSided')}</a>
                <a href="/guides/missed-attacks#missed-guide">${t('guides.tocMissed')}</a>
                <a href="/guides/cwl-bonus-medals#bonus-guide">${t('guides.tocBonus')}</a>
                <a href="/guides/cwl-season-history#seasons">${t('guides.tocSeasons')}</a>
                <a href="/guides/spreadsheet-vs-cwl-planner#spreadsheet">${t('guides.tocSpreadsheet')}</a>
            </nav>
            <div class="resource-content">
                ${t('guides.article1Html')}
                ${t('guides.article2Html')}
                ${t('guides.article3Html')}
                ${t('guides.article4Html')}
                ${t('guides.article5Html')}
                ${t('guides.article6Html')}
                ${t('guides.article7Html')}
                ${t('guides.article8Html')}
            </div>
        </div>`;
    rewriteGuideArticleLinks(main);
    removeIllustrativeGuideExamples(main);
}

function renderChangelog(main) {
    setDocumentCopy('changelog');
    main.innerHTML = `
        <header class="resource-hero">
            <p class="resource-kicker">${t('changelog.heroKicker')}</p>
            <h1>${t('changelog.heroTitle')}</h1>
            <p>${t('changelog.heroIntro')}</p>
            <p class="resource-meta">${t('changelog.heroMeta')}</p>
        </header>
        <div class="resource-layout">
            <nav class="resource-toc" aria-label="${t('changelog.tocLabel')}">
                <strong>${t('changelog.tocTitle')}</strong>
                <a href="#august-14">${t('changelog.aug14')}</a>
                <a href="#august-12">${t('changelog.aug12')}</a>
                <a href="#august-11">${t('changelog.aug11')}</a>
                <a href="#august-6">${t('changelog.aug6')}</a>
                <a href="#august-4">${t('changelog.aug4')}</a>
                <a href="#august-3">${t('changelog.aug3')}</a>
                <a href="#august-2">${t('changelog.aug2')}</a>
                <a href="#august-1">${t('changelog.aug1')}</a>
            </nav>
            <div class="resource-content changelog-timeline">
                ${t('changelog.article14Html')}
                ${t('changelog.article12Html')}
                ${t('changelog.article11Html')}
                ${t('changelog.article6Html')}
                ${t('changelog.article4Html')}
                ${t('changelog.article3Html')}
                ${t('changelog.article2Html')}
                ${t('changelog.article1Html')}
            </div>
        </div>`;
    changelogBadges(main);
}

function renderMethodology(main) {
    setDocumentCopy('methodology');
    main.innerHTML = `
        <header class="resource-hero">
            <p class="resource-kicker">${t('methodology.kicker')}</p>
            <h1>${t('methodology.title')}</h1>
            <p>${t('methodology.intro')}</p>
            <p class="resource-meta">${t('methodology.meta')}</p>
        </header>
        <div class="resource-layout">
            <nav class="resource-toc" aria-label="${t('methodology.sectionsLabel')}">
                <strong>${t('methodology.onThisPage')}</strong>
                <a href="#auto-plan">${t('methodology.autoPlan')}</a>
                <a href="#optimise">${t('methodology.optimise')}</a>
                <a href="#performance">${t('methodology.performance')}</a>
                <a href="#attack-defense">${t('methodology.attackDefense')}</a>
                <a href="#history">${t('methodology.history')}</a>
                <a href="#missed">${t('methodology.missed')}</a>
                <a href="#bonus">${t('methodology.bonus')}</a>
                <a href="#limitations">${t('methodology.limitations')}</a>
            </nav>
            <div class="resource-content">
                <article class="resource-article" id="auto-plan">
                    <p class="resource-kicker">${t('methodology.autoKicker')}</p>
                    <h2>${t('methodology.autoTitle')}</h2>
                    <p><strong>${t('methodology.problem')}</strong> ${t('methodology.autoProblem')}</p>
                    <h3>${t('methodology.inputsRules')}</h3>
                    <ul><li>${t('methodology.autoRule1')}</li><li>${t('methodology.autoRule2')}</li><li>${t('methodology.autoRule3')}</li><li>${t('methodology.autoRule4')}</li></ul>
                    ${renderAutoPlanFlow()}
                    <h3>${t('methodology.outputMeaning')}</h3>
                    <p>${t('methodology.autoOutput')}</p>
                    <h3>${t('methodology.limitsOverrides')}</h3><p>${t('methodology.autoLimits')}</p>
                </article>
                <article class="resource-article" id="optimise">
                    <p class="resource-kicker">${t('methodology.optimiseKicker')}</p><h2>${t('methodology.optimiseTitle')}</h2>
                    <p><strong>${t('methodology.problem')}</strong> ${t('methodology.optimiseProblem')}</p>
                    <p>${t('methodology.optimiseProcess')}</p><p>${t('methodology.optimiseReview')}</p>
                </article>
                <article class="resource-article" id="performance">
                    <p class="resource-kicker">${t('methodology.performanceKicker')}</p><h2>${t('methodology.performanceTitle')}</h2>
                    <p><strong>${t('methodology.problem')}</strong> ${t('methodology.performanceProblem')}</p>
                    <p>${t('methodology.performanceSignals')}</p><p>${t('methodology.performanceUnavailable')}</p>
                    ${renderConfidenceFlow()}
                </article>
                <article class="resource-article" id="attack-defense">
                    <p class="resource-kicker">${t('methodology.attackKicker')}</p><h2>${t('methodology.attackTitle')}</h2>
                    <p><strong>${t('methodology.problem')}</strong> ${t('methodology.attackProblem')}</p>
                    <p>${t('methodology.attackMethod')}</p><p>${t('methodology.attackLimits')}</p>
                </article>
                <article class="resource-article" id="history">
                    <p class="resource-kicker">${t('methodology.historyKicker')}</p><h2>${t('methodology.historyTitle')}</h2>
                    <p><strong>${t('methodology.problem')}</strong> ${t('methodology.historyProblem')}</p><p>${t('methodology.historyMethod')}</p><p>${t('methodology.historyLimits')}</p>
                </article>
                <article class="resource-article" id="missed">
                    <p class="resource-kicker">${t('methodology.missedKicker')}</p><h2>${t('methodology.missedTitle')}</h2>
                    <p><strong>${t('methodology.problem')}</strong> ${t('methodology.missedProblem')}</p><p>${t('methodology.missedMethod')}</p><p>${t('methodology.missedLimits')}</p>
                </article>
                <article class="resource-article" id="bonus">
                    <p class="resource-kicker">${t('methodology.bonusKicker')}</p><h2>${t('methodology.bonusTitle')}</h2>
                    <p><strong>${t('methodology.problem')}</strong> ${t('methodology.bonusProblem')}</p><p>${t('methodology.bonusMethod')}</p><p>${t('methodology.bonusLimits')}</p>
                </article>
                <article class="resource-article" id="limitations">
                    <p class="resource-kicker">${t('methodology.limitKicker')}</p><h2>${t('methodology.limitTitle')}</h2>
                    <ul><li>${t('methodology.limit1')}</li><li>${t('methodology.limit2')}</li><li>${t('methodology.limit3')}</li><li>${t('methodology.limit5')}</li></ul>
                    ${renderMissingDataFlow()}
                    <div class="resource-links"><a class="button button-secondary" href="/guides">${t('methodology.guides')}</a><a class="button button-secondary" href="/cwl-planner">${t('methodology.plannerOverview')}</a><a class="button button-secondary" href="/cwl-tracker">${t('methodology.trackerOverview')}</a></div>
                </article>
            </div>
        </div>`;
}

function renderCurrentResourcePage() {
    const main = document.querySelector('main.resource-page');
    if (!main) return;

    const path = normalizedPath();
    if (renderGuideDetailPage(main, path)) {
        restoreHashPosition();
        return;
    }

    switch (path) {
        case '/guides':
            renderGuides(main);
            break;
        case '/methodology':
            renderMethodology(main);
            break;
        case '/changelog':
            renderChangelog(main);
            break;
        default:
            return;
    }
    restoreHashPosition();
}

export function initPublicResourcePages() {
    renderCurrentResourcePage();
    window.addEventListener('clashtools:language-changed', renderCurrentResourcePage);
}
