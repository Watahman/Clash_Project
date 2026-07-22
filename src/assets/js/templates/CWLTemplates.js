import { savePlan } from '../cwl/cwl-plan-io.js';
import { applyAvailabilityToCard } from '../cwl/cwl-availability.js';
import { getCardTag, normalizePlayer, normalizeTag, plannerHasPlayer, uniquePlayers } from '../cwl/cwl-utils.js';
import { t } from '../i18n/i18n.js';
import { allowsThirtyPlayerCwl, normalizeCwlCapacity } from '../cwl/cwl-league-rules.js';
import { normalizeRosterStatus } from '../cwl/cwl-plan-schema.js';

function createPlayerCard(playerInfo, clanuuid) {
    const players = uniquePlayers(playerInfo);
    let plannerChanged = false;
    let skipped = 0;
    let added = 0;

    players.forEach(player => {
        const target = getPlayerTarget(clanuuid);
        if (!target?.container) return;
        if (target.isPlanner && plannerHasPlayer(player.tag)) {
            skipped += 1;
            return;
        }

        const element = buildPlayerElement(player, target);
        target.container.appendChild(element);
        added += 1;

        if (target.isPlanner) {
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
        }
    });

    if (plannerChanged) {
        updateAllPlayerCounters();
        rememberPlannerPlayers();
        window.dispatchEvent(new CustomEvent('clashtools:cwl-player-added', { detail: { added, skipped } }));
        savePlan();
    }
    if (skipped > 0) {
        window.dispatchEvent(new CustomEvent('clashtools:cwl-player-duplicate', { detail: { skipped } }));
    }
    return { added, skipped };
}

function getPlayerTarget(clanuuid) {
    if (clanuuid === 'user') {
        return { container: document.querySelector('#cwl-account-list'), classes: ['userBase', 'hidden'], source: 'user', isPlanner: false };
    }
    if (clanuuid === 'friends') {
        return { container: document.querySelector('#cwl-account-list'), classes: ['friendBase', 'hidden'], source: 'friends', isPlanner: false };
    }
    if (typeof clanuuid === 'string' && clanuuid.startsWith('group|')) {
        return {
            container: document.querySelector('#cwl-group-preview-list'),
            classes: ['groupBase', 'hidden'],
            source: 'group',
            groupId: clanuuid.split('|')[1],
            isPlanner: false
        };
    }
    if (clanuuid != null) {
        const clan = document.querySelector(`#cwl-clan-template_${CSS.escape(clanuuid)}`);
        return clan ? { container: clan.querySelector('.cwl-clan-player-list'), classes: [], source: 'planner', isPlanner: true } : null;
    }
    return { container: document.querySelector('#cwl-available-players'), classes: [], source: 'planner', isPlanner: true };
}

function buildPlayerElement(player, target) {
    const template = document.querySelector('#cwl-player-template').content.cloneNode(true);
    const element = template.querySelector('.cwl-player-article');
    const normalized = normalizePlayer(player);
    const townHallImage = element.querySelector('.cwl-player-townhall-foto');
    townHallImage.src = `../assets/css/pictures/townhalls/Town_Hall${normalized.townHallLevel}.png`;
    townHallImage.addEventListener('error', () => {
        if (!townHallImage.src.endsWith('/Town_Hall1.png')) {
            townHallImage.src = '../assets/css/pictures/townhalls/Town_Hall1.png';
        }
    }, { once: true });
    const tagElement = element.querySelector('.cwl-player-hashtag');
    const nameElement = element.querySelector('.cwl-player-name');
    const clanElement = element.querySelector('.cwl-player-clan');
    const clanLabel = normalized.clanName || t('cwl.noClan');
    tagElement.textContent = normalized.tag;
    tagElement.title = normalized.tag;
    nameElement.textContent = normalized.name;
    nameElement.title = normalized.name;
    clanElement.textContent = clanLabel;
    clanElement.title = clanLabel;
    element.dataset.playerTag = normalized.tag;
    element.dataset.townHall = String(normalized.townHallLevel);
    element.dataset.source = target.source;
    element._cwlPlayer = normalized;
    target.classes.forEach(className => element.classList.add(className));
    if (target.groupId) element.dataset.clanuuid = target.groupId;
    if (target.isPlanner) element.dataset.plannerCard = 'true';
    else attachPreviewSelection(element);
    return element;
}

function attachPreviewSelection(element) {
    element.addEventListener('click', () => {
        element.classList.toggle('selected');
        window.dispatchEvent(new CustomEvent('clashtools:cwl-preview-selection-changed'));
    });
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

function statusOption(value, labelKey) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = t(labelKey);
    return option;
}

