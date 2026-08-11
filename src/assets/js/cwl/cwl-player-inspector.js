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
import { getPlannerDayAssignmentValidation } from './cwl-planner-schedule-rules.js';
import { createPlayerInspectorController } from './cwl-player-inspector-controller.js';

export function initPlayerInspector({ root = document } = {}) {
    const drawer = root.querySelector('#cwl-player-inspector');
    const body = root.querySelector('#cwl-player-inspector-body');
    if (!drawer || !body) return { open: () => {}, close: () => {} };
    return createPlayerInspectorController({
        root,
        drawer,
        body,
        backdrop: root.querySelector('#cwl-player-inspector-backdrop'),
        closeButton: root.querySelector('#cwl-player-inspector-close'),
        renderInspector
    });
}

function renderInspector(container, card) {
    container.replaceChildren(
        createInspectorPlayerHeader(card),
        createInspectorFacts(card),
        createInspectorActions(card),
        createScheduleControls(card),
        createPerformanceSection(card)
    );
}

function createInspectorPlayerHeader(card) {
    const player = readPlayer(card);
    const document = card.ownerDocument;
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
    return header;
}

function createInspectorFacts(card) {
    const player = readPlayer(card);
    const facts = card.ownerDocument.createElement('dl');
    facts.className = 'cwl-inspector-facts';
    appendFact(facts, t('cwl.sortTownhall'), `TH${player.townHall}`);
    appendFact(facts, t('op.clan'), player.clan);
    appendFact(facts, t('planner.source'), sourceLabel(card.dataset.source));
    appendFact(facts, t('cwl.pollResults'), availabilityLabel(card));
    appendFact(facts, t('cwl.rosterStatus'), rosterLabel(card));
    return facts;
}

function createInspectorActions(card) {
    const actions = card.ownerDocument.createElement('div');
    actions.className = 'cwl-inspector-actions';
    actions.append(createMoveControl(card), createRoleControl(card));
    return actions;
}

function createMoveControl(card) {
    const wrapper = labeledControl(t('cwl.movePlayer'), card.ownerDocument);
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
    const wrapper = labeledControl(t('cwl.rosterStatus'), card.ownerDocument);
    const source = card.querySelector('.cwl-roster-status');
    if (!source) {
        const message = card.ownerDocument.createElement('p');
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
    const wrapper = card.ownerDocument.createElement('fieldset');
    wrapper.className = 'cwl-inspector-schedule';
    const legend = card.ownerDocument.createElement('legend');
    legend.textContent = t('autoPlan.plannedDays', { days: '' }).replace(/: $/, '');
    wrapper.appendChild(legend);
    if (!card.closest('.cwl-clan-article')) {
        const note = card.ownerDocument.createElement('p');
        note.className = 'cwl-inspector-muted';
        note.textContent = t('cwl.movePlayer');
        wrapper.appendChild(note);
        return wrapper;
    }

    const days = normalizePlannedDays(card.dataset.plannedDays);
    const choices = createDayChoiceGrid(card, days);
    wrapper.appendChild(choices);
    return wrapper;
}

function createDayChoiceGrid(card, days) {
    const choices = card.ownerDocument.createElement('div');
    choices.className = 'cwl-day-choice-grid';
    for (let day = 1; day <= 7; day += 1) {
        choices.appendChild(createDayChoice(card, days, day));
    }
    return choices;
}

function createDayChoice(card, days, day) {
    const label = card.ownerDocument.createElement('label');
    const input = card.ownerDocument.createElement('input');
    const validation = getPlannerDayAssignmentValidation(card, day);
    input.type = 'checkbox';
    input.value = String(day);
    input.checked = days.includes(day);
    input.disabled = !validation.legal && !input.checked;
    input.addEventListener('change', () => updateScheduleDay(card, input, day));
    const text = card.ownerDocument.createElement('span');
    text.textContent = t('autoPlan.dayShort', { day });
    label.append(input, text);
    return label;
}

function updateScheduleDay(card, input, day) {
    if (input.checked && !getPlannerDayAssignmentValidation(card, day).legal) {
        input.checked = false;
        return;
    }
    const next = normalizePlannedDays(card.dataset.plannedDays);
    const index = next.indexOf(day);
    if (input.checked && index === -1) next.push(day);
    if (!input.checked && index !== -1) next.splice(index, 1);
    syncPlayerPlannedDays(card, next);
    updateAllPlayerCounters();
    rememberPlannerPlayers();
    dispatchScheduleChange(card, day);
    savePlan();
}

function dispatchScheduleChange(card, day) {
    const view = card?.ownerDocument?.defaultView || globalThis;
    view.dispatchEvent(new CustomEvent('clashtools:cwl-planner-schedule-changed', {
        detail: { tag: getCardTag(card), day }
    }));
}

function createPerformanceSection(card) {
    const document = card.ownerDocument;
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
    const document = list.ownerDocument;
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value || '—';
    list.append(term, description);
}

function labeledControl(labelText, document) {
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
