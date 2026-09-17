import { t } from '../i18n/i18n.js?v=20260916-advanced-insights-v1';
import {
    hasValue,
    payloadFor,
    readField,
    rowsForSection,
    stateFor
} from './advanced-stats-insights-data.js?v=20260916-advanced-insights-v1';
import { renderWarSummary, renderWarTrends } from './advanced-stats-insights-war.js?v=20260916-advanced-insights-v1';

const UNKNOWN = '—';

const COLUMNS = Object.freeze({
    warCwl: Object.freeze([
        ['period', 'advancedStats.insightsPeriod', ['period', 'season']],
        ['mode', 'advancedStats.insightsMode', ['mode', 'type', 'scope']],
        ['attacks', 'advancedStats.insightsAttacks', ['attacks', 'attackCount', 'playerAttacks']],
        ['available', 'advancedStats.insightsAvailable', ['availableAttacks']],
        ['used', 'advancedStats.insightsUsed', ['usedAttacks']],
        ['missed', 'advancedStats.insightsMissed', ['missedAttacks']],
        ['stars', 'advancedStats.insightsStars', ['stars', 'totalStars']],
        ['avgStars', 'advancedStats.insightsAverageStars', ['avgStars', 'averageStars'], true],
        ['destruction', 'advancedStats.insightsDestruction', ['destruction', 'totalDestruction']],
        ['avgDestruction', 'advancedStats.insightsAverageDestruction', ['avgDestruction', 'averageDestruction'], true],
        ['tripleRate', 'advancedStats.insightsTripleRate', ['tripleRate', 'threeStarRate'], true],
        ['thMatchup', 'advancedStats.insightsTownHall', ['townHallMatchup', 'thMatchup', 'townHall', 'townHallDelta', 'matchup', 'matchups'], true],
        ['rate', 'advancedStats.insightsTripleRate', ['rate', 'threeStarRate', 'participationRate', 'successRate'], true],
        ['sample', 'advancedStats.insightsSample', ['sample', 'sampleSize', 'warCount', 'seasonCount'], true]
    ]),
    progression: Object.freeze([
        ['event', 'advancedStats.insightsEvent', ['event', 'name', 'entityName', 'kind']],
        ['recorded', 'advancedStats.insightsRecorded', ['recordedAt', 'eventAt', 'at', 'timestamp', 'date']],
        ['previous', 'advancedStats.insightsPrevious', ['previous', 'from']],
        ['current', 'advancedStats.insightsCurrent', ['current', 'to']],
        ['change', 'advancedStats.insightsChange', ['change', 'delta']]
    ]),
    league: Object.freeze([
        ['season', 'advancedStats.insightsSeason', ['season', 'period']],
        ['mode', 'advancedStats.insightsMode', ['mode', 'type', 'scope']],
        ['league', 'advancedStats.insightsLeague', ['league']],
        ['rank', 'advancedStats.insightsRank', ['rank', 'position']],
        ['attacks', 'advancedStats.insightsAttacks', ['attacks', 'attackCount', 'playerAttacks']],
        ['stars', 'advancedStats.insightsStars', ['stars', 'totalStars']],
        ['destruction', 'advancedStats.insightsDestruction', ['destruction', 'totalDestruction']]
    ])
});

const MODE_LABELS = Object.freeze({
    normal: 'Regular',
    regular: 'Regular',
    war: 'War',
    cwl: 'CWL',
    ranked: 'Ranked',
    legend: 'Legends'
});

const MODE_KEYS = Object.freeze({
    normal: 'advancedStats.attackCategoryRegular',
    regular: 'advancedStats.attackCategoryRegular',
    war: 'advancedStats.coverageWar',
    cwl: 'advancedStats.insightsCwl',
    ranked: 'advancedStats.insightsRanked',
    legend: 'advancedStats.insightsLegend'
});

function documentFor(root) {
    return root?.ownerDocument || (typeof document === 'undefined' ? null : document);
}

const fieldValue = readField;

