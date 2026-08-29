import { savePlan } from './cwl-plan-io.js?v=20260829-public-auth-v1';
import { escapeCssIdentifier } from './cwl-utils.js';
import {
    CWL_PLAYER_PRIORITIES,
    normalizePlayerPriority,
    normalizeRosterStatus
} from './cwl-plan-schema.js';
import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { rememberPlannerPlayers, updateAllPlayerCounters } from './cwl-planner-card-state.js?v=20260829-public-auth-v1';

const moveControlRefreshers = new WeakMap();

function ensurePlayerControlGroup(element) {
    let group = element.querySelector('.cwl-player-control-group');
    if (group) return group;

    group = document.createElement('div');
    group.className = 'cwl-player-control-group';
    const deleteButton = element.querySelector('.cwl-delete-player');
    if (deleteButton) element.insertBefore(group, deleteButton);
    else element.appendChild(group);
    return group;
}

function clanCapacity(clan) {
    return Number(
        clan?.querySelector('.cwl-clan-capacity')?.value
        || clan?.dataset?.clanCapacity
        || 15
    );
}

function nonReservePlayerCount(clan, excludedPlayer = null) {
    if (!clan) return 0;
    return Array.from(
        clan.querySelectorAll('.cwl-clan-player-list .cwl-player-article[data-planner-card="true"]')
    ).filter(player => (
        player !== excludedPlayer
        && normalizeRosterStatus(player.dataset.rosterStatus, 'core') !== 'reserve'
    )).length;
}

function statusOption(value) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    return option;
}

function priorityOption(value) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = t(`planner.playerPriority${capitalize(value)}`);
    return option;
}

function translatePlayerPriorityOptions(select) {
    Array.from(select.options).forEach(option => {
        const value = normalizePlayerPriority(option.value);
        option.textContent = t(`planner.playerPriority${capitalize(value)}`);
    });
}

function isFreeRosterPlayer(element) {
    return Boolean(element?.closest('#cwl-available-players'));
}

export function attachPlayerPriorityControl(element) {
    let select = element.querySelector('.cwl-player-priority');
    if (!select) {
        select = document.createElement('select');
        select.className = 'cwl-player-priority';
        select.append(...CWL_PLAYER_PRIORITIES.map(priorityOption));
        select.addEventListener('pointerdown', event => event.stopPropagation());
        select.addEventListener('mousedown', event => event.stopPropagation());
        select.addEventListener('change', () => {
            element.dataset.playerPriority = normalizePlayerPriority(select.value);
            rememberPlannerPlayers();
            savePlan();
        });
    }
    translatePlayerPriorityOptions(select);
    select.value = normalizePlayerPriority(element.dataset.playerPriority);
    select.title = t('planner.playerPriority');
    select.setAttribute('aria-label', t('planner.playerPriority'));
    ensurePlayerControlGroup(element).prepend(select);
    return select;
}

function attachRosterStatusControl(element) {
    let select = element.querySelector('.cwl-roster-status');
    if (select) {
        ensurePlayerControlGroup(element).appendChild(select);
        return select;
    }

    select = document.createElement('select');
    select.className = 'cwl-roster-status';
    select.setAttribute('aria-label', t('cwl.rosterStatus'));
    select.title = t('cwl.rosterStatus');
    select.append(
        statusOption('core'),
        statusOption('rotation'),
        statusOption('reserve')
    );
    select.addEventListener('pointerdown', event => event.stopPropagation());
    select.addEventListener('mousedown', event => event.stopPropagation());
    select.addEventListener('change', () => {
        element.dataset.rosterStatus = normalizeRosterStatus(select.value, 'core');
        updateAllPlayerCounters();
        rememberPlannerPlayers();
        savePlan();
    });

    const controlGroup = ensurePlayerControlGroup(element);
    const moveSelect = element.querySelector('.cwl-move-player');
    const deleteButton = element.querySelector('.cwl-delete-player');
    if (moveSelect) controlGroup.insertBefore(select, moveSelect);
    else controlGroup.appendChild(select);
    if (deleteButton) element.appendChild(deleteButton);
    return select;
}

