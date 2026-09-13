import { t } from '../i18n/i18n.js?v=20260913-advanced-dashboard-v2';
import { formatDateTime, formatNumber } from './advanced-stats-formatters.js?v=20260913-advanced-dashboard-v2';

const RESOURCE_DEFINITIONS = Object.freeze([
    { key: 'gold', field: 'goldLooted', averageField: 'averageGoldLooted', bestField: 'bestGoldLooted' },
    { key: 'elixir', field: 'elixirLooted', averageField: 'averageElixirLooted', bestField: 'bestElixirLooted' },
    { key: 'darkElixir', field: 'darkElixirLooted', averageField: 'averageDarkElixirLooted', bestField: 'bestDarkElixirLooted' }
]);

const RESOURCE_ALIASES = Object.freeze({
    gold: ['gold', 'GOLD'],
    elixir: ['elixir', 'ELIXIR'],
    darkElixir: ['darkElixir', 'dark_elixir', 'DARK_ELIXIR']
});

function objectValue(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function finiteNonNegative(value) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
}

function nestedResource(summary, key) {
    const loot = objectValue(summary?.loot);
    if (!loot) return null;
    const value = RESOURCE_ALIASES[key].map(alias => loot[alias]).find(candidate => candidate !== undefined);
    return value === undefined ? null : value;
}

function bestAmount(value, field) {
    const direct = finiteNonNegative(value);
    if (direct !== null) return direct;
    const object = objectValue(value);
    if (!object) return null;
    return [object.amount, object.value, object[field], object[field.replace('Looted', '')], object.total, object.loot, object.best]
        .map(finiteNonNegative)
        .find(amount => amount !== null) ?? null;
}

function bestAttack(value, field) {
    const amount = bestAmount(value, field);
    if (amount === null) return null;
    const source = objectValue(value);
    const attack = objectValue(source?.attack);
    const details = { ...(source || {}), ...(attack || {}) };
    return {
        amount,
        opponentName: details.opponentName || details.opponentPlayerName || details.opponent || null,
        battleAt: details.battleAt || details.occurredAt || details.attackAt || null,
        battleType: details.battleType || details.type || null,
        stars: finiteNonNegative(details.stars),
        destructionPercentage: finiteNonNegative(details.destructionPercentage ?? details.destruction)
    };
}

function resourceValue(summary, definition, nested, property) {
    const flatField = property === 'total' ? definition.field
        : property === 'average' ? definition.averageField : definition.bestField;
    const flat = summary?.[flatField];
    const nestedObject = objectValue(nested);
    const nestedValue = nestedObject
        ? property === 'bestAttack' ? nestedObject.bestAttack ?? nestedObject.best
            : nestedObject[property] ?? (property === 'total' ? nestedObject.loot : undefined)
        : property === 'total' ? nested : undefined;
    if (property === 'bestAttack') return bestAttack(flat !== undefined ? flat : nestedValue, definition.field);
    const candidate = flat !== undefined ? flat : nestedValue;
    return finiteNonNegative(candidate);
}

export function normalizeLootSummary(summary = {}) {
    return Object.fromEntries(RESOURCE_DEFINITIONS.map(definition => {
        const nested = nestedResource(summary, definition.key);
        return [definition.key, {
            total: resourceValue(summary, definition, nested, 'total'),
            average: resourceValue(summary, definition, nested, 'average'),
            bestAttack: resourceValue(summary, definition, nested, 'bestAttack')
        }];
    }));
}

export function hasKnownLoot(loot) {
    return RESOURCE_DEFINITIONS.some(({ key }) => {
        const resource = loot?.[key];
        return resource?.total != null || resource?.average != null || resource?.bestAttack != null;
    });
}

function textElement(tag, value, className = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    return element;
}

function bestAttackLabel(best) {
    if (!best) return '—';
    const details = [best.opponentName, best.battleAt ? formatDateTime(best.battleAt) : null].filter(Boolean);
    return details.length ? `${formatNumber(best.amount)} · ${details.join(' · ')}` : formatNumber(best.amount);
}

function renderResourceCard(card, resource) {
    if (!card) return;
    const total = card.querySelector('[data-loot-total]');
    const average = card.querySelector('[data-loot-average]');
    const best = card.querySelector('[data-loot-best]');
    if (total) total.textContent = formatNumber(resource?.total);
    if (average) average.textContent = formatNumber(resource?.average);
    if (best) best.textContent = bestAttackLabel(resource?.bestAttack);
    card.dataset.known = String(Boolean(resource && (resource.total !== null || resource.average !== null || resource.bestAttack)));
}

function lootAttackCount(summary) {
    const nested = objectValue(summary?.loot);
    return finiteNonNegative(summary?.lootAttackCount ?? summary?.lootKnownAttackCount ?? nested?.knownAttackCount);
}

export function renderLootSummary(elements, state) {
    const data = state.overview?.data || state.overview || {};
    const summary = data.summary || {};
    const loot = normalizeLootSummary(summary);
    if (elements.lootAttackCount) {
        const count = lootAttackCount(summary);
        elements.lootAttackCount.textContent = count === null
            ? t('advancedStats.lootAttackCountUnknown')
            : t('advancedStats.lootAttackCount', { count: formatNumber(count) });
    }
    elements.lootCards?.querySelectorAll('[data-loot-resource]').forEach(card => {
        renderResourceCard(card, loot[card.dataset.lootResource]);
    });
    return loot;
}

function knownLoot(point) {
    return RESOURCE_DEFINITIONS.some(definition => finiteNonNegative(point?.[definition.field]) !== null);
}

function lootCell(value) {
    const cell = document.createElement('td');
    cell.textContent = formatNumber(finiteNonNegative(value));
    return cell;
}

export function renderLootTrend(root, points, formatPeriod = value => String(value ?? '')) {
    if (!root) return;
    root.replaceChildren();
    const lootPoints = (Array.isArray(points) ? points : []).filter(knownLoot);
    root.hidden = lootPoints.length === 0;
    if (!lootPoints.length) return;

    const table = document.createElement('table');
    table.className = 'advanced-stats__loot-trend-table';
    const caption = textElement('caption', t('advancedStats.lootTrendTitle'));
    caption.className = 'sr-only';
    table.append(caption);
    const head = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.append(...[
        [t('advancedStats.period'), 'col'], [t('advancedStats.resourceGold'), 'col'],
        [t('advancedStats.resourceElixir'), 'col'], [t('advancedStats.resourceDarkElixir'), 'col']
    ].map(([label, scope]) => {
        const header = textElement('th', label, '');
        header.scope = scope;
        return header;
    }));
    head.append(headerRow);
    const body = document.createElement('tbody');
    lootPoints.forEach(point => {
        const row = document.createElement('tr');
        const period = textElement('th', formatPeriod(point.date), '');
        period.scope = 'row';
        row.append(period, lootCell(point.goldLooted), lootCell(point.elixirLooted), lootCell(point.darkElixirLooted));
        body.append(row);
    });
    table.append(head, body);
    root.append(table);
}

export { RESOURCE_DEFINITIONS };
