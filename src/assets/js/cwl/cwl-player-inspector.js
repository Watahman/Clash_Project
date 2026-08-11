import { getPlayerAvailability } from './cwl-availability.js';
import { normalizePlannedDays } from './cwl-plan-schema.js';
import { getCardTag } from './cwl-utils.js';
import {
    rememberPlannerPlayers,
    updateAllPlayerCounters
} from './cwl-planner-card-state.js';
import { syncPlayerPlannedDays } from './cwl-player-controls.js';
import { savePlan } from './cwl-plan-io.js';
import { getPlayerPerformance } from './player-performance-client.js';
import { t } from '../i18n/i18n.js';

const CARD_CONTROL_SELECTOR = 'button, select, input, textarea, a';

export function initPlayerInspector({ root = document } = {}) {
    const drawer = root.querySelector('#cwl-player-inspector');
    const body = root.querySelector('#cwl-player-inspector-body');
    const backdrop = root.querySelector('#cwl-player-inspector-backdrop');
    const closeButton = root.querySelector('#cwl-player-inspector-close');
    if (!drawer || !body) return { open: () => {}, close: () => {} };

    let activeCard = null;
    let lastFocused = null;

    const close = () => {
        if (!activeCard) return;
        activeCard.setAttribute('aria-expanded', 'false');
        activeCard = null;
        drawer.classList.add('hidden');
        drawer.setAttribute('aria-hidden', 'true');
        backdrop?.classList.add('hidden');
        document.body.classList.remove('cwl-inspector-open');
        if (lastFocused?.isConnected) lastFocused.focus({ preventScroll: true });
        lastFocused = null;
    };

    const open = card => {
        if (!card?.matches('.cwl-player-article[data-planner-card="true"]')) return;
        activeCard?.setAttribute('aria-expanded', 'false');
        activeCard = card;
        lastFocused = document.activeElement;
        card.setAttribute('aria-expanded', 'true');
        drawer.classList.remove('hidden');
        drawer.setAttribute('aria-hidden', 'false');
        backdrop?.classList.remove('hidden');
        document.body.classList.add('cwl-inspector-open');
        renderInspector(body, card, { onClose: close });
        closeButton?.focus({ preventScroll: true });
    };

    root.addEventListener('click', event => {
        const card = event.target.closest('.cwl-player-article[data-planner-card="true"]');
        if (!card || event.target.closest(CARD_CONTROL_SELECTOR)) return;
        open(card);
    });
    root.addEventListener('keydown', event => {
        if (!['Enter', ' '].includes(event.key)) return;
        const trigger = event.target.closest('.cwl-player-info');
        const card = trigger?.closest('.cwl-player-article[data-planner-card="true"]');
        if (!card) return;
        event.preventDefault();
        open(card);
    });
    closeButton?.addEventListener('click', close);
    backdrop?.addEventListener('click', close);
    document.addEventListener('keydown', event => {
        if (drawer.classList.contains('hidden')) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
            return;
        }
        if (event.key === 'Tab') trapFocus(event, drawer);
    });
    window.addEventListener('clashtools:player-performance-updated', () => {
        if (activeCard?.isConnected) renderInspector(body, activeCard, { onClose: close });
    });
    window.addEventListener('clashtools:language-changed', () => {
        if (activeCard?.isConnected) renderInspector(body, activeCard, { onClose: close });
    });
    window.addEventListener('clashtools:cwl-plan-loaded', close);

    return { open, close, getActive: () => activeCard };
}

function renderInspector(container, card) {
    const player = readPlayer(card);
    const header = document.createElement('header');
    header.className = 'cwl-inspector-player-header';
    const title = document.createElement('div');
    const name = document.createElement('h3');
    name.textContent = player.name;
    const tag = document.createElement('p');
    tag.textContent = player.tag;
    title.append(name, tag);
    const townHall = document.createElement('img');
    townHall.src = card.querySelector('.cwl-player-townhall-foto')?.src || '';
    townHall.alt = `${t('cwl.sortTownhall')} ${player.townHall}`;
    townHall.className = 'cwl-inspector-townhall';
    header.append(title, townHall);

    const facts = document.createElement('dl');
    facts.className = 'cwl-inspector-facts';
    appendFact(facts, t('cwl.sortTownhall'), `TH${player.townHall}`);
    appendFact(facts, t('op.clan'), player.clan);
    appendFact(facts, t('planner.source'), sourceLabel(card.dataset.source));
    appendFact(facts, t('cwl.pollResults'), availabilityLabel(card));
    appendFact(facts, t('cwl.rosterStatus'), rosterLabel(card));

    const actions = document.createElement('div');
    actions.className = 'cwl-inspector-actions';
    actions.append(createMoveControl(card), createRoleControl(card));

    const schedule = createScheduleControls(card);
    const performance = createPerformanceSection(card);
    container.replaceChildren(header, facts, actions, schedule, performance);
}

