import { t } from '../i18n/i18n.js?v=20260811-2';
import { displayArmyUnits, presentArmy } from './advanced-stats-army-view.js?v=20260811-2';
import { entityImage } from './progress-asset-view.js?v=20260811-2';
import { formatDecimal, formatNumber, formatPercent } from './advanced-stats-formatters.js?v=20260811-2';

function setVisibility(element, visible) {
    if (element) element.hidden = !visible;
}

export function visibleArmies(state) {
    const armies = Array.isArray(state.armies) ? state.armies : [];
    return armies
        .map(army => ({
            army,
            presentation: presentArmy(army?.army, state.unitCatalog, t('advancedStats.armyComposition'))
        }))
        .filter(item => item.presentation.units.length);
}

function createArmyHeader(presentation, army, index) {
    const heading = document.createElement('h3');
    heading.textContent = `${index + 1}. ${presentation.label}`;
    const meta = document.createElement('span');
    meta.textContent = t('advancedStats.armyUses', { count: formatNumber(army.battleCount) });
    const header = document.createElement('header');
    header.append(heading, meta);
    return header;
}

function createArmyUnitChip(unit) {
    const chip = document.createElement('span');
    chip.className = 'advanced-stats__unit-chip';
    chip.append(
        entityImage(unit.name, { alt: '' }),
        document.createTextNode(`${formatNumber(unit.quantity)}× ${unit.name}`)
    );
    return chip;
}

function createArmyCard(entry, index, state) {
    const { army, presentation } = entry;
    const card = document.createElement('article');
    card.className = 'advanced-stats__army-card';
    const units = document.createElement('div');
    units.className = 'advanced-stats__army-units';
    displayArmyUnits(army.army, state.unitCatalog).slice(0, 14)
        .forEach(unit => units.append(createArmyUnitChip(unit)));
    const metrics = document.createElement('p');
    metrics.textContent = `${formatDecimal(army.averageStars)} · ${formatPercent(army.averageDestruction)}`;
    card.append(createArmyHeader(presentation, army, index), units, metrics);
    return card;
}

export function renderArmies(elements, state) {
    const root = elements.armies;
    const armies = visibleArmies(state);
    root.replaceChildren();
    armies.forEach((entry, index) => root.append(createArmyCard(entry, index, state)));

    const hasArmies = armies.length > 0;
    setVisibility(elements.armiesEmpty, !hasArmies);
    if (!hasArmies) {
        elements.armiesEmpty.textContent = state.sectionStates.armies === 'error'
            ? t('advancedStats.loadFailed')
            : t('advancedStats.noArmies');
    }
}
