import { getLanguage, t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { achievementChronicleLocales } from '../i18n/achievement-chronicle-locales.js';
import { achievementFamilyImage } from './achievement-asset-view.js?v=20260824-achievement-raster-color-1';
import {
    buildChronicleBranches,
    chronicleMapSize,
    chronicleNodePositions,
    chronicleRarity,
    isChronicleMilestone,
    isChronicleReached
} from './achievement-chronicle-model.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function translated(key, fallback = key, params = {}) {
    const value = t(key, params);
    return value === key ? fallback : value;
}

function chronicleText(key, fallback = key, params = {}) {
    let value = achievementChronicleLocales[getLanguage()]?.[key]
        || achievementChronicleLocales.en?.[key]
        || fallback;
    Object.entries(params).forEach(([param, replacement]) => {
        value = value.replaceAll(`{${param}}`, replacement ?? '');
    });
    return value;
}

export function applyAchievementChronicleI18n(root = document) {
    root.querySelectorAll('[data-chronicle-i18n]').forEach(element => {
        element.textContent = chronicleText(element.dataset.chronicleI18n, element.textContent);
    });
    root.querySelectorAll('[data-chronicle-i18n-aria-label]').forEach(element => {
        element.setAttribute('aria-label', chronicleText(
            element.dataset.chronicleI18nAriaLabel,
            element.getAttribute('aria-label') || ''
        ));
    });
}

function number(value, fallback = '—') {
    if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return fallback;
    return new Intl.NumberFormat(getLanguage()).format(Number(value));
}

function unlockDate(family) {
    if (!isChronicleReached(family)) return chronicleText('achievements.chronicle.notUnlocked', 'Not unlocked');
    const value = family?.highestUnlocked?.unlocked_at;
    if (!value) return t('achievements.unknown');
    const result = new Date(value);
    return Number.isNaN(result.getTime())
        ? t('achievements.unknown')
        : new Intl.DateTimeFormat(getLanguage(), { dateStyle: 'medium' }).format(result);
}

function rarityLabel(family) {
    const rarity = chronicleRarity(family);
    return translated(`achievements.${rarity}`, rarity[0].toUpperCase() + rarity.slice(1));
}

function progressText(family) {
    const current = family?.currentTier;
    if (!family?.sourceAvailable) {
        return current?.hasStoredProgress
            ? `${t('achievements.lastKnown')}: ${number(current.progress)}`
            : translated('achievements.waitingForSource', 'Waiting for this data source');
    }
    if (family.complete) return t('achievements.xpEarned', { xp: number(family.totalXp) });
    return t('achievements.progressValue', {
        progress: number(current?.progress),
        target: current?.thresholdText || number(current?.target)
    });
}

function nodeSymbol(family) {
    if (isChronicleMilestone(family)) return '★';
    return isChronicleReached(family) ? '◆' : '◇';
}

function nodeSymbolLabel(family) {
    if (isChronicleMilestone(family)) return chronicleText('achievements.chronicle.milestone', 'Milestone');
    return isChronicleReached(family)
        ? chronicleText('achievements.chronicle.unlocked', 'Unlocked')
        : chronicleText('achievements.chronicle.locked', 'Locked');
}

function createPath(start, end, earned) {
    const path = document.createElementNS(SVG_NS, 'path');
    const midpoint = (start.x + end.x) / 2;
    path.setAttribute('d', `M ${start.x} ${start.y} C ${midpoint} ${start.y}, ${midpoint} ${end.y}, ${end.x} ${end.y}`);
    path.dataset.state = earned ? 'earned' : 'locked';
    path.setAttribute('pathLength', '1');
    return path;
}

function tooltipRow(label, value) {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = label;
    detail.textContent = value;
    row.append(term, detail);
    return row;
}

function createTooltip(family, id) {
    const tooltip = document.createElement('aside');
    tooltip.className = 'achievement-chronicle-tooltip';
    tooltip.id = id;
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    const title = document.createElement('h3');
    title.textContent = family.title;
    const description = document.createElement('p');
    description.textContent = family.description;
    const details = document.createElement('dl');
    details.append(
        tooltipRow(chronicleText('achievements.chronicle.progress', 'Progress'), progressText(family)),
        tooltipRow(chronicleText('achievements.chronicle.unlockDate', 'Unlock date'), unlockDate(family)),
        tooltipRow(t('achievements.rarity'), rarityLabel(family))
    );
    tooltip.append(title, description, details);
    return tooltip;
}

function setTooltipVisible(stop, visible, pinned = false) {
    const node = stop.querySelector('.achievement-chronicle-node');
    const tooltip = stop.querySelector('.achievement-chronicle-tooltip');
    stop.classList.toggle('is-open', visible);
    stop.classList.toggle('is-pinned', visible && pinned);
    node?.setAttribute('aria-expanded', String(visible));
    tooltip?.setAttribute('aria-hidden', String(!visible));
}

