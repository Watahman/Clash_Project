import { savePlan } from '../cwl/cwl-plan-io.js';
import { applyAvailabilityToCard } from '../cwl/cwl-availability.js';
import { getCardTag, normalizePlayer, normalizeTag, plannerHasPlayer, uniquePlayers } from '../cwl/cwl-utils.js';

function createPlayerCard(playerInfo, clanuuid) {
    const players = uniquePlayers(playerInfo);
    let plannerChanged = false;

    players.forEach(player => {
        const target = getPlayerTarget(clanuuid);
        if (!target?.container) return;
        if (target.isPlanner && plannerHasPlayer(player.tag)) return;

        const element = buildPlayerElement(player, target);
        target.container.appendChild(element);

        if (target.isPlanner) {
            makePlayerDraggable(element);
            attachDeleteButton(element);
            applyAvailabilityToCard(element);
            plannerChanged = true;
        }
    });

    if (plannerChanged) {
        updateAllPlayerCounters();
        rememberPlannerPlayers();
        window.dispatchEvent(new CustomEvent('clashtools:cwl-player-added'));
        savePlan();
    }
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
    element.querySelector('.cwl-player-townhall-foto').src = `../assets/css/pictures/townhalls/Town_Hall${normalized.townHallLevel}.png`;
    element.querySelector('.cwl-player-hashtag').textContent = normalized.tag;
    element.querySelector('.cwl-player-name').textContent = normalized.name;
    element.querySelector('.cwl-player-clan').textContent = normalized.clanName || 'No clan';
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

function attachDeleteButton(element) {
    if (element.querySelector('.cwl-delete-player')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cwl-delete-player';
    button.title = 'Speler verwijderen';
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
        townHall: Number(player.dataset.townHall || 1)
    })).filter(player => player.tag);
    localStorage.setItem('clashtools_last_planner_players', JSON.stringify(players));
}

function createClanCard(clanInfo, playerAmount, uuid = '') {
    const clanTag = normalizeTag(clanInfo?.tag);
    if (clanTag && document.querySelector(`.cwl-clan-article[data-clan-tag="${CSS.escape(clanTag)}"]`)) return;

    const clanTemplate = document.querySelector('#cwl-clan-template');
    const clanTemplateClone = clanTemplate.content.cloneNode(true);
    const article = clanTemplateClone.querySelector('article');
    const clanUuid = uuid || crypto.randomUUID();

    clanTemplateClone.querySelector('.cwl-clan-logo').src = clanInfo?.badgeUrls?.small || '../assets/css/pictures/default-clan-banner.png';
    clanTemplateClone.querySelector('.cwl-clan-name').textContent = clanInfo?.name || clanTag || 'Clan';
    clanTemplateClone.querySelector('.cwl-amount-of-players-in-clan').textContent = `0/${playerAmount || 15}`;
    clanTemplateClone.querySelector('.cwl-amount-of-players-in-clan').id = 'cwl-clan-playeramount-template-' + (document.querySelector('#cwl-all-clans').children.length + 1);
    article.id = 'cwl-clan-template_' + clanUuid;
    article.dataset.clanTag = clanTag;
    article.dataset.clanName = clanInfo?.name || '';

    clanTemplateClone.querySelector('.cwl-delete-clan').addEventListener('click', event => {
        const currentArticle = event.target.closest('article');
        currentArticle.querySelectorAll('.cwl-player-article[data-planner-card="true"]').forEach(player => {
            document.querySelector('#cwl-available-players').appendChild(player);
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
    let startLeft, startTop;
    let dragging = false;
    element.originalContainer = element.parentElement;
    element.classList.add('draggable');

    element.addEventListener('mousedown', event => {
        if (event.target.closest('.cwl-delete-player')) return;
        event.preventDefault();
        event.stopPropagation();
        if (dragging) return;
        dragging = true;
        element.originalContainer = element.parentElement;

        const rect = element.getBoundingClientRect();
        startLeft = rect.left + window.scrollX;
        startTop = rect.top + window.scrollY;
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;

        element.style.position = 'absolute';
        element.style.left = startLeft + 'px';
        element.style.top = startTop + 'px';
        element.style.zIndex = '1000';
        document.body.appendChild(element);

        const onMouseMove = moveEvent => {
            element.style.left = (moveEvent.clientX - offsetX + window.scrollX) + 'px';
            element.style.top = (moveEvent.clientY - offsetY + window.scrollY) + 'px';
        };

        const onMouseUp = upEvent => {
            dragging = false;
            const lists = document.querySelectorAll('.cwl-clan-player-list, #cwl-available-players');
            let dropped = false;

            lists.forEach(list => {
                const listRect = list.getBoundingClientRect();
                if (upEvent.clientX >= listRect.left && upEvent.clientX <= listRect.right &&
                    upEvent.clientY >= listRect.top && upEvent.clientY <= listRect.bottom) {
                    list.appendChild(element);
                    element.originalContainer = list;
                    dropped = true;
                }
            });

            if (!dropped) element.originalContainer.appendChild(element);

            element.style.position = '';
            element.style.left = '';
            element.style.top = '';
            element.style.zIndex = '';

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
        if (event.target.closest('.cwl-delete-clan') ||
            event.target.closest('.cwl-confirm-clan-is-full') ||
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

    document.querySelectorAll('.cwl-clan-article').forEach(clan => {
        const counter = clan.querySelector('.cwl-amount-of-players-in-clan');
        if (!counter) return;
        const max = counter.textContent.split('/')[1] || '15';
        const count = clan.querySelectorAll('.cwl-clan-player-list .cwl-player-article[data-planner-card="true"]').length;
        counter.textContent = `${count}/${max}`;
    });
}

export { createPlayerCard, createClanCard, updateAllPlayerCounters };