export function syncPlayerRosterStatus(element, options = {}) {
    syncPlayerMoveControl(element);
    const clan = element.closest('.cwl-clan-article');
    if (!clan) {
        delete element.dataset.rosterStatus;
        element.querySelector('.cwl-roster-status')?.remove();
        return '';
    }

    const preferredStatus = normalizeRosterStatus(
        options.preferredStatus || element.dataset.rosterStatus
    );
    let status = preferredStatus || 'core';
    if (
        options.autoReserve === true
        && status !== 'reserve'
        && nonReservePlayerCount(clan, element) >= clanCapacity(clan)
    ) {
        status = 'reserve';
    }

    element.dataset.rosterStatus = status;
    const select = attachRosterStatusControl(element);
    select.value = status;
    return status;
}

export function attachDeleteButton(element) {
    if (element.querySelector('.cwl-delete-player')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cwl-delete-player';
    button.title = t('cwl.removePlayer');
    button.setAttribute('aria-label', t('cwl.removePlayer'));
    button.innerHTML = '<img src="../assets/css/pictures/bin.svg" alt="">';
    button.addEventListener('mousedown', event => {
        event.preventDefault();
        event.stopPropagation();
    });
    button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        element.remove();
        updateAllPlayerCounters();
        rememberPlannerPlayers();
        window.dispatchEvent(new CustomEvent('clashtools:cwl-player-removed'));
        savePlan();
    });
    element.appendChild(button);
}

function refreshMoveOptions(element, select) {
    const currentContainer = element.parentElement;
    select.replaceChildren();
    const free = document.createElement('option');
    free.value = 'free';
    free.textContent = t('cwl.moveToAvailable');
    select.appendChild(free);
    document.querySelectorAll('.cwl-clan-article').forEach(clan => {
        const option = document.createElement('option');
        option.value = clan.id;
        option.textContent = clan.dataset.clanName
            || clan.querySelector('.cwl-clan-name')?.textContent
            || t('cwl.clan');
        select.appendChild(option);
    });
    select.value = currentContainer?.closest('.cwl-clan-article')?.id || 'free';
}

function movePlayer(element, select) {
    const target = select.value === 'free'
        ? document.querySelector('#cwl-available-players')
        : document.querySelector(
            `#${escapeCssIdentifier(select.value)} .cwl-clan-player-list`
        );
    const previousContainer = element.parentElement;
    if (!target || target === previousContainer) return;
    const previousStatus = normalizeRosterStatus(element.dataset.rosterStatus);
    target.appendChild(element);
    syncPlayerRosterStatus(element, {
        preferredStatus: previousStatus,
        autoReserve: target.matches('.cwl-clan-player-list')
    });
    updateAllPlayerCounters();
    rememberPlannerPlayers();
    window.dispatchEvent(new CustomEvent('clashtools:cwl-player-added'));
    savePlan();
}

function bindMoveControl(element, select, refreshOptions) {
    select.addEventListener('focus', refreshOptions);
    select.addEventListener('pointerdown', event => event.stopPropagation());
    select.addEventListener('mousedown', event => event.stopPropagation());
    select.addEventListener('change', () => movePlayer(element, select));
}

export function attachMoveControl(element) {
    const existing = element.querySelector('.cwl-move-player');
    if (!isFreeRosterPlayer(element)) {
        existing?.remove();
        moveControlRefreshers.delete(element);
        return;
    }
    const select = existing || document.createElement('select');
    const isNew = !existing;
    if (isNew) select.className = 'cwl-move-player';
    select.setAttribute('aria-label', t('cwl.movePlayer'));
    select.title = t('cwl.movePlayer');

    const refreshOptions = () => refreshMoveOptions(element, select);
    moveControlRefreshers.set(element, refreshOptions);

    if (isNew) bindMoveControl(element, select, refreshOptions);
    refreshOptions();
    ensurePlayerControlGroup(element).appendChild(select);
}

export function syncPlayerMoveControl(element) {
    if (!isFreeRosterPlayer(element)) {
        element.querySelector('.cwl-move-player')?.remove();
        moveControlRefreshers.delete(element);
        return '';
    }
    if (!moveControlRefreshers.has(element)) attachMoveControl(element);
    const refresh = moveControlRefreshers.get(element);
    if (!refresh) return '';
    refresh();
    return element.querySelector('.cwl-move-player')?.value || '';
}

function capitalize(value) {
    return value ? value[0].toUpperCase() + value.slice(1) : '';
}
