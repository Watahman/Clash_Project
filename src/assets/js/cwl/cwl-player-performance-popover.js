import { t } from '../i18n/i18n.js';
import {
    getPlayerPerformance,
    schedulePlayerPerformanceBatch
} from './player-performance-client.js';
import { renderCurrentCwlSection } from './cwl-player-performance-current.js';
import { getPlayerFitContext } from './cwl-player-fit-context.js';

const OPEN_DELAY_MS = 300;
const CLOSE_DELAY_MS = 140;
const VIEWPORT_GAP = 12;
let popover;
let activeCard;
let activeTrigger;
let openTimer;
let closeTimer;
let currentContextResolver = () => null;

export function initPlayerPerformancePopover({ getCurrentContext } = {}) {
    if (getCurrentContext) currentContextResolver = getCurrentContext;
    if (popover) return popover;
    popover = document.createElement('section');
    popover.className = 'cwl-performance-popover hidden';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', t('performance.title'));
    popover.tabIndex = -1;
    document.body.appendChild(popover);

    document.addEventListener('pointerover', onPointerOver);
    document.addEventListener('pointerout', onPointerOut);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('keydown', onKeyDown);
    popover.addEventListener('pointerenter', cancelClose);
    popover.addEventListener('pointerleave', scheduleClose);
    window.addEventListener('resize', closePopover);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('clashtools:cwl-player-drag-start', closePopover);
    window.addEventListener('clashtools:player-performance-updated', event => {
        if (activeCard && event.detail?.tags?.includes(activeCard.dataset.playerTag)) {
            rerenderActivePopover();
        }
    });
    window.addEventListener('clashtools:language-changed', rerenderActivePopover);
    return popover;
}

function triggerFromTarget(target) {
    const trigger = target?.closest?.(
        '[data-performance-trigger], .cwl-player-info, .cwl-player-townhall-foto'
    );
    const card = trigger?.closest?.(
        '[data-performance-card="true"], .cwl-player-article[data-planner-card="true"]'
    );
    return card ? { trigger, card } : null;
}

function onPointerOver(event) {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    const match = triggerFromTarget(event.target);
    const previous = triggerFromTarget(event.relatedTarget);
    if (!match || previous?.card === match.card) return;
    cancelClose();
    window.clearTimeout(openTimer);
    openTimer = window.setTimeout(
        () => openForCard(match.card, match.trigger),
        OPEN_DELAY_MS
    );
}

function onPointerOut(event) {
    const match = triggerFromTarget(event.target);
    if (!match) return;
    const next = triggerFromTarget(event.relatedTarget);
    if (next?.card === match.card || popover.contains(event.relatedTarget)) return;
    window.clearTimeout(openTimer);
    scheduleClose();
}

function onPointerUp(event) {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    const match = triggerFromTarget(event.target);
    if (match) openForCard(match.card, match.trigger, true);
}

function onFocusIn(event) {
    const match = triggerFromTarget(event.target);
    if (match) openForCard(match.card, match.trigger);
}

function onFocusOut(event) {
    if (popover.contains(event.relatedTarget)) return;
    const match = triggerFromTarget(event.target);
    if (match) scheduleClose();
}

function onKeyDown(event) {
    if (event.key === 'Escape') {
        closePopover();
        return;
    }
    if (!['Enter', ' '].includes(event.key)) return;
    const match = triggerFromTarget(event.target);
    if (!match) return;
    event.preventDefault();
    openForCard(match.card, match.trigger, true);
}

function openForCard(card, trigger, focus = false) {
    window.clearTimeout(openTimer);
    cancelClose();
    activeCard = card;
    activeTrigger = trigger;
    activeTrigger?.setAttribute('aria-expanded', 'true');
    popover.classList.remove('hidden');
    renderActiveCard();
    reposition();
    if (focus) popover.focus({ preventScroll: true });
}

function renderActiveCard() {
    if (!activeCard || !popover || popover.classList.contains('hidden')) return;
    const context = activeContext();
    if (context?.mode === 'historical') {
        renderHistoricalCwl(context);
        return;
    }
    const tag = activeCard.dataset.playerTag || '';
    const performance = getPlayerPerformance(tag);
    if (!performance) {
        schedulePlayerPerformanceBatch([tag]);
        renderLoading();
        return;
    }
    renderPerformance(performance);
}

function rerenderActivePopover() {
    renderActiveCard();
    reposition();
}

function renderLoading() {
    popover.replaceChildren(
        headerForActiveCard(),
        ...currentCwlNodes(),
        element('div', 'cwl-performance-loading', [
            element('span'), element('span'), element('span'), element('span')
        ])
    );
}

function renderPerformance(data) {
    const header = headerForActiveCard();
    const overview = performanceOverview(data);
    const plannerContext = plannerContextSection(data);
    if (data.status !== 'ready') {
        const empty = element('div', 'cwl-performance-empty');
        empty.append(
            element('strong', '', t('performance.notEnoughData')),
            element('p', '', t(
                data.status === 'unavailable'
                    ? 'performance.unavailable'
                    : 'performance.needsMoreAttacks'
            ))
        );
        popover.replaceChildren(
            header, overview, ...(plannerContext ? [plannerContext] : []),
            ...currentCwlNodes(), empty
        );
        return;
    }

    const stats = metrics([
        [t('performance.avgStars'), stars(data.avgStars)],
        [t('performance.avgDestruction'), percent(data.avgDestruction)],
        [t('performance.tripleRate'), percent(data.tripleRate)],
        [t('performance.twoStarRate'), percent(data.twoStarRate)],
        [t('performance.lowStarRate'), percent(data.lowStarRate)]
    ]);
    const matchups = section(t('performance.matchups'), metrics([
        [t('performance.sameTh'), String(data.sameThCount)],
        [t('performance.upHit'), String(data.upHitCount)],
        [t('performance.downHit'), String(data.downHitCount)]
    ]));
    popover.replaceChildren(
        header, overview, ...(plannerContext ? [plannerContext] : []),
        ...currentCwlNodes(), stats, matchups
    );
}

