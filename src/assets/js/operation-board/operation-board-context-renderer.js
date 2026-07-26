import { t } from '../i18n/i18n.js';
import { getCurrentCwlDay } from './operation-board-live-model.js';
import { normalizeTag } from './operation-board-utils.js';

export function renderBoardContext(
    refs,
    report,
    selectedClan = null,
    { lastSyncAt = null, syncState = 'idle' } = {}
) {
    const clan = report?.clan || selectedClan;
    if (!report || !clan?.tag) {
        refs.boardContext.hidden = true;
        refs.boardContext.replaceChildren();
        return;
    }
    const parts = [
        clan.name || normalizeTag(clan.tag),
        normalizeTag(clan.tag)
    ];
    if (clan.standalone) {
        parts.push(t('op.singleClanContext'));
    } else {
        const day = getCurrentCwlDay(report);
        if (day) parts.push(t('op.cwlDayContext', { day }));
        if (syncState === 'ready' && lastSyncAt) {
            parts.push(relativeSync(lastSyncAt));
        }
    }
    refs.boardContext.replaceChildren(
        ...parts.map(part => {
            const item = document.createElement('span');
            item.textContent = part;
            return item;
        })
    );
    refs.boardContext.hidden = false;
}

function relativeSync(lastSyncAt) {
    const seconds = Math.max(
        0,
        Math.floor((Date.now() - new Date(lastSyncAt).getTime()) / 1000)
    );
    if (seconds < 60) return t('op.syncedNow');
    if (seconds < 3600) {
        return t('op.syncedMinutesAgo', { count: Math.floor(seconds / 60) });
    }
    return t('op.syncedHoursAgo', { count: Math.floor(seconds / 3600) });
}
