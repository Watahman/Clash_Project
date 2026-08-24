import { savePlan } from './cwl-plan-io.js';
import { applyAvailabilityToCard } from './cwl-availability.js';
import { normalizeTag } from './cwl-utils.js';
import { allowsThirtyPlayerCwl, normalizeCwlCapacity } from './cwl-league-rules.js';
import { t } from '../i18n/i18n.js';
import { syncPlayerRosterStatus } from './cwl-player-controls.js';
import {
    rememberPlannerPlayers,
    updateAllPlayerCounters,
    updateClanCapacityCounter
} from './cwl-planner-card-state.js';
import { ASSET_FALLBACKS, installImageFallback } from '../assets/entity-assets.js';
import { isRedesignFixtureRequested } from '../fixtures/redesign-fixture-mode.js';

export function applyClanLeagueRestriction(article, leagueName, options = {}) {
    const select = article?.querySelector('.cwl-clan-capacity');
    const thirtyOption = select?.querySelector('option[value="30"]');
    if (!select || !thirtyOption) return false;

    const allowThirty = allowsThirtyPlayerCwl(leagueName);
    article.dataset.clanLeague = leagueName || '';
    thirtyOption.disabled = !allowThirty;
    thirtyOption.textContent = allowThirty ? '30v30' : t('cwl.thirtyUnavailableOption');
    select.title = allowThirty
        ? ''
        : t('cwl.thirtyUnavailableForLeague', {
            league: leagueName || t('cwl.thisLeague')
        });

    const changed = !allowThirty && select.value === '30';
    if (changed) {
        select.value = '15';
        updateClanCapacityCounter(article);
        if (options.persist !== false) savePlan();
    }
    return changed;
}

export function createClanCard(clanInfo, playerAmount, uuid = '', options = {}) {
    const persist = options.persist !== false && !isRedesignFixtureRequested();
    const clanTag = normalizeTag(clanInfo?.tag);
    const clanName = clanInfo?.name || clanTag || t('cwl.clan');
    const leagueName = clanInfo?.warLeague?.name || '';
    const capacity = normalizeCwlCapacity(playerAmount, leagueName);
    const template = document.querySelector('#cwl-clan-template').content.cloneNode(true);
    const article = template.querySelector('article');
    const clanUuid = uuid || crypto.randomUUID();

    const logo = template.querySelector('.cwl-clan-logo');
    logo.src = clanInfo?.badgeUrls?.small || ASSET_FALLBACKS.clan;
    logo.alt = clanName;
    installImageFallback(logo, ASSET_FALLBACKS.clan);
    template.querySelector('.cwl-clan-name').textContent = clanName;
    template.querySelector('.cwl-clan-tag').textContent = clanTag;
    template.querySelector('.cwl-clan-league').textContent =
        leagueName ? ` · ${leagueName}` : '';
    const counter = template.querySelector('.cwl-amount-of-players-in-clan');
    counter.textContent = `0/${capacity}`;
    counter.id = `cwl-clan-playeramount-template-${
        document.querySelector('#cwl-all-clans').children.length + 1
    }`;

    const capacitySelect = template.querySelector('.cwl-clan-capacity');
    template.querySelector('.cwl-clan-format > span').textContent = t('planner.format');
    capacitySelect.value = String(capacity);
    capacitySelect.setAttribute('aria-label', t('planner.format'));
    capacitySelect.addEventListener('change', () => {
        article.dataset.clanCapacity = capacitySelect.value;
        updateClanCapacityCounter(article);
        savePlan();
    });

    article.id = `cwl-clan-template_${clanUuid}`;
    article.dataset.clanTag = clanTag;
    article.dataset.clanName = clanName;
    article.dataset.clanLeague = leagueName;
    article.dataset.clanCapacity = String(capacity);
    applyClanLeagueRestriction(article, leagueName, { persist: false });
    attachDeleteClan(template.querySelector('.cwl-delete-clan'));

    document.querySelector('#cwl-all-clans').appendChild(template);
    if (persist && clanInfo?.name && clanTag) localStorage.setItem(`clanId_${clanInfo.name}`, clanTag);
    makeClanDraggable(document.querySelector('#cwl-all-clans').lastElementChild);
    updateAllPlayerCounters();
    if (persist) savePlan();
}

function attachDeleteClan(button) {
    button.title = t('cwl.deleteClan');
    button.setAttribute('aria-label', t('cwl.deleteClan'));
    button.addEventListener('click', event => {
        const article = event.target.closest('article');
        article.querySelectorAll(
            '.cwl-player-article[data-planner-card="true"]'
        ).forEach(player => {
            document.querySelector('#cwl-available-players').appendChild(player);
            syncPlayerRosterStatus(player);
            applyAvailabilityToCard(player);
        });
        article.remove();
        updateAllPlayerCounters();
        rememberPlannerPlayers();
        window.dispatchEvent(new CustomEvent('clashtools:cwl-player-added'));
        savePlan();
    });
}

function makeClanDraggable(article) {
    const handle = article.querySelector('.cwl-clan-info-card');
    handle.style.cursor = 'grab';
    let dragging = false;
    let placeholder;
    let offsetX;
    let offsetY;

    handle.addEventListener('mousedown', event => {
        if (
            event.target.closest('.cwl-delete-clan, .cwl-clan-capacity')
            || event.target.closest('.cwl-player-article')
        ) return;
        event.preventDefault();
        if (dragging) return;
        dragging = true;

        const container = document.querySelector('#cwl-all-clans');
        const rect = article.getBoundingClientRect();
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;
        placeholder = document.createElement('div');
        Object.assign(placeholder.style, {
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            border: '2px dashed var(--border-focus)',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--accent-glow)',
            flexShrink: '0'
        });
        container.insertBefore(placeholder, article);
        Object.assign(article.style, {
            position: 'fixed',
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            zIndex: '500',
            opacity: '0.92',
            boxShadow: 'var(--shadow-lg)',
            pointerEvents: 'none'
        });
        document.body.appendChild(article);

        const onMouseMove = moveEvent => {
            article.style.left = `${moveEvent.clientX - offsetX}px`;
            article.style.top = `${moveEvent.clientY - offsetY}px`;
            const target = document.elementFromPoint(
                moveEvent.clientX, moveEvent.clientY
            )?.closest('.cwl-clan-article');
            if (target && target !== article) {
                const targetRect = target.getBoundingClientRect();
                const before = moveEvent.clientX < targetRect.left + targetRect.width / 2;
                container.insertBefore(placeholder, before ? target : target.nextSibling);
            }
        };
        const onMouseUp = () => {
            dragging = false;
            for (const property of [
                'position', 'left', 'top', 'width', 'z-index',
                'opacity', 'box-shadow', 'pointer-events'
            ]) {
                article.style.removeProperty(property);
            }
            container.insertBefore(article, placeholder);
            placeholder.remove();
            savePlan();
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}
