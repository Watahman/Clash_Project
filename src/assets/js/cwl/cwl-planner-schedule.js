import { getPlayerAvailability } from './cwl-availability.js';
import { syncPlayerPlannedDays, syncPlayerRosterStatus } from './cwl-player-controls.js';
import { normalizePlannedDays } from './cwl-plan-schema.js';
import { getCardTag } from './cwl-utils.js';
import { rememberPlannerPlayers, updateAllPlayerCounters } from './cwl-planner-card-state.js';
import { savePlan } from './cwl-plan-io.js';
import { t } from '../i18n/i18n.js';

export const PLANNER_DAYS = Object.freeze([1, 2, 3, 4, 5, 6, 7]);

export function plannedDaysForCard(card) {
    return normalizePlannedDays(card?.dataset?.plannedDays);
}

export function getPlannerDayDropValidation(card, target) {
    const day = Number(target?.dataset?.day);
    if (!card || !target?.matches?.('.cwl-day-dropzone') || !PLANNER_DAYS.includes(day)) {
        return { legal: true, reason: '' };
    }

    const availability = getPlayerAvailability(getCardTag(card));
    if (availability.state === 'no') {
        return { legal: false, reason: t('cwl.notAvailableCwl') };
    }
    if (
        availability.state === 'partial'
        && !availability.availableDays.includes(day)
    ) {
        return {
            legal: false,
            reason: t('cwl.partialAvailabilityTooltip', {
                available: availability.availableDays.join(', '),
                unavailable: PLANNER_DAYS.filter(item => !availability.availableDays.includes(item)).join(', ')
            })
        };
    }
    if (
        availability.state === 'yes'
        && !availability.availableDays.includes(day)
    ) {
        return { legal: false, reason: t('cwl.noPollData') };
    }
    return { legal: true, reason: '' };
}

export function applyPlannerDayDrop(card, target) {
    const validation = getPlannerDayDropValidation(card, target);
    if (!validation.legal) return { ...validation, applied: false };

    const day = Number(target.dataset.day);
    const clan = target.closest('.cwl-clan-article');
    const list = clan?.querySelector('.cwl-clan-player-list');
    if (!clan || !list || !PLANNER_DAYS.includes(day)) {
        return { legal: false, applied: false, reason: t('cwl.clansTitle') };
    }

    const previousStatus = card.dataset.rosterStatus;
    list.appendChild(card);
    syncPlayerRosterStatus(card, {
        preferredStatus: previousStatus,
        autoReserve: true
    });
    const days = plannedDaysForCard(card);
    if (!days.includes(day)) days.push(day);
    syncPlayerPlannedDays(card, days);
    updateAllPlayerCounters();
    rememberPlannerPlayers();
    dispatchScheduleChange(card, day);
    savePlan();
    return { legal: true, applied: true, day, clanId: clan.id };
}

export function initPlannerSchedule({ root = document, onPlayerSelect, onRender } = {}) {
    const clansRoot = root.querySelector('#cwl-all-clans');
    const mobile = root.querySelector('#cwl-mobile-planner-sequence');
    if (!clansRoot) return { refresh: () => {} };

    let selectedClanId = '';
    let selectedDay = 1;
    let renderQueued = false;
    let rendering = false;

    const refresh = () => {
        if (rendering) return;
        rendering = true;
        const clans = Array.from(clansRoot.querySelectorAll(':scope > .cwl-clan-article'));
        selectedClanId = keepClanSelection(selectedClanId, clans);
        clans.forEach(clan => renderClanSchedule(clan, onPlayerSelect));
        renderMobileSequence(mobile, clans, selectedClanId, selectedDay, {
            onClanChange: value => {
                selectedClanId = value;
                queueRender();
            },
            onDayChange: value => {
                selectedDay = value;
                queueRender();
            },
            onPlayerSelect
        });
        onRender?.({ clans, players: getPlannerPlayers(root), selectedClanId, selectedDay });
        rendering = false;
    };

    const queueRender = () => {
        if (renderQueued) return;
        renderQueued = true;
        queueMicrotask(() => {
            renderQueued = false;
            refresh();
        });
    };

    clansRoot.addEventListener('click', event => {
        const chip = event.target.closest('.cwl-day-player');
        if (!chip) return;
        const card = findPlannerCard(chip.dataset.playerTag);
        if (card) onPlayerSelect?.(card);
    });
    root.querySelector('#cwl-mobile-day-list')?.addEventListener('click', event => {
        const row = event.target.closest('[data-mobile-player-tag]');
        if (!row) return;
        const card = findPlannerCard(row.dataset.mobilePlayerTag);
        if (card) onPlayerSelect?.(card);
    });
    root.querySelector('#cwl-mobile-clan-select')?.addEventListener('change', event => {
        selectedClanId = event.target.value;
        queueRender();
    });
    root.querySelector('#cwl-mobile-day-select')?.addEventListener('change', event => {
        selectedDay = Number(event.target.value) || 1;
        queueRender();
    });

    const observer = new MutationObserver(records => {
        if (records.length && records.every(record => (
            record.target.closest?.('.cwl-seven-day-canvas')
        ))) return;
        queueRender();
    });
    observer.observe(clansRoot, { childList: true, subtree: true });
    for (const eventName of [
        'clashtools:cwl-player-added',
        'clashtools:cwl-player-removed',
        'clashtools:cwl-plan-loaded',
        'clashtools:cwl-plan-meta-loaded',
        'clashtools:cwl-planner-schedule-changed',
        'clashtools:language-changed'
    ]) window.addEventListener(eventName, queueRender);
    refresh();

    return {
        refresh,
        selectClan: id => {
            selectedClanId = id || '';
            queueRender();
        },
        selectDay: day => {
            selectedDay = PLANNER_DAYS.includes(Number(day)) ? Number(day) : 1;
            queueRender();
        }
    };
}

