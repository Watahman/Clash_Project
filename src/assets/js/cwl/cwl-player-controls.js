import { savePlan } from './cwl-plan-io.js';
import { escapeCssIdentifier } from './cwl-utils.js';
import { normalizeRosterStatus } from './cwl-plan-schema.js';
import { t } from '../i18n/i18n.js';
import { rememberPlannerPlayers, updateAllPlayerCounters } from './cwl-planner-card-state.js';

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

function statusOption(value, labelKey) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = t(labelKey);
    return option;
}

function attachRosterStatusControl(element) {
    let select = element.querySelector('.cwl-roster-status');
    if (select) return select;

    select = document.createElement('select');
    select.className = 'cwl-roster-status';
    select.setAttribute('aria-label', t('cwl.rosterStatus'));
    select.title = t('cwl.rosterStatus');
    select.append(
        statusOption('core', 'cwl.rosterCore'),
        statusOption('rotation', 'cwl.rosterRotation'),
        statusOption('reserve', 'cwl.rosterReserve')
    );
    select.addEventListener('pointerdown', event => event.stopPropagation());
    select.addEventListener('mousedown', event => event.stopPropagation());
    select.addEventListener('change', () => {
        element.dataset.rosterStatus = normalizeRosterStatus(select.value, 'core');
        updateAllPlayerCounters();
        rememberPlannerPlayers();
        savePlan();
    });

    const moveSelect = element.querySelector('.cwl-move-player');
    const deleteButton = element.querySelector('.cwl-delete-player');
    if (moveSelect) element.insertBefore(select, moveSelect);
    else if (deleteButton) element.insertBefore(select, deleteButton);
    else element.appendChild(select);
    if (deleteButton) element.appendChild(deleteButton);
    return select;
}

export function syncPlayerRosterStatus(element, options = {}) {
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

export function attachMoveControl(element) {
    if (element.querySelector('.cwl-move-player')) return;
    const select = document.createElement('select');
    select.className = 'cwl-move-player';
    select.setAttribute('aria-label', t('cwl.movePlayer'));
    select.title = t('cwl.movePlayer');

    const refreshOptions = () => {
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
    };

    select.addEventListener('focus', refreshOptions);
    select.addEventListener('pointerdown', event => event.stopPropagation());
    select.addEventListener('mousedown', event => event.stopPropagation());
    select.addEventListener('change', () => {
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
    });
    refreshOptions();
    element.appendChild(select);
}