function performanceOverview(data) {
    const overview = element('section', 'cwl-performance-overview');
    const score = element('div', 'cwl-performance-score');
    score.append(
        element('span', 'cwl-performance-label', t('performance.warPerformance')),
        element('strong', '', number(boundedPerformance(data.performance), 0)),
        element('span', 'cwl-performance-scale', '/100'),
        element('em', '', data.scope === 'CWL' ? t('performance.cwl') : t('performance.allWars'))
    );
    const reliability = data.reliability == null
        ? t('performance.insufficientParticipation')
        : percent(data.reliability);
    const coverage = t('performance.coverage', {
        attacks: data.coverage?.attacks ?? data.attackCount ?? 0,
        days: data.coverage?.days ?? 0
    });
    const form = element('div', 'cwl-performance-form');
    form.append(
        element('span', '', t('performance.form')),
        element('strong', `is-${data.form?.trend || 'unknown'}`, formText(data.form))
    );
    overview.append(score, form, metrics([
        [t('performance.reliability'), reliability],
        [t('performance.confidenceLabel'), t(`performance.confidence${data.confidence || 'Low'}`)],
        [t('performance.attackCoverage'), coverage]
    ]));
    return overview;
}

function plannerContextSection(data) {
    const context = getPlayerFitContext(activeCard, data);
    if (!context) return null;
    const wrapper = section(t('performance.plannerContext'), metrics(
        context.fits.map(item => [item.clanName, number(item.fit, 1)])
    ));
    wrapper.classList.add('cwl-performance-planner-context');
    wrapper.insertBefore(element(
        'p', 'cwl-performance-context-label',
        t(context.mode === 'assigned'
            ? 'performance.currentClanFit'
            : 'performance.bestClanFits')
    ), wrapper.querySelector('dl'));
    return wrapper;
}

function renderHistoricalCwl(context) {
    const current = renderCurrentCwlSection(context);
    popover.replaceChildren(
        headerForActiveCard(),
        ...(current ? [current] : [])
    );
}

function activeContext() {
    return currentContextResolver(activeCard?.dataset.playerTag || '');
}

function currentCwlNodes(context = activeContext()) {
    const current = renderCurrentCwlSection(context);
    return current ? [current] : [];
}

function headerForActiveCard() {
    const header = element('header', 'cwl-performance-header');
    const name = activeCard.querySelector('.cwl-player-name')?.textContent || '';
    const tag = activeCard.dataset.playerTag || '';
    header.append(
        element('strong', '', `${name} · TH${activeCard.dataset.townHall || '—'}`),
        element('span', '', tag)
    );
    return header;
}

function metrics(rows) {
    const list = element('dl', 'cwl-performance-metrics');
    rows.forEach(([label, value]) => {
        list.append(element('dt', '', label), element('dd', '', value));
    });
    return list;
}

function section(title, content) {
    const wrapper = element('div', 'cwl-performance-section');
    wrapper.append(element('h3', '', title), content);
    return wrapper;
}

function formText(form) {
    if (form?.delta == null) return t('performance.notEnoughData');
    const sign = form.delta > 0 ? '+' : '';
    const icon = form.trend === 'strong' ? '↑' : form.trend === 'declining' ? '↓' : '→';
    return `${icon} ${sign}${number(form.delta, 0)} · ${t(`performance.form${capitalize(form.trend)}`)}`;
}

function element(tag, className = '', content = null) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (Array.isArray(content)) node.append(...content);
    else if (content != null) node.textContent = content;
    return node;
}

function reposition() {
    if (!activeTrigger || popover?.classList.contains('hidden')) return;
    const anchor = activeTrigger.getBoundingClientRect();
    const popup = popover.getBoundingClientRect();
    const right = anchor.right + VIEWPORT_GAP;
    const left = anchor.left - popup.width - VIEWPORT_GAP;
    const x = right + popup.width <= window.innerWidth - VIEWPORT_GAP
        ? right
        : Math.max(VIEWPORT_GAP, left);
    const y = Math.min(
        Math.max(VIEWPORT_GAP, anchor.top),
        window.innerHeight - popup.height - VIEWPORT_GAP
    );
    popover.style.left = `${x}px`;
    popover.style.top = `${Math.max(VIEWPORT_GAP, y)}px`;
}

function scheduleClose() {
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(closePopover, CLOSE_DELAY_MS);
}

function cancelClose() {
    window.clearTimeout(closeTimer);
}

function closePopover() {
    window.clearTimeout(openTimer);
    cancelClose();
    activeTrigger?.setAttribute('aria-expanded', 'false');
    activeCard = null;
    activeTrigger = null;
    popover?.classList.add('hidden');
}

function number(value, places = 1) {
    return Number.isFinite(Number(value)) ? Number(value).toFixed(places) : '—';
}

function boundedPerformance(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : value;
}

function percent(value) {
    return value == null ? '—' : `${number(value, 1)}%`;
}

function stars(value) {
    return value == null ? '—' : `${number(value, 2)}★`;
}

function capitalize(value = '') {
    return value ? value[0].toUpperCase() + value.slice(1) : 'Stable';
}