function renderClanSchedule(article, onPlayerSelect) {
    let canvas = article.querySelector('.cwl-seven-day-canvas');
    if (!canvas) {
        canvas = document.createElement('section');
        canvas.className = 'cwl-seven-day-canvas';
        article.appendChild(canvas);
    }
    canvas.replaceChildren();
    const players = Array.from(article.querySelectorAll(
        '.cwl-clan-player-list .cwl-player-article[data-planner-card="true"]'
    ));
    canvas.setAttribute('aria-label', `${article.dataset.clanName || t('cwl.clan')} · ${t('autoPlan.sevenDayPreview')}`);

    PLANNER_DAYS.forEach(day => {
        const column = document.createElement('section');
        column.className = 'cwl-day-column';
        column.dataset.day = String(day);
        const heading = document.createElement('h4');
        heading.textContent = t('autoPlan.dayShort', { day });
        const count = document.createElement('span');
        count.className = 'cwl-day-count';
        const dayPlayers = players.filter(player => plannedDaysForCard(player).includes(day));
        count.textContent = String(dayPlayers.length);
        heading.appendChild(count);
        const dropzone = document.createElement('div');
        dropzone.className = 'cwl-day-dropzone';
        dropzone.dataset.day = String(day);
        dropzone.dataset.clanId = article.id;
        dropzone.setAttribute('role', 'listbox');
        dropzone.tabIndex = 0;
        dropzone.setAttribute('aria-label', t('autoPlan.dayShort', { day }));
        dayPlayers.forEach(player => dropzone.appendChild(createDayPlayer(player)));
        column.append(heading, dropzone);
        canvas.appendChild(column);
    });
}

function createDayPlayer(card) {
    const player = document.createElement('button');
    player.type = 'button';
    player.className = 'cwl-day-player';
    player.dataset.playerTag = getCardTag(card);
    player.title = `${card.querySelector('.cwl-player-name')?.textContent || ''} · ${getCardTag(card)}`;
    player.setAttribute('aria-label', player.title);
    const name = document.createElement('strong');
    name.textContent = card.querySelector('.cwl-player-name')?.textContent || getCardTag(card);
    const tag = document.createElement('span');
    tag.textContent = getCardTag(card);
    player.append(name, tag);
    return player;
}

function renderMobileSequence(mobile, clans, selectedClanId, selectedDay, handlers) {
    if (!mobile) return;
    const clanSelect = mobile.querySelector('#cwl-mobile-clan-select');
    const daySelect = mobile.querySelector('#cwl-mobile-day-select');
    const list = mobile.querySelector('#cwl-mobile-day-list');
    if (!clanSelect || !daySelect || !list) return;

    clanSelect.replaceChildren();
    clans.forEach(clan => {
        const option = document.createElement('option');
        option.value = clan.id;
        option.textContent = clan.dataset.clanName || t('cwl.clan');
        clanSelect.appendChild(option);
    });
    const actualClanId = keepClanSelection(selectedClanId, clans);
    clanSelect.value = actualClanId;
    daySelect.value = String(selectedDay);
    list.replaceChildren();
    if (!clans.length) {
        list.appendChild(messageNode(t('cwl.addClanToPlan')));
        return;
    }

    const clan = clans.find(item => item.id === actualClanId);
    const cards = Array.from(clan?.querySelectorAll(
        '.cwl-clan-player-list .cwl-player-article[data-planner-card="true"]'
    ) || []);
    const capacity = Number(clan?.querySelector('.cwl-clan-capacity')?.value || 15);
    if (cards.length < capacity) {
        list.appendChild(messageNode(t('autoPlan.warningIncompleteDay', {
            day: selectedDay,
            missing: Math.max(0, capacity - cards.length)
        })));
    }
    cards.forEach(card => list.appendChild(createMobilePlayerRow(card, selectedDay)));
    clanSelect.onchange = event => handlers.onClanChange(event.target.value);
    daySelect.onchange = event => handlers.onDayChange(Number(event.target.value));
}

function createMobilePlayerRow(card, day) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'cwl-mobile-player-row';
    row.dataset.mobilePlayerTag = getCardTag(card);
    const planned = plannedDaysForCard(card).includes(day);
    row.classList.toggle('is-unplanned', !planned);
    row.setAttribute('aria-label', t(planned ? 'autoPlan.playsDay' : 'autoPlan.sitsDay', {
        player: card.querySelector('.cwl-player-name')?.textContent || getCardTag(card),
        day
    }));
    const name = document.createElement('strong');
    name.textContent = card.querySelector('.cwl-player-name')?.textContent || getCardTag(card);
    const detail = document.createElement('span');
    detail.textContent = `${planned ? t('op.planned') : t('op.notPlanned')} · TH${card.dataset.townHall || '—'} · ${getCardTag(card)}`;
    row.append(name, detail);
    return row;
}

function messageNode(message) {
    const node = document.createElement('p');
    node.className = 'cwl-sequence-message';
    node.textContent = message;
    return node;
}

function keepClanSelection(selectedClanId, clans) {
    return clans.some(clan => clan.id === selectedClanId)
        ? selectedClanId
        : clans[0]?.id || '';
}

function getPlannerPlayers(root) {
    return Array.from(root.querySelectorAll('.cwl-player-article[data-planner-card="true"]'));
}

function findPlannerCard(tag) {
    return Array.from(document.querySelectorAll(
        '.cwl-player-article[data-planner-card="true"]'
    )).find(card => getCardTag(card) === tag);
}

function dispatchScheduleChange(card, day) {
    window.dispatchEvent(new CustomEvent('clashtools:cwl-planner-schedule-changed', {
        detail: { tag: getCardTag(card), day }
    }));
}
