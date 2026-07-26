import { t } from '../i18n/i18n.js';
import {
    escapeHtml,
    number
} from './operation-board-utils.js';

export function renderBonusAdvice(refs, roster = []) {
    refs.bonusList.replaceChildren();
    const ranked = [...roster]
        .map(player => ({
            ...player,
            bonusScore: number(
                player.difficultyAdjustedStars,
                number(player.stars, 0)
            ) * 120
                + number(player.destruction, 0) * Math.max(1, number(player.attacksUsed, 0))
                + number(player.attacksUsed, 0) * 25
                + number(player.defense?.rating, 0)
                    * 100
                    * Math.min(3, number(player.defense?.count, 0))
                + (player.planned ? 10 : 0)
                - number(player.missed, 0) * 180
                - (player.status === 'unplanned' ? 35 : 0)
        }))
        .sort((a, b) => b.bonusScore - a.bonusScore)
        .slice(0, 10);
    if (!ranked.length) {
        const item = document.createElement('li');
        item.textContent = t('op.noRoster');
        refs.bonusList.appendChild(item);
        return;
    }
    ranked.forEach(player => refs.bonusList.appendChild(renderBonusPlayer(player)));
}

function renderBonusPlayer(player) {
    const difficulty = player.attackDifficulty?.multiplier;
    const difficultyLabel = difficulty == null
        ? '—'
        : t(difficulty >= 1.12
            ? 'op.difficultyHigh'
            : difficulty <= 0.88
                ? 'op.difficultyLow'
                : 'op.difficultyMedium');
    const item = document.createElement('li');
    item.innerHTML = `
        <div class="op-bonus-content">
            <div class="op-bonus-player">
                <strong>${escapeHtml(player.name)}</strong>
                <span>TH${number(player.townHall, 0) || '-'} · ${escapeHtml(player.tag)}</span>
            </div>
            <div class="op-bonus-performance">
                <span title="${escapeHtml(t('op.stars'))}"><strong>${number(player.stars, 0)}★</strong></span>
                <span title="${escapeHtml(t('op.destruction'))}"><strong>${number(player.destruction, 0).toFixed(1)}%</strong></span>
                <span title="${escapeHtml(t('op.attacksUsed'))}"><strong>${number(player.attacksUsed, 0)}/${number(player.availableAttacks, 0)}</strong><small>${escapeHtml(t('op.attacks'))}</small></span>
                <span title="${escapeHtml(t('op.missed'))}"><strong>${number(player.missed, 0)}</strong><small>${escapeHtml(t('op.missed'))}</small></span>
                <span class="op-prediction-detail" title="${escapeHtml(t('op.attackDifficulty'))}"><strong>${escapeHtml(difficultyLabel)}</strong><small>${difficulty == null ? '—' : `${number(difficulty, 1).toFixed(2)}×`}</small></span>
                <span title="${escapeHtml(t('op.defense'))}"><strong>${player.defense?.stars == null ? '—' : `${number(player.defense.stars, 0).toFixed(2)}★ · ${number(player.defense.destruction, 0).toFixed(1)}%`}</strong><small>${escapeHtml(t('op.defenseShort'))}</small></span>
            </div>
        </div>`;
    return item;
}