function bindTooltip(stop, map) {
    const node = stop.querySelector('.achievement-chronicle-node');
    node.addEventListener('pointerenter', () => setTooltipVisible(stop, true, stop.classList.contains('is-pinned')));
    node.addEventListener('pointerleave', () => {
        if (!stop.classList.contains('is-pinned') && !node.matches(':focus')) setTooltipVisible(stop, false);
    });
    node.addEventListener('focus', () => setTooltipVisible(stop, true, stop.classList.contains('is-pinned')));
    node.addEventListener('blur', () => {
        if (!stop.classList.contains('is-pinned')) setTooltipVisible(stop, false);
    });
    node.addEventListener('click', () => {
        const pin = !stop.classList.contains('is-pinned');
        map.querySelectorAll('.achievement-chronicle-stop.is-open').forEach(other => {
            if (other !== stop) setTooltipVisible(other, false);
        });
        setTooltipVisible(stop, pin, pin);
    });
    node.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        setTooltipVisible(stop, false);
    });
}

function createNode(family, branchKey, index, position, familyCount) {
    const stop = document.createElement('div');
    stop.className = 'achievement-chronicle-stop';
    stop.dataset.pathState = isChronicleReached(family) ? 'earned' : 'locked';
    stop.style.setProperty('--node-x', `${position.x}px`);
    stop.style.setProperty('--node-y', `${position.y}px`);
    stop.style.setProperty('--node-order', String(index));
    if (index === 0) stop.dataset.edge = 'start';
    else if (index === familyCount - 1) stop.dataset.edge = 'end';

    const tooltipId = `achievement-tip-${branchKey}-${index}`;
    const node = document.createElement('button');
    node.className = 'achievement-chronicle-node';
    node.type = 'button';
    node.dataset.state = family.state;
    node.dataset.rarity = chronicleRarity(family);
    node.dataset.milestone = String(isChronicleMilestone(family));
    node.dataset.sourceAvailable = String(family.sourceAvailable);
    node.setAttribute('aria-controls', tooltipId);
    node.setAttribute('aria-expanded', 'false');
    node.setAttribute('aria-label', `${family.title}. ${nodeSymbolLabel(family)}. ${progressText(family)}`);

    const emblem = document.createElement('span');
    emblem.className = 'achievement-chronicle-emblem';
    emblem.append(achievementFamilyImage(family, family.title));
    const symbol = document.createElement('span');
    symbol.className = 'achievement-chronicle-symbol';
    symbol.textContent = nodeSymbol(family);
    symbol.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'achievement-chronicle-node-label';
    label.textContent = family.title;
    node.append(emblem, symbol, label);
    stop.append(node, createTooltip(family, tooltipId));
    return stop;
}

function createBranch(branch, branchIndex) {
    const section = document.createElement('section');
    section.className = 'achievement-chronicle-branch';
    section.dataset.branch = branch.key;
    section.setAttribute('role', 'listitem');
    const heading = document.createElement('header');
    const icon = document.createElement('img');
    icon.src = branch.icon;
    icon.alt = '';
    const copy = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = chronicleText(`achievements.chronicle.branch.${branch.labelKey}`, branch.labelKey);
    const count = document.createElement('p');
    count.textContent = chronicleText('achievements.chronicle.branchCount', `${branch.families.length} achievements`, { count: branch.families.length });
    copy.append(title, count);
    heading.append(icon, copy);

    const scroll = document.createElement('div');
    scroll.className = 'achievement-chronicle-scroll';
    const map = document.createElement('div');
    map.className = 'achievement-chronicle-map';
    const positions = chronicleNodePositions(branch.families.length);
    const size = chronicleMapSize(positions);
    map.style.setProperty('--chronicle-map-width', `${size.width}px`);
    map.style.setProperty('--chronicle-map-height', `${size.height}px`);
    const paths = document.createElementNS(SVG_NS, 'svg');
    paths.classList.add('achievement-chronicle-paths');
    paths.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
    paths.setAttribute('aria-hidden', 'true');
    positions.slice(0, -1).forEach((position, index) => {
        paths.append(createPath(position, positions[index + 1], isChronicleReached(branch.families[index + 1])));
    });
    map.append(paths);
    branch.families.forEach((family, index) => {
        const stop = createNode(family, `${branch.key}-${branchIndex}`, index, positions[index], branch.families.length);
        map.append(stop);
        bindTooltip(stop, map);
    });
    scroll.append(map);
    section.append(heading, scroll);
    return section;
}

export function renderAchievementChronicle(container, families) {
    const branches = buildChronicleBranches(families);
    branches.forEach((branch, index) => container.append(createBranch(branch, index)));
}
