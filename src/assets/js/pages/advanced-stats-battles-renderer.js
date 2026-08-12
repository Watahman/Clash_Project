import { t } from '../i18n/i18n.js?v=20260811-2';
import { entityImage } from './progress-asset-view.js?v=20260811-2';
import { isPlayerFacingUnitName } from './advanced-stats-army-view.js?v=20260811-2';
import { arrayValue, formatDateTime, formatNumber, formatPercent } from './advanced-stats-formatters.js?v=20260811-2';

function setVisibility(element, visible) {
    if (element) element.hidden = !visible;
}

function textElement(tag, value) {
    const element = document.createElement(tag);
    element.textContent = value;
    return element;
}

function battleMain(battle) {
    const main = document.createElement('div');
    main.className = 'advanced-stats__battle-main';
    main.append(
        textElement('strong', battle.opponentName || battle.opponentPlayerTag || t('advancedStats.opponent')),
        textElement('small', formatDateTime(battle.battleAt))
    );
    return main;
}

function battleScore(battle) {
    const score = document.createElement('div');
    score.className = 'advanced-stats__battle-score';
    const stars = document.createElement('strong');
    stars.className = 'advanced-stats__battle-stars';
    stars.textContent = `${formatNumber(battle.stars)} ★`;
    const destruction = document.createElement('span');
    destruction.className = 'advanced-stats__battle-destruction';
    destruction.textContent = formatPercent(battle.destructionPercentage);
    score.append(stars, destruction);
    return score;
}

function battleArmy(battle) {
    const units = arrayValue(battle.units)
        .filter(unit => isPlayerFacingUnitName(unit?.name || unit?.unitName));
    if (!units.length) return null;
    const army = document.createElement('div');
    army.className = 'advanced-stats__battle-army';
    units.slice(0, 12).forEach(unit => {
        const name = unit.name || unit.unitName || unit.key;
        const chip = document.createElement('span');
        chip.className = 'advanced-stats__unit-chip';
        chip.append(entityImage(name, { alt: '' }), document.createTextNode(`${formatNumber(unit.quantity)}× ${name}`));
        army.append(chip);
    });
    return army;
}

function battleElement(battle) {
    const item = document.createElement('article');
    item.className = 'advanced-stats__battle';
    const metaValue = battle.opponentTownHall ? `TH${battle.opponentTownHall}` : t('advancedStats.pending');
    const meta = textElement('span', metaValue);
    meta.className = 'advanced-stats__battle-meta';
    item.append(battleMain(battle), battleScore(battle), meta);
    const army = battleArmy(battle);
    if (army) item.append(army);
    return item;
}

export function renderBattles(elements, state) {
    const battles = Array.isArray(state.battles) ? state.battles.filter(Boolean) : [];
    elements.battles.replaceChildren();
    battles.forEach(battle => elements.battles.append(battleElement(battle)));
    setVisibility(elements.battlesEmpty, battles.length === 0);
    setVisibility(elements.loadMore, battles.length > 0 && state.hasMore);
}