function createMoveControl(card) {
    const wrapper = labeledControl(t('cwl.movePlayer'));
    const source = card.querySelector('.cwl-move-player');
    const select = document.createElement('select');
    select.setAttribute('aria-label', t('cwl.movePlayer'));
    if (source) Array.from(source.options).forEach(option => select.appendChild(option.cloneNode(true)));
    select.value = source?.value || card.closest('.cwl-clan-article')?.id || 'free';
    select.addEventListener('change', () => {
        if (!source) return;
        source.value = select.value;
        source.dispatchEvent(new Event('change', { bubbles: true }));
    });
    wrapper.appendChild(select);
    return wrapper;
}

function createRoleControl(card) {
    const wrapper = labeledControl(t('cwl.rosterStatus'));
    const source = card.querySelector('.cwl-roster-status');
    if (!source) {
        const message = document.createElement('p');
        message.className = 'cwl-inspector-muted';
        message.textContent = t('cwl.movePlayer');
        wrapper.appendChild(message);
        return wrapper;
    }
    const select = source.cloneNode(true);
    select.value = source.value;
    select.addEventListener('change', () => {
        source.value = select.value;
        source.dispatchEvent(new Event('change', { bubbles: true }));
    });
    wrapper.appendChild(select);
    return wrapper;
}

function createScheduleControls(card) {
    const wrapper = document.createElement('fieldset');
    wrapper.className = 'cwl-inspector-schedule';
    const legend = document.createElement('legend');
    legend.textContent = t('autoPlan.plannedDays', { days: '' }).replace(/: $/, '');
    wrapper.appendChild(legend);
    if (!card.closest('.cwl-clan-article')) {
        const note = document.createElement('p');
        note.className = 'cwl-inspector-muted';
        note.textContent = t('cwl.movePlayer');
        wrapper.appendChild(note);
        return wrapper;
    }

    const availability = getPlayerAvailability(getCardTag(card));
    const days = normalizePlannedDays(card.dataset.plannedDays);
    const choices = document.createElement('div');
    choices.className = 'cwl-day-choice-grid';
    for (let day = 1; day <= 7; day += 1) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = String(day);
        input.checked = days.includes(day);
        input.disabled = availability.state === 'no'
            || (availability.state === 'partial' && !availability.availableDays.includes(day));
        input.addEventListener('change', () => {
            const next = normalizePlannedDays(card.dataset.plannedDays);
            const index = next.indexOf(day);
            if (input.checked && index === -1) next.push(day);
            if (!input.checked && index !== -1) next.splice(index, 1);
            syncPlayerPlannedDays(card, next);
            updateAllPlayerCounters();
            rememberPlannerPlayers();
            window.dispatchEvent(new CustomEvent('clashtools:cwl-planner-schedule-changed', {
                detail: { tag: getCardTag(card), day }
            }));
            savePlan();
        });
        const text = document.createElement('span');
        text.textContent = t('autoPlan.dayShort', { day });
        label.append(input, text);
        choices.appendChild(label);
    }
    wrapper.appendChild(choices);
    return wrapper;
}

function createPerformanceSection(card) {
    const section = document.createElement('section');
    section.className = 'cwl-inspector-performance';
    const title = document.createElement('h4');
    title.textContent = t('performance.title');
    section.appendChild(title);
    const data = getPlayerPerformance(getCardTag(card));
    if (!data || data.status !== 'ready') {
        const message = document.createElement('p');
        message.textContent = t(data?.status === 'unavailable'
            ? 'performance.unavailable'
            : 'performance.notEnoughData');
        section.appendChild(message);
        return section;
    }
    const score = document.createElement('strong');
    score.textContent = `${t('performance.warPerformance')}: ${data.performance}`;
    const coverage = document.createElement('p');
    coverage.textContent = t('performance.coverage', {
        attacks: data.coverage?.attacks ?? data.attackCount ?? 0,
        days: data.coverage?.days ?? 0
    });
    section.append(score, coverage);
    return section;
}

function readPlayer(card) {
    return {
        name: card.querySelector('.cwl-player-name')?.textContent?.trim() || getCardTag(card),
        tag: getCardTag(card),
        townHall: card.dataset.townHall || '—',
        clan: card.closest('.cwl-clan-article')?.dataset.clanName || t('cwl.playersSub')
    };
}

function appendFact(list, label, value) {
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value || '—';
    list.append(term, description);
}

function labeledControl(labelText) {
    const label = document.createElement('label');
    label.className = 'cwl-inspector-control';
    const text = document.createElement('span');
    text.textContent = labelText;
    label.appendChild(text);
    return label;
}

function availabilityLabel(card) {
    return card.querySelector('.cwl-availability-indicator')?.textContent
        || t('cwl.availabilityUnknown');
}

function sourceLabel(source) {
    return ({
        tag: t('cwl.addByTag'),
        userBase: t('cwl.mine'),
        friends: t('cwl.friends'),
        group: t('cwl.fromGroup'),
        spreadsheet: t('cwl.sheetImport'),
        planner: t('planner.source')
    })[source] || t('planner.source');
}

function rosterLabel(card) {
    const value = card.dataset.rosterStatus;
    return value === 'reserve'
        ? t('cwl.rosterReserve')
        : value === 'rotation'
            ? t('cwl.rosterRotation')
            : t('cwl.rosterCore');
}

function trapFocus(event, container) {
    const focusable = Array.from(container.querySelectorAll(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    ));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}