function formatMatchup(value) {
    const labels = { same: 'advancedStats.insightsMatchupSame', up: 'advancedStats.insightsMatchupUp', down: 'advancedStats.insightsMatchupDown' };
    const parts = Object.entries(labels).filter(([key]) => hasValue(value?.[key]))
        .map(([key, label]) => `${t(label)}: ${formatValue(value[key], 'count')}`);
    return parts.join(', ') || UNKNOWN;
}

function formatValue(value, key) {
    if (!hasValue(value)) return UNKNOWN;
    if (key === 'mode') {
        const normalized = String(value).toLowerCase();
        return MODE_KEYS[normalized] ? t(MODE_KEYS[normalized]) : MODE_LABELS[normalized] || String(value);
    }
    if (key === 'thMatchup' && typeof value === 'object' && !Array.isArray(value)) return formatMatchup(value);
    if (typeof value === 'object') return formatValue(value.label ?? value.name ?? value.value, key);
    if (typeof value === 'number' && Number.isFinite(value)) {
        return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
    }
    return String(value);
}

function unknownCell(doc) {
    const span = doc.createElement('span');
    span.dataset.state = 'unknown';
    span.setAttribute('aria-label', t('advancedStats.coverageUnknown'));
    span.textContent = UNKNOWN;
    return span;
}

function cellFor(doc, row, column) {
    const [key, labelKey, aliases] = column;
    const value = fieldValue(row, aliases);
    const cell = doc.createElement('td');
    cell.dataset.label = t(labelKey);
    if (!hasValue(value)) cell.append(unknownCell(doc));
    else cell.textContent = formatValue(value, key);
    return cell;
}

function renderTable(doc, content, section, rows) {
    const columns = (COLUMNS[section] || []).filter(column => !column[3]
        || rows.some(row => hasValue(fieldValue(row, column[2]))));
    const wrap = doc.createElement('div');
    wrap.className = 'advanced-stats__insights-table-wrap';
    const table = doc.createElement('table');
    table.className = 'advanced-stats__insights-table';
    const caption = doc.createElement('caption');
    caption.className = 'sr-only';
    caption.textContent = t(section === 'warCwl'
        ? 'advancedStats.warCwlTitle'
        : section === 'progression' ? 'advancedStats.progressionTitle' : 'advancedStats.leagueTitle');
    table.append(caption);
    const head = doc.createElement('thead');
    const headRow = doc.createElement('tr');
    columns.forEach(([, labelKey]) => {
        const cell = doc.createElement('th');
        cell.scope = 'col';
        cell.textContent = t(labelKey);
        headRow.append(cell);
    });
    head.append(headRow);
    const body = doc.createElement('tbody');
    rows.forEach(row => {
        if (!row || typeof row !== 'object') return;
        const tableRow = doc.createElement('tr');
        columns.forEach(column => tableRow.append(cellFor(doc, row, column)));
        body.append(tableRow);
    });
    table.append(head, body);
    wrap.append(table);
    content.replaceChildren(wrap);
}

function setStateVisibility(root, state, showContent) {
    root.querySelectorAll('[data-insights-state]').forEach(element => {
        element.hidden = element.dataset.insightsState !== state;
    });
    const content = root.querySelector('[data-insights-content]');
    if (content) content.hidden = !showContent;
}

function coverageStatus(value) {
    const normalized = String(value || '').toLowerCase();
    if (['available', 'complete', 'ready'].includes(normalized)) return t('advancedStats.coverageAvailable');
    if (['partial', 'degraded'].includes(normalized)) return t('advancedStats.coveragePartial');
    if (['unavailable', 'unsupported'].includes(normalized)) return t('advancedStats.coverageUnavailable');
    return t('advancedStats.coverageUnknown');
}

