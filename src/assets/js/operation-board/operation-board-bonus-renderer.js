import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { buildBonusCalculator } from './operation-board-bonus-calculator.js';
import { BONUS_STRATEGIES } from './operation-board-bonus-strategies.js';
import {
    escapeHtml,
    number
} from './operation-board-utils.js';

const stateByRoot = new WeakMap();

export function renderBonusCalculator(refs, report = {}) {
    if (!refs.bonusList) return;
    const root = refs.bonusPanel || refs.bonusList;
    const key = `${report.clan?.tag || ''}:${report.leagueGroup?.season || ''}`;
    let state = stateByRoot.get(root);
    if (!state || state.key !== key) {
        state = {
            key,
            strategy: 'fair',
            customWeights: { ...BONUS_STRATEGIES.fair },
            recipientCount: null,
            selectedTag: null
        };
        stateByRoot.set(root, state);
    }
    const calculator = buildBonusCalculator(report, state);
    if (!calculator.players.some(player => player.tag === state.selectedTag)) {
        state.selectedTag = calculator.players[0]?.tag || null;
    }
    syncControls(refs, report, state, calculator);
    renderRanking(refs, state, calculator);
    renderDetail(refs, calculator, state.selectedTag);
}

export function clearBonusCalculator(refs) {
    refs.bonusList?.replaceChildren();
    if (refs.bonusDetail) {
        refs.bonusDetail.textContent = t('op.bonusSelectPlayer');
    }
    if (refs.bonusRecipientCount) refs.bonusRecipientCount.value = '';
    if (refs.bonusRecipientSource) refs.bonusRecipientSource.textContent = '';
    if (refs.bonusProvisional) refs.bonusProvisional.hidden = true;
}

function syncControls(refs, report, state, calculator) {
    refs.bonusStrategyButtons?.forEach(button => {
        const selected = button.dataset.bonusStrategy === state.strategy;
        button.setAttribute('aria-pressed', String(selected));
        button.onclick = () => {
            state.strategy = button.dataset.bonusStrategy;
            renderBonusCalculator(refs, report);
        };
    });
    if (refs.bonusCustomWeights) {
        refs.bonusCustomWeights.hidden = state.strategy !== 'custom';
    }
    Object.entries(refs.bonusWeightInputs || {}).forEach(([component, input]) => {
        input.value = state.customWeights[component];
        input.onchange = () => {
            state.customWeights[component] = Math.min(
                100,
                Math.max(0, Math.round(number(input.value, 0)))
            );
            renderBonusCalculator(refs, report);
        };
    });
    if (refs.bonusWeightTotal) {
        refs.bonusWeightTotal.textContent = t('op.bonusWeightTotal', {
            total: calculator.weightTotal
        });
        refs.bonusWeightTotal.dataset.state = calculator.weightsValid
            ? 'valid'
            : 'invalid';
    }
    syncRecipients(refs, report, state, calculator);
    if (refs.bonusProvisional) {
        refs.bonusProvisional.hidden = !calculator.provisional;
    }
}

function syncRecipients(refs, report, state, calculator) {
    if (!refs.bonusRecipientCount) return;
    const recipients = calculator.recipients;
    refs.bonusRecipientCount.readOnly = !recipients.editable;
    refs.bonusRecipientCount.value = recipients.count ?? '';
    refs.bonusRecipientCount.setAttribute(
        'aria-invalid',
        String(recipients.count == null)
    );
    const commitRecipients = () => {
        const value = refs.bonusRecipientCount.value.trim();
        state.recipientCount = value === ''
            ? null
            : Math.max(0, Math.round(number(value, 0)));
        renderBonusCalculator(refs, report);
    };
    refs.bonusRecipientCount.onchange = commitRecipients;
    refs.bonusRecipientCount.onkeydown = event => {
        if (event.key === 'Enter') commitRecipients();
    };
    if (refs.bonusRecipientSource) {
        refs.bonusRecipientSource.textContent = recipients.source === 'config'
            ? t('op.bonusRecipientsConfig')
            : recipients.count == null
                ? t('op.bonusRecipientsUnset')
                : t('op.bonusRecipientsManual');
    }
}