function attachRosterStatusControl(element) {
    let select = element.querySelector('.cwl-roster-status');

    if (select) {
        return select;
    }

    select = document.createElement('select');
    select.className = 'cwl-roster-status';
    select.setAttribute(
        'aria-label',
        t('cwl.rosterStatus')
    );
    select.title = t('cwl.rosterStatus');

    select.append(
        statusOption('core', 'cwl.rosterCore'),
        statusOption('rotation', 'cwl.rosterRotation'),
        statusOption('reserve', 'cwl.rosterReserve')
    );

    select.addEventListener(
        'pointerdown',
        event => event.stopPropagation()
    );

    select.addEventListener(
        'mousedown',
        event => event.stopPropagation()
    );

    select.addEventListener('change', () => {
        element.dataset.rosterStatus =
            normalizeRosterStatus(
                select.value,
                'core'
            );

        updateAllPlayerCounters();
        rememberPlannerPlayers();
        savePlan();
    });

    const moveSelect = element.querySelector(
        '.cwl-move-player'
    );

    const deleteButton = element.querySelector(
        '.cwl-delete-player'
    );

    if (moveSelect) {
        element.insertBefore(select, moveSelect);
    } else if (deleteButton) {
        element.insertBefore(select, deleteButton);
    } else {
        element.appendChild(select);
    }

    if (deleteButton) {
        element.appendChild(deleteButton);
    }

    return select;
}

function syncPlayerRosterStatus(element, options = {}) {
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
    const isNewClanPlacement = options.autoReserve === true;
    if (
        isNewClanPlacement
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

function attachDeleteButton(element) {
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
        removePlayerCard(element);
    });
    element.appendChild(button);
}

