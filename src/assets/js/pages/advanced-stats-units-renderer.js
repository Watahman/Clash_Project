import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { isPlayerFacingUnitName } from './advanced-stats-army-view.js?v=20260811-2';
import { entityImage } from './progress-asset-view.js?v=20260811-2';
import { formatNumber, formatPercent } from './advanced-stats-formatters.js?v=20260829-public-auth-v1';

function setVisibility(element, visible) {
    if (element) element.hidden = !visible;
}

function textElement(tag, value) {
    const element = document.createElement(tag);
    element.textContent = value;
    return element;
}

function tableCell(value) {
    const cell = document.createElement('td');
    if (value?.nodeType) cell.append(value);
    else cell.textContent = value;
    return cell;
}

function unitDisplayName(unit) {
    return String(unit?.name || unit?.unitName || '').trim();
}

function numericValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function mergeUnitRecord(target, unit) {
    target.totalQuantity += Math.max(0, numericValue(unit.totalQuantity));
    target.battlesPresent += Math.max(0, numericValue(unit.battlesPresent));
    target.usageRate = Math.max(target.usageRate, Math.max(0, numericValue(unit.usageRate)));
}

function mergedUnits(units) {
    const grouped = new Map();
    units.forEach(unit => {
        const name = unitDisplayName(unit);
        if (!isPlayerFacingUnitName(name)) return;
        const key = name.toLocaleLowerCase();
        const existing = grouped.get(key);
        if (existing) mergeUnitRecord(existing, unit);
        else grouped.set(key, {
            ...unit,
            name,
            totalQuantity: Math.max(0, numericValue(unit.totalQuantity)),
            battlesPresent: Math.max(0, numericValue(unit.battlesPresent)),
            usageRate: Math.max(0, numericValue(unit.usageRate))
        });
    });

    return [...grouped.values()].map(unit => ({
        ...unit,
        usageRate: Math.min(100, unit.usageRate)
    })).sort((left, right) => right.totalQuantity - left.totalQuantity || right.battlesPresent - left.battlesPresent || left.name.localeCompare(right.name));
}

function ensureUnitUsageScopeNote() {
    const title = document.getElementById('advanced-stats-units-title');
    const headingCopy = title?.parentElement;
    if (!headingCopy || headingCopy.querySelector('[data-unit-usage-scope-note]')) return;
    const note = document.createElement('p');
    note.dataset.unitUsageScopeNote = '';
    note.className = 'advanced-stats__unit-scope-note';
    note.textContent = 'Multiplayer data only. War & CWL unit compositions are unavailable and are excluded from Unit Usage.';
    headingCopy.append(note);
}

function unitNameElement(unit) {
    const name = unitDisplayName(unit) || t('advancedStats.unit');
    const element = document.createElement('div');
    element.className = 'advanced-stats__unit-name';
    element.append(entityImage(name, { alt: '' }), document.createTextNode(name));
    return { element, name };
}

function unitTableRow(unit) {
    const { element, name } = unitNameElement(unit);
    const row = document.createElement('tr');
    row.append(
        tableCell(element),
        tableCell(formatNumber(unit.totalQuantity)),
        tableCell(formatNumber(unit.battlesPresent)),
        tableCell(formatPercent(unit.usageRate))
    );
    return { row, name };
}

function unitMobileCard(unit, name) {
    const item = document.createElement('article');
    item.className = 'advanced-stats__unit-item';
    const heading = document.createElement('h3');
    heading.append(entityImage(name, { alt: '' }), document.createTextNode(name));
    const metrics = document.createElement('dl');
    const values = [
        ['advancedStats.quantity', formatNumber(unit.totalQuantity)],
        ['advancedStats.battlesPresent', formatNumber(unit.battlesPresent)],
        ['advancedStats.usageRate', formatPercent(unit.usageRate)]
    ];
    values.forEach(([label, value]) => {
        const metric = document.createElement('div');
        metric.append(textElement('dt', t(label)), textElement('dd', value));
        metrics.append(metric);
    });
    item.append(heading, metrics);
    return item;
}

export function renderUnits(elements, state) {
    ensureUnitUsageScopeNote();
    const units = mergedUnits(Array.isArray(state.units) ? state.units : []);
    elements.units.replaceChildren();
    elements.unitsMobile.replaceChildren();
    units.forEach(unit => {
        const { row, name } = unitTableRow(unit);
        elements.units.append(row);
        elements.unitsMobile.append(unitMobileCard(unit, name));
    });

    const hasUnits = units.length > 0;
    setVisibility(elements.unitsTableWrap, hasUnits);
    setVisibility(elements.unitsEmpty, !hasUnits);
    if (!hasUnits) {
        elements.unitsEmpty.textContent = state.sectionStates.units === 'error'
            ? t('advancedStats.loadFailed')
            : t('advancedStats.noUnits');
    }
}
