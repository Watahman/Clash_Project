import { savePlan } from './cwl-plan-io.js';
import { applyAvailabilityToCard } from './cwl-availability.js';
import {
    escapeCssIdentifier,
    normalizePlayer,
    plannerHasPlayer,
    uniquePlayers
} from './cwl-utils.js';
import { normalizeRosterStatus } from './cwl-plan-schema.js';
import { t } from '../i18n/i18n.js';
import { attachDeleteButton, attachMoveControl, syncPlayerRosterStatus } from './cwl-player-controls.js';
import { makePlayerDraggable } from './cwl-player-drag.js';
import { rememberPlannerPlayers, updateAllPlayerCounters } from './cwl-planner-card-state.js';

export function createPlayerCard(playerInfo, clanUuid) {
    const players = uniquePlayers(playerInfo);
    let plannerChanged = false;
    let skipped = 0;
    let added = 0;

    players.forEach(player => {
        const target = getPlayerTarget(clanUuid);
        if (!target?.container) return;
        if (target.isPlanner && plannerHasPlayer(player.tag)) {
            skipped += 1;
            return;
        }

        const element = buildPlayerElement(player, target);
        target.container.appendChild(element);
        added += 1;
        if (!target.isPlanner) return;

        makePlayerDraggable(element);
        attachDeleteButton(element);
        attachMoveControl(element);
        const preferredStatus = normalizeRosterStatus(
            player.rosterStatus || player.roster_status || player.status
        );
        syncPlayerRosterStatus(element, {
            preferredStatus,
            autoReserve: !preferredStatus
        });
        applyAvailabilityToCard(element);
        plannerChanged = true;
    });

    if (plannerChanged) {
        updateAllPlayerCounters();
        rememberPlannerPlayers();
        window.dispatchEvent(new CustomEvent(
            'clashtools:cwl-player-added',
            { detail: { added, skipped } }
        ));
        savePlan();
    }
    if (skipped > 0) {
        window.dispatchEvent(new CustomEvent(
            'clashtools:cwl-player-duplicate',
            { detail: { skipped } }
        ));
    }
    return { added, skipped };
}

function getPlayerTarget(clanUuid) {
    if (clanUuid === 'user') {
        return target('#cwl-account-list', ['userBase', 'hidden'], 'user', false);
    }
    if (clanUuid === 'friends') {
        return target('#cwl-account-list', ['friendBase', 'hidden'], 'friends', false);
    }
    if (typeof clanUuid === 'string' && clanUuid.startsWith('group|')) {
        return {
            ...target('#cwl-group-preview-list', ['groupBase', 'hidden'], 'group', false),
            groupId: clanUuid.split('|')[1]
        };
    }
    if (clanUuid != null) {
        const clan = document.querySelector(
            `#cwl-clan-template_${escapeCssIdentifier(clanUuid)}`
        );
        return clan ? {
            container: clan.querySelector('.cwl-clan-player-list'),
            classes: [],
            source: 'planner',
            isPlanner: true
        } : null;
    }
    return target('#cwl-available-players', [], 'planner', true);
}

function target(selector, classes, source, isPlanner) {
    return { container: document.querySelector(selector), classes, source, isPlanner };
}

function buildPlayerElement(player, targetInfo) {
    const template = document.querySelector('#cwl-player-template').content.cloneNode(true);
    const element = template.querySelector('.cwl-player-article');
    const normalized = normalizePlayer(player);
    const townHallImage = element.querySelector('.cwl-player-townhall-foto');
    townHallImage.src =
        `../assets/css/pictures/townhalls/Town_Hall${normalized.townHallLevel}.png`;
    townHallImage.addEventListener('error', () => {
        if (!townHallImage.src.endsWith('/Town_Hall1.png')) {
            townHallImage.src = '../assets/css/pictures/townhalls/Town_Hall1.png';
        }
    }, { once: true });

    const tagElement = element.querySelector('.cwl-player-hashtag');
    const nameElement = element.querySelector('.cwl-player-name');
    const clanElement = element.querySelector('.cwl-player-clan');
    const infoElement = element.querySelector('.cwl-player-info');
    const clanLabel = normalized.clanName || t('cwl.noClan');
    tagElement.textContent = normalized.tag;
    tagElement.title = normalized.tag;
    nameElement.textContent = normalized.name;
    nameElement.title = normalized.name;
    clanElement.textContent = clanLabel;
    clanElement.title = clanLabel;
    infoElement.tabIndex = 0;
    infoElement.setAttribute('role', 'button');
    infoElement.setAttribute('aria-haspopup', 'dialog');
    infoElement.setAttribute(
        'aria-label',
        t('performance.openForPlayer', { player: normalized.name })
    );

    element.dataset.playerTag = normalized.tag;
    element.dataset.townHall = String(normalized.townHallLevel);
    element.dataset.source = targetInfo.source;
    element._cwlPlayer = normalized;
    targetInfo.classes.forEach(className => element.classList.add(className));
    if (targetInfo.groupId) element.dataset.clanuuid = targetInfo.groupId;
    if (targetInfo.isPlanner) element.dataset.plannerCard = 'true';
    else attachPreviewSelection(element);
    return element;
}

function attachPreviewSelection(element) {
    element.addEventListener('click', () => {
        element.classList.toggle('selected');
        window.dispatchEvent(new CustomEvent('clashtools:cwl-preview-selection-changed'));
    });
}
