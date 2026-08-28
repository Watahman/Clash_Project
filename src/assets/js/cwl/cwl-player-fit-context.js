import { scorePlayerForClan } from './auto-plan/cwl-auto-plan-scoring.js';

export function getPlayerFitContext(card, performance, root = document) {
    if (!card) return null;
    const assignedClan = card.closest('.cwl-clan-article');
    if (assignedClan) {
        const fit = fitFor(card, assignedClan, performance);
        return fit ? { mode: 'assigned', fits: [fit] } : null;
    }
    if (!card.closest('#cwl-available-players')) return null;
    const fits = Array.from(root.querySelectorAll('.cwl-clan-article'))
        .map(clan => fitFor(card, clan, performance))
        .filter(Boolean)
        .sort((left, right) => right.fit - left.fit || left.clanName.localeCompare(right.clanName))
        .slice(0, 3);
    return fits.length ? { mode: 'free', fits } : null;
}

function fitFor(card, clanCard, performance) {
    const clan = readClan(clanCard);
    if (!clan.id && !clan.tag && !clan.name) return null;
    const player = {
        ...(card._cwlPlayer || {}),
        tag: card.dataset.playerTag,
        townHallLevel: Number(card.dataset.townHall) || 1,
        playerPriority: card.dataset.playerPriority || 'normal',
        performance
    };
    return {
        clanId: clan.id || clan.tag,
        clanName: clan.name || clan.tag,
        fit: scorePlayerForClan(player, clan).fit
    };
}

function readClan(clanCard) {
    const capacity = clanCard.querySelector('.cwl-clan-capacity')?.value
        || clanCard.dataset.clanCapacity;
    return {
        id: String(clanCard.id || '').replace(/^cwl-clan-template_/, ''),
        tag: clanCard.dataset.clanTag || '',
        name: clanCard.dataset.clanName
            || clanCard.querySelector('.cwl-clan-name')?.textContent?.trim()
            || clanCard.dataset.clanTag
            || '',
        league: clanCard.dataset.clanLeague || '',
        capacity: Number(capacity) === 30 ? 30 : 15,
        clanPriority: clanCard.dataset.clanPriority || 'auto'
    };
}