function formatTimestamp(value) {
    if (!hasValue(value)) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function renderCoverageMeta(doc, content, payload, response) {
    const coverage = payload?.coverage;
    const metadata = coverage && typeof coverage === 'object' ? coverage : null;
    const updated = readField(response, ['lastUpdated', 'fetchedAt', 'generatedAt', 'updatedAt'])
        ?? readField(payload, ['lastUpdated', 'fetchedAt', 'generatedAt', 'updatedAt']);
    const formattedUpdated = formatTimestamp(updated);
    if (!metadata && !formattedUpdated) return;
    const meta = doc.createElement('dl');
    meta.className = 'advanced-stats__insights-coverage';
    const values = metadata ? [
        ['insightsCoverage', metadata.state ?? metadata.status, value => coverageStatus(value)],
        ['insightsSource', metadata.source],
        ['insightsEventCount', metadata.eventCount],
        ['insightsAttackCount', metadata.attackCount],
        ['insightsWarCount', metadata.warCount],
        ['insightsSeasonCount', metadata.seasonCount],
        ['insightsTrackedRange', [metadata.trackedFrom, metadata.trackedTo].filter(hasValue).join(' – ')]
    ] : [];
    values.push(['insightsLastUpdated', formattedUpdated]);
    values.forEach(([labelKey, value, formatter]) => {
        if (!hasValue(value)) return;
        const item = doc.createElement('div');
        const label = doc.createElement('dt');
        label.textContent = t(`advancedStats.${labelKey}`);
        const itemValue = doc.createElement('dd');
        itemValue.textContent = formatter ? formatter(value) : formatValue(value, 'count');
        item.append(label, itemValue);
        meta.append(item);
    });
    content.append(meta);
}

function renderLeagueSelectionNotice(doc, content, payload) {
    const modes = payload?.modes && typeof payload.modes === 'object' ? payload.modes : payload;
    const selection = modes?.ranked?.selection ?? payload?.selection;
    const unverified = selection?.verifiedCurrent === false || String(selection?.verifiedCurrent).toLowerCase() === 'false';
    if (!unverified || selection?.basis !== 'latest_observed_player_history') return;
    const note = doc.createElement('p');
    note.className = 'advanced-stats__insights-selection-note';
    note.setAttribute('role', 'note');
    note.textContent = t('advancedStats.insightsCurrentSeasonUnverified');
    content.append(note);
}

function renderInsights(root, section, data) {
    if (!root) return;
    const payload = payloadFor(data);
    const rows = rowsForSection(section, payload);
    const state = stateFor(data, payload, rows);
    const visibleRows = rows.filter(row => row && typeof row === 'object');
    const showContent = ['ready', 'partial'].includes(state) && visibleRows.length > 0;
    root.dataset.state = state;
    root.setAttribute('aria-busy', String(state === 'loading'));
    setStateVisibility(root, state, showContent);
    const content = root.querySelector('[data-insights-content]');
    if (!content) return;
    if (showContent) {
        const doc = documentFor(root);
        renderCoverageMeta(doc, content, payload, data);
        if (section === 'warCwl') {
            renderWarSummary(doc, content, payload);
            renderWarTrends(doc, content, payload);
        } else if (section === 'league') renderLeagueSelectionNotice(doc, content, payload);
        const tableContent = doc.createElement('div');
        renderTable(doc, tableContent, section, visibleRows);
        content.append(tableContent.firstElementChild);
    }
    else content.replaceChildren();
    if (state === 'ready' && !visibleRows.length) {
        const doc = documentFor(root);
        const empty = doc.createElement('p');
        empty.className = 'advanced-stats__insights-empty-copy';
        empty.textContent = t('advancedStats.insightsNoRows');
        content.append(empty);
        content.hidden = false;
    }
}

export function renderWarCwl(root, data) {
    renderInsights(root, 'warCwl', data);
}

export function renderProgression(root, data) {
    renderInsights(root, 'progression', data);
}

export function renderLeague(root, data) {
    renderInsights(root, 'league', data);
}

export function syncInsightTabs(root, selected = 'overview') {
    if (!root) return;
    const tabs = [...root.querySelectorAll('[data-advanced-stats-tab]')];
    const panels = [...root.querySelectorAll('[data-advanced-stats-panel]')];
    tabs.forEach(tab => {
        const active = tab.dataset.advancedStatsTab === selected;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        tab.classList.toggle('is-active', active);
    });
    panels.forEach(panel => {
        const active = panel.dataset.advancedStatsPanel === selected;
        panel.hidden = !active;
        panel.setAttribute('aria-hidden', String(!active));
    });
}

export { COLUMNS as advancedStatsInsightsColumns };
