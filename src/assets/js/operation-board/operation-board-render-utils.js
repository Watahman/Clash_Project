import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { escapeHtml } from './operation-board-utils.js';

export function stateText(state = 'unknown') {
    if (state === 'completed') return t('op.stateCompleted');
    if (state === 'live') return t('op.stateLive');
    if (state === 'preparation') return t('op.statePreparation');
    if (state === 'notStarted' || state === 'notAvailable') {
        return t('op.stateNotStarted');
    }
    return t('op.stateUnknown');
}

export function resultText(result) {
    if (result === 'win') return t('op.resultWin');
    if (result === 'loss') return t('op.resultLoss');
    if (result === 'draw') return t('op.resultDraw');
    if (result === 'notStarted' || result === 'notAvailable') {
        return t('op.stateNotStarted');
    }
    return t('op.resultPending');
}

export function option(value, text, config = {}) {
    const element = document.createElement('option');
    element.value = value;
    element.textContent = text;
    if (config.disabled) element.disabled = true;
    if (config.selected) element.selected = true;
    return element;
}

export function badge(text, kind = 'muted') {
    return `<span class="op-badge op-badge-${kind}">${escapeHtml(text)}</span>`;
}

export function chip(text) {
    const element = document.createElement('span');
    element.textContent = text;
    return element;
}
