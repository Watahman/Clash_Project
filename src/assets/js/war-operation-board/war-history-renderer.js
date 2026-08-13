import { escapeHtml, number } from '../operation-board/operation-board-utils.js';
import { getLanguage } from '../i18n/i18n.js';
import { competeT as t } from '../operation-board/compete-locales.js';

const RESULT_CLASSES = new Set(['draw', 'loss', 'win']);

export function renderWarHistory(summaryElement, listElement, history) {
    const summary = history?.summary || {};
    summaryElement.innerHTML = [
        metric(t('war.winRate'), summary.winRate == null ? '—' : `${number(summary.winRate).toFixed(0)}%`),
        metric(t('war.record'), t('war.recordFormat', {
            wins: number(summary.wins),
            losses: number(summary.losses),
            draws: number(summary.draws)
        })),
        metric(t('war.avgStars'), summary.avgStars == null ? '—' : number(summary.avgStars).toFixed(1)),
        metric(t('war.avgAttackUse'), summary.avgUsage == null ? '—' : `${number(summary.avgUsage).toFixed(0)}%`)
    ].join('');

    const wars = history?.wars || [];
    listElement.innerHTML = wars.length
        ? wars.map(renderHistoryRow).join('')
        : `<p class="war-muted">${escapeHtml(t('war.noHistory'))}</p>`;
}

function renderHistoryRow(war) {
    return war?.isRegular !== false ? renderRegularRow(war) : renderExcludedRow(war);
}

function renderRegularRow(war) {
    return `<article class="war-history-row is-${resultClass(war.result)}">
        <span class="war-history-result">${escapeHtml(resultLabel(war.result))}</span>
        <span><strong>${escapeHtml(war.opponent.name || t('war.unknown'))}</strong><small>${dateLabel(war.endTime)} · ${teamSizeLabel(war.teamSize)}</small></span>
        <span><strong>${escapeHtml(t('war.historyScore', { own: number(war.own.stars), opponent: number(war.opponent.stars) }))}</strong><small>${number(war.own.destruction).toFixed(1)}% — ${number(war.opponent.destruction).toFixed(1)}%</small></span>
        <span><strong>${number(war.attackUsage).toFixed(0)}%</strong><small>${escapeHtml(t('war.attackUsage'))}</small></span>
    </article>`;
}

function renderExcludedRow(war) {
    const cwl = war?.isCwl;
    const prefix = cwl ? 'war.cwl' : 'war.grouped';
    const badge = cwl ? t('war.cwlBadge') : t('war.groupedBadge');
    const opponentName = war.opponent.name
        || t(cwl ? 'war.cwlOpponentUnknown' : 'war.unknown');
    return `<article class="war-history-row is-${cwl ? 'cwl' : 'grouped'}">
        <span class="war-history-result war-history-type">${escapeHtml(badge)}</span>
        <span><strong>${escapeHtml(opponentName)}</strong><small>${dateLabel(war.endTime)} · ${teamSizeLabel(war.teamSize)}</small></span>
        <span class="war-history-cwl-summary"><strong>${escapeHtml(t(`${prefix}HistoryTitle`))}</strong><small>${escapeHtml(t(`${prefix}HistoryCopy`))}</small></span>
        <span class="war-history-cwl-meta"><strong>${escapeHtml(t(`${prefix}HistoryTotal`, { own: number(war.own.stars), opponent: number(war.opponent.stars) }))}</strong><small>${escapeHtml(t('war.historyExcluded'))}</small></span>
    </article>`;
}

function resultLabel(result) {
    return t(result === 'win'
        ? 'war.resultWinShort'
        : result === 'loss' ? 'war.resultLossShort' : 'war.resultDrawShort');
}

function resultClass(result) {
    return RESULT_CLASSES.has(String(result)) ? String(result) : 'draw';
}

function metric(label, value) {
    return `<article><small>${escapeHtml(label)}</small><strong>${value}</strong></article>`;
}

function teamSizeLabel(teamSize) {
    const size = number(teamSize, 0);
    return size > 0 ? `${size}v${size}` : t('war.unknown');
}

function dateLabel(value) {
    if (!value) return t('war.dateUnavailable');
    const compact = String(value).match(/^(\d{4})(\d{2})(\d{2})T/);
    const date = compact
        ? new Date(`${compact[1]}-${compact[2]}-${compact[3]}T00:00:00Z`)
        : new Date(value);
    return Number.isNaN(date.getTime())
        ? t('war.dateUnavailable')
        : new Intl.DateTimeFormat(getLanguage(), { dateStyle: 'medium' }).format(date);
}
