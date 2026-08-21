import { ASSET_FALLBACKS, getTownHallAsset, installImageFallback } from '../../assets/entity-assets.js';
import { createCwlExportViewModel, safeExportFilename } from './cwl-export-model.js';
import { captureCwlExportElement, triggerCwlExportDownload } from './cwl-export-capture.js';
const EXPORT_WIDTH = 960;
const EXPORT_MIN_HEIGHT = 600;
const EXPORT_PIXEL_RATIO = 2;
const EXPORT_CSS_URL = '/assets/css/cwl-export.css?v=20260821-export-v1';
export function renderCwlExportTemplate(container, snapshot, options = {}) {
    if (typeof container?.replaceChildren !== 'function') { options = snapshot || {}; snapshot = container; container = document.createElement('div'); }
    const model = createCwlExportViewModel(snapshot, options);
    const config = createRenderConfig(model, snapshot, options);
    const canvas = element('div', 'cwl-export-canvas');
    canvas.dataset.exportTheme = config.theme;
    canvas.dataset.exportWidth = String(EXPORT_WIDTH);
    canvas.dataset.exportHeight = String(config.height);
    canvas.dataset.planName = config.planName;
    canvas.style.width = `${EXPORT_WIDTH}px`;
    canvas.style.minHeight = `${config.height}px`;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${config.planName} CWL plan export`);
    canvas.append(buildHeader(config), buildBody(config), buildFooter());
    container.replaceChildren(canvas);
    const measuredHeight = Math.max(config.height, canvas.scrollHeight || 0);
    canvas.dataset.exportHeight = String(measuredHeight);
    canvas.style.minHeight = `${measuredHeight}px`;
    return canvas;
}
export function fitCwlExportPreview(frame, canvas) {
    if (!frame || !canvas) return 1;
    const width = dimension(canvas, 'exportWidth', EXPORT_WIDTH);
    const height = dimension(canvas, 'exportHeight', EXPORT_MIN_HEIGHT);
    const available = frame.clientWidth || frame.getBoundingClientRect?.().width || width;
    const scale = Math.min(1, Math.max(0.1, available / width));
    canvas.style.transform = `scale(${scale})`;
    canvas.style.transformOrigin = 'top left';
    canvas.style.marginRight = `${-Math.ceil(width * (1 - scale))}px`;
    canvas.style.marginBottom = `${-Math.ceil(height * (1 - scale))}px`;
    frame.style.height = `${Math.ceil(height * scale)}px`;
    frame.dataset.previewScale = String(scale);
    return scale;
}
export async function downloadCwlExportPng(canvas, options = {}) {
    if (!(canvas instanceof HTMLCanvasElement) && !(canvas instanceof HTMLElement)) {
        const host = document.createElement('div');
        canvas = renderCwlExportTemplate(host, canvas, options);
    }
    const blob = await captureCwlExportElement(canvas, {
        cssUrl: EXPORT_CSS_URL,
        pixelRatio: options.pixelRatio || EXPORT_PIXEL_RATIO
    });
    const filename = options.filename || defaultFilename(canvas, options);
    triggerCwlExportDownload(blob, filename);
    return blob;
}
function createRenderConfig(model, snapshot, options) {
    const clans = Array.isArray(model?.clans) ? model.clans : [];
    const freePlayers = Array.isArray(model?.freePlayers) ? model.freePlayers : [];
    const planName = String(model?.planName || model?.name || snapshot?.name || 'CWL plan');
    const single = isSingleScope(options);
    const theme = options.theme || model?.theme || 'dark';
    const columns = clanColumns(clans.length, single);
    return {
        model,
        clans,
        freePlayers,
        planName,
        theme: theme === 'light' ? 'light' : 'dark',
        exportedAt: model?.exportedAt || snapshot?.exportedAt || options.exportedAt,
        showNames: displayFlag(model, options, 'showNames', true),
        showTownHall: displayFlag(model, options, 'showTownHall', true),
        showTags: displayFlag(model, options, 'showTags', false),
        showRoles: displayFlag(model, options, 'showRoles', true),
        columns,
        height: calculateHeight(clans, freePlayers, columns, single),
        single
    };
}
function buildHeader(config) {
    const header = element('header', 'cwl-export-header');
    const brand = element('div', 'cwl-export-brand');
    const logo = image('/assets/css/pictures/clashtools-logo.png', 'ClashPanel logo', 'cwl-export-logo');
    brand.append(logo, element('span', '', 'CLASHPANEL'));
    const context = element('div', 'cwl-export-header-context');
    context.append(element('span', 'cwl-export-kicker', 'CWL PLAN'), element('span', 'cwl-export-date', formatDate(config.exportedAt)));
    header.append(brand, context);
    const title = element('div', 'cwl-export-title-block');
    title.append(element('h1', 'cwl-export-title', config.planName), element('p', 'cwl-export-subtitle', config.single ? 'Single clan roster' : 'Complete plan roster'));
    header.appendChild(title);
    return header;
}
function buildBody(config) {
    const body = element('main', 'cwl-export-body');
    const grid = element('div', 'cwl-export-clan-grid');
    grid.style.setProperty('--export-columns', String(config.columns));
    config.clans.forEach(clan => grid.appendChild(buildClanCard(clan, config)));
    if (!config.clans.length) grid.appendChild(emptyBlock('No clans assigned yet.'));
    body.appendChild(grid);
    if (!config.single && config.freePlayers.length) {
        body.appendChild(buildUnassigned(config.freePlayers, config));
    }
    if (config.showRoles) body.appendChild(buildRoleLegend());
    return body;
}
function buildClanCard(clan, config) {
    const card = element('section', 'cwl-export-clan-card');
    card.dataset.clanId = String(clan?.id || clan?.tag || '');
    const header = element('header', 'cwl-export-clan-header');
    const badge = image(clan?.badgeUrl || ASSET_FALLBACKS.clan, '', 'cwl-export-clan-badge');
    installImageFallback(badge, ASSET_FALLBACKS.clan);
    const heading = element('div', 'cwl-export-clan-heading');
    heading.append(element('h2', '', clan?.name || 'Unnamed clan'), element('span', 'cwl-export-clan-tag', clan?.tag || '—'));
    const players = Array.isArray(clan?.players) ? clan.players : [];
    const capacity = Number(clan?.capacity) || 0;
    const assigned = Number(clan?.assignedCount ?? players.length);
    header.append(badge, heading, element('span', 'cwl-export-capacity', `${assigned} / ${capacity}`));
    card.appendChild(header);
    const list = element('div', 'cwl-export-player-list');
    if (!players.length) list.appendChild(emptyBlock('No players assigned.'));
    players.forEach(player => list.appendChild(buildPlayerRow(player, config)));
    card.appendChild(list);
    if (config.showRoles) card.appendChild(buildRoleCounts(players));
    return card;
}
function buildPlayerRow(player, config) {
    const row = element('div', 'cwl-export-player');
    const level = Number(player?.townHallLevel ?? player?.townHall);
    if (config.showTownHall) {
        const townHall = image(getTownHallAsset(level), `Town Hall ${level || '—'}`, 'cwl-export-townhall');
        installImageFallback(townHall);
        row.append(townHall, element('span', 'cwl-export-th-label', `TH${level || '—'}`));
    }
    if (config.showNames) row.appendChild(element('span', 'cwl-export-player-name', player?.name || player?.tag || 'Unknown player'));
    if (config.showTags && player?.tag) row.appendChild(element('span', 'cwl-export-player-tag', player.tag));
    if (config.showRoles) row.appendChild(roleBadge(player?.rosterStatus || player?.role));
    return row;
}
function buildUnassigned(players, config) {
    const section = element('section', 'cwl-export-unassigned');
    section.appendChild(element('h2', 'cwl-export-section-title', 'Unassigned'));
    const list = element('div', 'cwl-export-player-list');
    players.forEach(player => list.appendChild(buildPlayerRow(player, config)));
    section.appendChild(list);
    return section;
}
function buildRoleCounts(players) {
    const counts = players.reduce((result, player) => {
        const role = normalizeRole(player?.rosterStatus || player?.role);
        result[role] += 1;
        return result;
    }, { core: 0, rotation: 0, reserve: 0 });
    const summary = element('div', 'cwl-export-role-counts');
    ['core', 'rotation', 'reserve'].forEach(role => {
        if (counts[role]) summary.appendChild(element('span', `is-${role}`, `${roleLabel(role)} ${counts[role]}`));
    });
    return summary;
}
function buildRoleLegend() {
    const legend = element('div', 'cwl-export-role-legend');
    ['core', 'rotation', 'reserve'].forEach(role => legend.appendChild(roleBadge(role, true)));
    return legend;
}
function roleBadge(role, legend = false) {
    const value = normalizeRole(role);
    return element('span', `cwl-export-role-badge is-${value}${legend ? ' is-legend' : ''}`, roleLabel(value));
}
function buildFooter() {
    const footer = element('footer', 'cwl-export-footer');
    footer.append(element('span', '', 'Made with ClashPanel · clashpanel.com'));
    footer.append(image('/assets/css/pictures/clashtools-logo.png', 'ClashPanel', 'cwl-export-footer-logo'));
    return footer;
}
function calculateHeight(clans, freePlayers, columns, single) {
    const rowHeights = clans.map(clan => 178 + Math.max(1, clan?.players?.length || 0) * 37);
    const gridRows = Math.max(1, Math.ceil(rowHeights.length / columns));
    const rowMaximums = Array.from({ length: gridRows }, (_, row) => (
        Math.max(...rowHeights.slice(row * columns, (row + 1) * columns))
    ));
    const gridHeight = rowMaximums.length
        ? rowMaximums.reduce((total, height) => total + height, 0) + ((gridRows - 1) * 16)
        : 160;
    const unassignedHeight = !single && freePlayers.length ? 78 + freePlayers.length * 37 : 0;
    return Math.max(EXPORT_MIN_HEIGHT, 190 + gridHeight + unassignedHeight);
}
function clanColumns(count, single) {
    if (single || count <= 1) return 1;
    if (count === 3) return 3;
    return count >= 4 ? 2 : 2;
}
function displayFlag(model, options, key, fallback) {
    if (typeof options[key] === 'boolean') return options[key];
    if (typeof model?.visibility?.[key] === 'boolean') return model.visibility[key];
    if (typeof model?.[key] === 'boolean') return model[key];
    return fallback;
}
function defaultFilename(canvas, options) {
    const planName = canvas?.dataset?.planName || 'CWL Plan';
    const scope = isSingleScope(options) ? `-${options.clanId || options.clanTag || 'clan'}` : '';
    const base = safeExportFilename(`ClashPanel-${planName}${scope}`) || 'ClashPanel-CWL-Plan';
    return base.toLowerCase().endsWith('.png') ? base : `${base}.png`;
}
function dimension(element, key, fallback) {
    const value = Number(element?.dataset?.[key]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function isSingleScope(options) { return ['single', 'single-clan', 'clan'].includes(String(options?.scope || options?.mode || '').toLowerCase()); }
function formatDate(value) {
    const date = value ? new Date(value) : new Date();
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}
function normalizeRole(role) {
    return ['core', 'rotation', 'reserve'].includes(String(role).toLowerCase()) ? String(role).toLowerCase() : 'reserve';
}
function roleLabel(role) {
    return { core: 'Core', rotation: 'Rotation', reserve: 'Reserve' }[normalizeRole(role)];
}
function emptyBlock(text) {
    return element('p', 'cwl-export-empty', text);
}
function image(src, alt, className) {
    const img = element('img', className, '');
    img.src = src;
    img.alt = alt;
    img.loading = 'eager';
    img.decoding = 'async';
    return img;
}
function element(tag, className = '', text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className; if (text) node.textContent = String(text);
    return node;
}