function attachMoveControl(element) {
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
        const currentClan = currentContainer?.closest('.cwl-clan-article');
        select.value = currentClan?.id || 'free';
    };
    select.addEventListener('focus', refreshOptions);
    select.addEventListener('pointerdown', event => event.stopPropagation());
    select.addEventListener('mousedown', event => event.stopPropagation());
    select.addEventListener('change', () => {
        const target = select.value === 'free'
            ? document.querySelector('#cwl-available-players')
            : document.querySelector(`#${CSS.escape(select.value)} .cwl-clan-player-list`);
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

function removePlayerCard(element) {
    element.remove();
    updateAllPlayerCounters();
    rememberPlannerPlayers();
    window.dispatchEvent(new CustomEvent('clashtools:cwl-player-removed'));
    savePlan();
}

function rememberPlannerPlayers() {
    const players = Array.from(document.querySelectorAll('.cwl-player-article[data-planner-card="true"]')).map(player => ({
        name: player.querySelector('.cwl-player-name')?.textContent || '',
        clanName: player.querySelector('.cwl-player-clan')?.textContent || '',
        tag: getCardTag(player),
        townHall: Number(player.dataset.townHall || 1),
        rosterStatus: normalizeRosterStatus(player.dataset.rosterStatus)
    })).filter(player => player.tag);
    localStorage.setItem('clashtools_last_planner_players', JSON.stringify(players));
}


function updateClanCapacityCounter(article) {
    const select = article.querySelector('.cwl-clan-capacity');
    const counter = article.querySelector('.cwl-amount-of-players-in-clan');
    if (!select || !counter) return;

    const players = Array.from(
        article.querySelectorAll('.cwl-clan-player-list .cwl-player-article[data-planner-card="true"]')
    );
    const capacity = Number(select.value || 15);
    const reserves = players.filter(player => (
        normalizeRosterStatus(player.dataset.rosterStatus, 'core') === 'reserve'
    )).length;
    const active = players.length - reserves;

    counter.textContent = reserves > 0
        ? `${active}/${capacity} · ${t(reserves === 1 ? 'cwl.reserveCountOne' : 'cwl.reserveCountMany', { count: reserves })}`
        : `${active}/${capacity}`;
    counter.title = t('cwl.rosterCounterTitle', {
        total: players.length,
        active,
        reserve: reserves,
        capacity
    });
    counter.dataset.totalPlayers = String(players.length);
    counter.dataset.activePlayers = String(active);
    counter.dataset.reservePlayers = String(reserves);
    article.dataset.clanCapacity = String(capacity);
}

function applyClanLeagueRestriction(article, leagueName, options = {}) {
    const select = article?.querySelector('.cwl-clan-capacity');
    const thirtyOption = select?.querySelector('option[value="30"]');
    if (!select || !thirtyOption) return false;

    const allowThirty = allowsThirtyPlayerCwl(leagueName);
    article.dataset.clanLeague = leagueName || '';
    thirtyOption.disabled = !allowThirty;
    thirtyOption.textContent = allowThirty ? '30v30' : t('cwl.thirtyUnavailableOption');
    select.title = allowThirty
        ? ''
        : t('cwl.thirtyUnavailableForLeague', { league: leagueName || t('cwl.thisLeague') });

    const changed = !allowThirty && select.value === '30';
    if (changed) {
        select.value = '15';
        updateClanCapacityCounter(article);
        if (options.persist !== false) savePlan();
    }
    return changed;
}

function createClanCard(clanInfo, playerAmount, uuid = '') {
    const clanTag = normalizeTag(clanInfo?.tag);
    const clanName = clanInfo?.name || clanTag || t('cwl.clan');
    const leagueName = clanInfo?.warLeague?.name || '';
    const capacity = normalizeCwlCapacity(playerAmount, leagueName);

    const clanTemplate = document.querySelector('#cwl-clan-template');
    const clanTemplateClone = clanTemplate.content.cloneNode(true);
    const article = clanTemplateClone.querySelector('article');
    const clanUuid = uuid || crypto.randomUUID();

    const logo = clanTemplateClone.querySelector('.cwl-clan-logo');
    logo.src = clanInfo?.badgeUrls?.small || '../assets/css/pictures/default-clan-banner.png';
    logo.alt = clanName;
    clanTemplateClone.querySelector('.cwl-clan-name').textContent = clanName;
    clanTemplateClone.querySelector('.cwl-clan-tag').textContent = clanTag;
    clanTemplateClone.querySelector('.cwl-clan-league').textContent = leagueName ? ` · ${leagueName}` : '';
    clanTemplateClone.querySelector('.cwl-amount-of-players-in-clan').textContent = `0/${capacity}`;
    clanTemplateClone.querySelector('.cwl-amount-of-players-in-clan').id = 'cwl-clan-playeramount-template-' + (document.querySelector('#cwl-all-clans').children.length + 1);
    const capacitySelect = clanTemplateClone.querySelector('.cwl-clan-capacity');
    clanTemplateClone.querySelector('.cwl-clan-format > span').textContent = t('planner.format');
    capacitySelect.value = String(capacity);
    capacitySelect.setAttribute('aria-label', t('planner.format'));
    capacitySelect.addEventListener('change', () => {
        article.dataset.clanCapacity = capacitySelect.value;
        updateClanCapacityCounter(article);
        savePlan();
    });
    const deleteClan = clanTemplateClone.querySelector('.cwl-delete-clan');
    deleteClan.title = t('cwl.deleteClan');
    deleteClan.setAttribute('aria-label', t('cwl.deleteClan'));
    article.id = 'cwl-clan-template_' + clanUuid;
    article.dataset.clanTag = clanTag;
    article.dataset.clanName = clanName;
    article.dataset.clanLeague = leagueName;
    article.dataset.clanCapacity = String(capacity);
    applyClanLeagueRestriction(article, leagueName, { persist: false });

    deleteClan.addEventListener('click', event => {
        const currentArticle = event.target.closest('article');
        currentArticle.querySelectorAll('.cwl-player-article[data-planner-card="true"]').forEach(player => {
            document.querySelector('#cwl-available-players').appendChild(player);
            syncPlayerRosterStatus(player);
            applyAvailabilityToCard(player);
        });
        currentArticle.remove();
        updateAllPlayerCounters();
        rememberPlannerPlayers();
        window.dispatchEvent(new CustomEvent('clashtools:cwl-player-added'));
        savePlan();
    });

    document.querySelector('#cwl-all-clans').appendChild(clanTemplateClone);
    if (clanInfo?.name && clanTag) localStorage.setItem('clanId_' + clanInfo.name, clanTag);
    makeClanDraggable(document.querySelector('#cwl-all-clans').lastElementChild);
    updateAllPlayerCounters();
    savePlan();
}

function makePlayerDraggable(element) {
    let offsetX, offsetY;
    let dragging = false;
    element.originalContainer = element.parentElement;
    element.classList.add('draggable');

    element.addEventListener('mousedown', event => {
        if (event.target.closest('.cwl-delete-player, .cwl-move-player, .cwl-roster-status')) return;
        event.preventDefault();
        event.stopPropagation();
        if (dragging) return;
        dragging = true;
        element.originalContainer = element.parentElement;

        const rect = element.getBoundingClientRect();
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;

        const dragLayer = element.closest('.workspace-planner') || document.body;
        element.classList.add('cwl-player-dragging');
        element.style.position = 'fixed';
        element.style.left = rect.left + 'px';
        element.style.top = rect.top + 'px';
        element.style.setProperty('width', rect.width + 'px', 'important');
        element.style.setProperty('height', rect.height + 'px', 'important');
        element.style.zIndex = '1000';
        element.style.pointerEvents = 'none';
        dragLayer.appendChild(element);

        const onMouseMove = moveEvent => {
            element.style.left = (moveEvent.clientX - offsetX) + 'px';
            element.style.top = (moveEvent.clientY - offsetY) + 'px';
        };

        const onMouseUp = upEvent => {
            dragging = false;
            const lists = document.querySelectorAll('.cwl-clan-player-list, #cwl-available-players');
            const previousContainer = element.originalContainer;
            let targetContainer = null;

            for (const list of lists) {
                const listRect = list.getBoundingClientRect();
                if (upEvent.clientX >= listRect.left && upEvent.clientX <= listRect.right &&
                    upEvent.clientY >= listRect.top && upEvent.clientY <= listRect.bottom) {
                    targetContainer = list;
                    break;
                }
            }

            const finalContainer = targetContainer || previousContainer;
            const previousStatus = normalizeRosterStatus(element.dataset.rosterStatus);
            finalContainer.appendChild(element);
            element.originalContainer = finalContainer;
            syncPlayerRosterStatus(element, {
                preferredStatus: previousStatus,
                autoReserve: Boolean(targetContainer && targetContainer !== previousContainer && targetContainer.matches('.cwl-clan-player-list'))
            });

            element.classList.remove('cwl-player-dragging');
            element.style.position = '';
            element.style.left = '';
            element.style.top = '';
            element.style.removeProperty('width');
            element.style.removeProperty('height');
            element.style.zIndex = '';
            element.style.pointerEvents = '';

            updateAllPlayerCounters();
            rememberPlannerPlayers();
            window.dispatchEvent(new CustomEvent('clashtools:cwl-player-added'));
            savePlan();

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

function makeClanDraggable(clanArticle) {
    const handle = clanArticle.querySelector('.cwl-clan-info-card');
    handle.style.cursor = 'grab';

    let dragging = false;
    let placeholder = null;
    let offsetX, offsetY;

    handle.addEventListener('mousedown', event => {
        if (event.target.closest('.cwl-delete-clan, .cwl-clan-capacity') ||
            event.target.closest('.cwl-player-article')) return;

        event.preventDefault();
        if (dragging) return;
        dragging = true;

        const container = document.querySelector('#cwl-all-clans');
        const rect = clanArticle.getBoundingClientRect();
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;

        placeholder = document.createElement('div');
        placeholder.style.width = rect.width + 'px';
        placeholder.style.height = rect.height + 'px';
        placeholder.style.border = '2px dashed var(--border-focus)';
        placeholder.style.borderRadius = 'var(--radius-xl)';
        placeholder.style.background = 'var(--accent-glow)';
        placeholder.style.flexShrink = '0';
        container.insertBefore(placeholder, clanArticle);

        clanArticle.style.position = 'fixed';
        clanArticle.style.left = rect.left + 'px';
        clanArticle.style.top = rect.top + 'px';
        clanArticle.style.width = rect.width + 'px';
        clanArticle.style.zIndex = '500';
        clanArticle.style.opacity = '0.92';
        clanArticle.style.boxShadow = 'var(--shadow-lg)';
        clanArticle.style.pointerEvents = 'none';
        document.body.appendChild(clanArticle);

        const onMouseMove = moveEvent => {
            clanArticle.style.left = (moveEvent.clientX - offsetX) + 'px';
            clanArticle.style.top = (moveEvent.clientY - offsetY) + 'px';
            clanArticle.style.pointerEvents = 'none';
            const target = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest('.cwl-clan-article');
            clanArticle.style.pointerEvents = '';

            if (target && target !== clanArticle) {
                const targetRect = target.getBoundingClientRect();
                const midX = targetRect.left + targetRect.width / 2;
                container.insertBefore(placeholder, moveEvent.clientX < midX ? target : target.nextSibling);
            }
        };

        const onMouseUp = () => {
            dragging = false;
            handle.style.cursor = 'grab';
            clanArticle.style.position = '';
            clanArticle.style.left = '';
            clanArticle.style.top = '';
            clanArticle.style.width = '';
            clanArticle.style.zIndex = '';
            clanArticle.style.opacity = '';
            clanArticle.style.boxShadow = '';
            clanArticle.style.pointerEvents = '';
            container.insertBefore(clanArticle, placeholder);
            placeholder.remove();
            placeholder = null;
            savePlan();
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

function updateAllPlayerCounters() {
    document.querySelector('#cwl-total-player-amount').textContent =
        String(document.querySelectorAll('#cwl-available-players .cwl-player-article[data-planner-card="true"]').length);

    document.querySelectorAll('.cwl-clan-article').forEach(updateClanCapacityCounter);
}

export { createPlayerCard, createClanCard, updateAllPlayerCounters, applyClanLeagueRestriction };