function renderRanking(refs, state, calculator) {
    refs.bonusList.replaceChildren();
    if (!calculator.players.length) {
        const empty = document.createElement('li');
        empty.className = 'op-bonus-empty';
        empty.textContent = t('op.noRoster');
        refs.bonusList.appendChild(empty);
        return;
    }
    calculator.players.forEach((player, index) => {
        const item = document.createElement('li');
        item.className = [
            player.recommended ? 'is-recommended' : '',
            calculator.recipients.count != null
                && calculator.recipients.count > 0
                && index === calculator.recipients.count
                ? 'is-first-out'
                : ''
        ].filter(Boolean).join(' ');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'op-bonus-row';
        button.dataset.bonusTag = player.tag;
        button.setAttribute(
            'aria-pressed',
            String(state.selectedTag === player.tag)
        );
        button.innerHTML = `
            <span class="op-bonus-rank">${player.rank}</span>
            <span class="op-bonus-player">
                <strong>${escapeHtml(player.name)}</strong>
                <small>TH${player.townHall || '&mdash;'} &middot; ${escapeHtml(player.tag)}</small>
            </span>
            <strong class="op-bonus-score">${scoreText(player.score)}</strong>
            ${player.recommended
                ? `<span class="op-bonus-recommended">${escapeHtml(t('op.bonusRecommended'))}</span>`
                : ''}`;
        button.onclick = () => {
            state.selectedTag = player.tag;
            refs.bonusList.querySelectorAll('.op-bonus-row').forEach(row => {
                row.setAttribute(
                    'aria-pressed',
                    String(row.dataset.bonusTag === player.tag)
                );
            });
            renderDetail(refs, calculator, player.tag);
        };
        item.appendChild(button);
        refs.bonusList.appendChild(item);
    });
}

function renderDetail(refs, calculator, selectedTag) {
    if (!refs.bonusDetail) return;
    const player = calculator.players.find(item => item.tag === selectedTag);
    if (!player) {
        refs.bonusDetail.textContent = t('op.bonusSelectPlayer');
        return;
    }
    const rows = [
        ['op.bonusPerformance', player.subscores.performance],
        ['op.bonusContribution', player.subscores.contribution],
        ['op.bonusReliability', player.subscores.reliability],
        ['op.bonusDefense', player.subscores.defense]
    ];
    refs.bonusDetail.innerHTML = `
        <div class="op-bonus-detail-header">
            <div><h3>${escapeHtml(player.name)}</h3><span>${escapeHtml(player.tag)}</span></div>
            <strong>${scoreText(player.score)}</strong>
        </div>
        <dl class="op-bonus-breakdown">
            ${rows.map(([label, value]) => `
                <div><dt>${escapeHtml(t(label))}</dt><dd>${Math.round(value)}</dd></div>
            `).join('')}
        </dl>
        <div class="op-bonus-explanation">
            <p>${escapeHtml(t('op.bonusPerformanceDetail', {
                stars: player.adjustedStars.toFixed(1),
                attacks: player.attacks
            }))}</p>
            <p>${escapeHtml(player.contributionTracked
                ? t('op.bonusContributionDetail', {
                    stars: player.netStars,
                    destruction: player.destructionImprovement.toFixed(1)
                })
                : t('op.bonusContributionUnavailable'))}</p>
            <p>${escapeHtml(t('op.bonusReliabilityDetail', {
                used: player.reliability.used,
                available: player.reliability.available,
                missed: player.reliability.missed
            }))}</p>
            <p>${escapeHtml(player.defense.count
                ? t('op.bonusDefenseDetail', {
                    stars: player.defense.stars.toFixed(2),
                    destruction: player.defense.destruction.toFixed(1),
                    count: player.defense.count
                })
                : t('op.bonusDefenseNeutral'))}</p>
            ${player.historical
                ? `<p class="op-bonus-history">${escapeHtml(t('op.bonusHistoricalContext', {
                    performance: Math.round(number(player.historical.performance, 0))
                }))}</p>`
                : ''}
        </div>`;
}

function scoreText(score) {
    return score == null ? '&mdash;' : number(score, 0).toFixed(1);
}
