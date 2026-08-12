import { t } from '../i18n/i18n.js?v=20260811-2';
import { isPlayerFacingUnitName } from './advanced-stats-army-view.js?v=20260811-2';
import { entityImage } from './progress-asset-view.js?v=20260811-2';
import { formatNumber, formatPercent } from './advanced-stats-formatters.js?v=20260811-2';

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

function unitNameElement(unit) {
    const name = unit.name || unit.unitName || t('advancedStats.unit');
    const element = document.createElement('div');
    element.className = 'advanced-stats__unit-name';
    element.append(entityImage(name, { alt: '' }), document.createTextNode(name));
    return { element, name };
}

function normalizedUsageRate(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0;
}

function usageRateElement(value, { compact = false } = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = compact
        ? 'advanced-stats__usage-rate advanced-stats__usage-rate--compact'
        : 'advanced-stats__usage-rate';
    const label = document.createElement('strong');
    label.textContent = formatPercent(value);
    const track = document.createElement('span');
    track.className = 'advanced-stats__usage-track';
    track.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('span');
    fill.className = 'advanced-stats__usage-fill';
    fill.style.width = `${normalizedUsageRate(value)}%`;
    track.append(fill);
    wrapper.append(label, track);
    return wrapper;
}

function unitTableRow(unit) {
    const { element, name } = unitNameElement(unit);
    const row = document.createElement('tr');
    row.append(
        tableCell(element),
        tableCell(formatNumber(unit.totalQuantity)),
        tableCell(formatNumber(unit.battlesPresent)),
        tableCell(usageRateElement(unit.usageRate))
    );
    return { row, name };
}

function unitMobileCard(unit, name) {
    const item = document.createElement('article');
    item.className = 'advanced-stats__unit-item';
    const heading = document.createElement('h3');
    heading.append(entityImage(name, { alt: '' }), document.createTextNode(name));
    const usage = usageRateElement(unit.usageRate, { compact: true });
    const metrics = document.createElement('dl');
    const values = [
        ['advancedStats.battlesPresent', formatNumber(unit.battlesPresent)],
        ['advancedStats.quantity', formatNumber(unit.totalQuantity)]
    ];
    values.forEach(([label, value]) => {
        const metric = document.createElement('div');
        metric.append(textElement('dt', t(label)), textElement('dd', value));
        metrics.append(metric);
    });
    item.append(heading, usage, metrics);
    return item;
}

export function renderUnits(elements, state) {
    const units = Array.isArray(state.units)
        ? state.units.filter(unit => isPlayerFacingUnitName(unit?.name || unit?.unitName))
        : [];
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
