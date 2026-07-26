import { number } from './operation-board-utils.js';

const LOW_RELIABILITY = 85;

export function matchesRosterView(player, view = 'all') {
    if (view === 'planned') return Boolean(player.planned);
    if (view === 'unplanned') {
        return player.status === 'unplanned' || player.status === 'apiOnly';
    }
    if (view === 'missed') return number(player.missed, 0) > 0;
    if (view === 'attention') return playerNeedsAttention(player);
    if (view.startsWith('day:')) {
        const day = number(view.split(':')[1], 0);
        return Boolean(player.dayStats?.[day]?.warParticipant);
    }
    return true;
}

export function playerNeedsAttention(player) {
    const historical = player.insight?.historical;
    return number(player.missed, 0) > 0
        || historical?.status === 'ready'
        && (
            historical.reliability != null
            && number(historical.reliability, 100) < LOW_RELIABILITY
            || historical.form?.trend === 'declining'
        );
}
