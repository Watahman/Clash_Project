import { t } from '../i18n/i18n.js';
import { getPlayerAvailability } from './cwl-availability.js';
import { getCardTag } from './cwl-utils.js';
import {
    PLANNER_DAYS,
    keepClanSelection,
    plannedDaysForCard
} from './cwl-planner-schedule-model.js';

export function renderClanSchedule(article) {
    const canvas = ensureScheduleCanvas(article);
    const players = getClanPlayers(article);
    canvas.setAttribute('aria-label', `${article.dataset.clanName || t('cwl.clan')} · ${t('autoPlan.sevenDayPreview')}`);
    canvas.replaceChildren(...PLANNER_DAYS.map(day => createDayColumn(article, players, day)));
}

function ensureScheduleCanvas(article) {
    let canvas = article.querySelector('.cwl-seven-day-canvas');
    if (!canvas) {
        canvas = article.ownerDocument.createElement('section');
        canvas.className = 'cwl-seven-day-canvas';
        article.appendChild(canvas);
    }
    return canvas;
}

function getClanPlayers(article) {
    return Array.from(article.querySelectorAll(
        '.cwl-clan-player-list .cwl-player-article[data-planner-card="true"]'
    ));
}

function createDayColumn(article, players, day) {
    const column = article.ownerDocument.createElement('section');
    column.className = 'cwl-day-column';
    column.dataset.day = String(day);
    const heading = createDayHeading(article.ownerDocument, day, players);
    const dropzone = createDayDropzone(article, players, day);
    column.append(heading, dropzone);
    return column;
}

function createDayHeading(document, day, players) {
    const heading = document.createElement('h4');
    heading.textContent = t('autoPlan.dayShort', { day });
    const count = document.createElement('span');
    count.className = 'cwl-day-count';
    count.textContent = String(getPlayersForDay(players, day).length);
    heading.appendChild(count);
    return heading;
}

function createDayDropzone(article, players, day) {
    const dropzone = article.ownerDocument.createElement('div');
    dropzone.className = 'cwl-day-dropzone';
    dropzone.dataset.day = String(day);
    dropzone.dataset.clanId = article.id;
    dropzone.setAttribute('role', 'listbox');
    dropzone.tabIndex = 0;
    dropzone.setAttribute('aria-label', t('autoPlan.dayShort', { day }));
    getPlayersForDay(players, day).forEach(player => {
        dropzone.appendChild(createDayPlayer(player, day));
    });
    return dropzone;
}

function getPlayersForDay(players, day) {
    return players.filter(player => plannedDaysForCard(player).includes(day));
}

function createDayPlayer(card, day) {
    const player = card.ownerDocument.createElement('button');
    player.type = 'button';
    player.className = 'cwl-day-player';
    player.dataset.playerTag = getCardTag(card);
    const availability = getPlayerAvailability(getCardTag(card));
    const availabilityConflict = availability.state !== 'unknown'
        && !availability.availableDays.includes(day);
    player.dataset.availabilityConflict = String(availabilityConflict);
    player.title = `${card.querySelector('.cwl-player-name')?.textContent || ''} · ${getCardTag(card)}`;
    player.setAttribute('aria-label', player.title);
    const name = card.ownerDocument.createElement('strong');
    name.textContent = card.querySelector('.cwl-player-name')?.textContent || getCardTag(card);
    const tag = card.ownerDocument.createElement('span');
    tag.textContent = getCardTag(card);
    player.append(name, tag);
    return player;
}

export function renderMobileSequence(mobile, clans, selectedClanId, selectedDay) {
    if (!mobile) return;
    const controls = getMobileControls(mobile);
    if (!controls) return;
    renderClanOptions(controls.clanSelect, clans);
    const actualClanId = keepClanSelection(selectedClanId, clans);
    controls.clanSelect.value = actualClanId;
    controls.daySelect.value = String(selectedDay);
    renderMobilePlayers(controls.list, clans.find(clan => clan.id === actualClanId), selectedDay);
}

function getMobileControls(mobile) {
    const clanSelect = mobile.querySelector('#cwl-mobile-clan-select');
    const daySelect = mobile.querySelector('#cwl-mobile-day-select');
    const list = mobile.querySelector('#cwl-mobile-day-list');
    return clanSelect && daySelect && list ? { clanSelect, daySelect, list } : null;
}

function renderClanOptions(select, clans) {
    select.replaceChildren(...clans.map(clan => {
        const option = select.ownerDocument.createElement('option');
        option.value = clan.id;
        option.textContent = clan.dataset.clanName || t('cwl.clan');
        return option;
    }));
}

function renderMobilePlayers(list, clan, selectedDay) {
    list.replaceChildren();
    if (!clan) {
        list.appendChild(messageNode(list.ownerDocument, t('cwl.addClanToPlan')));
        return;
    }
    const cards = getClanPlayers(clan);
    const capacity = Number(clan.querySelector('.cwl-clan-capacity')?.value || 15);
    if (cards.length < capacity) {
        list.appendChild(messageNode(list.ownerDocument, t('autoPlan.warningIncompleteDay', {
            day: selectedDay,
            missing: Math.max(0, capacity - cards.length)
        })));
    }
    cards.forEach(card => list.appendChild(createMobilePlayerRow(card, selectedDay)));
}

function createMobilePlayerRow(card, day) {
    const row = card.ownerDocument.createElement('button');
    row.type = 'button';
    row.className = 'cwl-mobile-player-row';
    row.dataset.mobilePlayerTag = getCardTag(card);
    const planned = plannedDaysForCard(card).includes(day);
    row.classList.toggle('is-unplanned', !planned);
    row.setAttribute('aria-label', t(planned ? 'autoPlan.playsDay' : 'autoPlan.sitsDay', {
        player: card.querySelector('.cwl-player-name')?.textContent || getCardTag(card),
        day
    }));
    const name = card.ownerDocument.createElement('strong');
    name.textContent = card.querySelector('.cwl-player-name')?.textContent || getCardTag(card);
    const detail = card.ownerDocument.createElement('span');
    detail.textContent = `${planned ? t('op.planned') : t('op.notPlanned')} · TH${card.dataset.townHall || '—'} · ${getCardTag(card)}`;
    row.append(name, detail);
    return row;
}

function messageNode(document, message) {
    const node = document.createElement('p');
    node.className = 'cwl-sequence-message';
    node.textContent = message;
    return node;
}
