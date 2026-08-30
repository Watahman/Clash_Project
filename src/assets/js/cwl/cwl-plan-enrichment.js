import { getClanInfoRequest } from '../API/API-Clan.js?v=20260829-public-auth-v1';
import { getPlayerBasicData } from '../API/API-Functions.js?v=20260829-public-auth-v1';
import { applyClanLeagueRestriction } from '../templates/CWLTemplates.js?v=20260830-player-drag-v3';
import { getTownHallAsset, installImageFallback } from '../assets/entity-assets.js';
import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { normalizePlanDocument } from './cwl-plan-schema.js';
import { escapeCssIdentifier, getCardTag, normalizeTag } from './cwl-utils.js';

const ENRICH_CONCURRENCY = 6;

function needsPlayerEnrichment(player) {
    const tag = normalizeTag(player?.tag);
    const name = String(player?.name || '').trim();
    const townHallLevel = Number(player?.townHallLevel);

    return Boolean(tag) && (
        !name ||
        name === tag ||
        !Number.isFinite(townHallLevel) ||
        townHallLevel < 1
    );
}

export async function enrichPlanSnapshot(info, { token, signal, isCurrent } = {}) {
    const planDocument = normalizePlanDocument(info);
    const playerTags = new Set(
        [
            ...planDocument.freePlayers,
            ...planDocument.clans.flatMap(clan => clan.players)
        ]
            .filter(needsPlayerEnrichment)
            .map(player => normalizeTag(player.tag))
            .filter(Boolean)
    );
    const clanTasks = planDocument.clans
        .filter(clan => normalizeTag(clan?.tag))
        .map(clan => () => enrichClan(clan, token, signal, isCurrent));
    const playerTasks = [...playerTags]
        .map(tag => () => enrichPlayer(tag, token, signal, isCurrent));

    await runLimited([...clanTasks, ...playerTasks], ENRICH_CONCURRENCY);
}

async function enrichPlayer(tag, token, signal, isCurrent) {
    try {
        const data = await getPlayerBasicData(tag, { signal });
        if (!isCurrent?.(token)) return;
        const normalizedTag = normalizeTag(tag);
        const cards = Array.from(
            document.querySelectorAll('.cwl-player-article[data-planner-card="true"]')
        ).filter(element => getCardTag(element) === normalizedTag);

        cards.forEach(card => {
            const name = card.querySelector('.cwl-player-name');
            const clan = card.querySelector('.cwl-player-clan');
            const townHallLevel = Number(data.townHallLevel) || 1;

            if (name) name.textContent = data.name || tag;
            if (clan) clan.textContent = data.clanName || t('cwl.noClan');
            card.dataset.townHall = String(townHallLevel);

            const image = card.querySelector('.cwl-player-townhall-foto');
            if (image) {
                image.src = getTownHallAsset(townHallLevel);
                installImageFallback(image);
            }
        });
    } catch (error) {
        if (error?.name !== 'AbortError') return;
    }
}

async function enrichClan(clan, token, signal, isCurrent) {
    try {
        const data = await getClanInfoRequest(clan.tag, { signal });
        if (!isCurrent?.(token)) return;
        const card = document.querySelector(`#cwl-clan-template_${escapeCssIdentifier(clan.id)}`);
        if (!card) return;
        const clanName = data.name || clan.name || clan.tag || t('cwl.clan');
        const clanTag = normalizeTag(data.tag || clan.tag);
        const leagueName = data?.warLeague?.name || '';
        card.dataset.clanName = clanName;
        card.dataset.clanTag = clanTag;
        card.querySelector('.cwl-clan-name').textContent = clanName;
        card.querySelector('.cwl-clan-tag').textContent = clanTag;
        card.querySelector('.cwl-clan-league').textContent = leagueName ? ` · ${leagueName}` : '';
        applyClanLeagueRestriction(card, leagueName, { persist: false });
        const badge = data?.badgeUrls?.small;
        const logo = card.querySelector('.cwl-clan-logo');
        if (badge) logo.src = badge;
        logo.alt = clanName;
    } catch (error) {
        if (error?.name !== 'AbortError') return;
    }
}

async function runLimited(tasks, concurrency) {
    let cursor = 0;
    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
        while (cursor < tasks.length) {
            const task = tasks[cursor++];
            await task();
        }
    });
    await Promise.allSettled(workers);
}
