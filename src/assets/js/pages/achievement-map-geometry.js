const SVG_NS = 'http://www.w3.org/2000/svg';
const Y_PATTERN = Object.freeze([72, 126, 92, 146, 62, 112]);

export const CHRONICLE_NODE_WIDTH = 124;

function number(value, fallback = 0) {
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
}

/**
 * Returns a compact, deterministic Chronicle layout for one progression family.
 * The index shifts the pattern so adjacent families do not become flat copies.
 */
export function chronicleClusterGeometry(count, familyIndex = 0) {
    const total = Math.max(1, Math.trunc(number(count, 1)));
    const index = Math.max(0, Math.trunc(number(familyIndex)));
    const step = total <= 3 ? 136 + (index % 3) * 4 : total <= 5 ? 132 + (index % 2) * 4 : 128;
    const positions = Array.from({ length: total }, (_, tierIndex) => ({
        x: 64 + tierIndex * step,
        y: Y_PATTERN[(tierIndex + index) % Y_PATTERN.length]
    }));
    return {
        positions,
        width: Math.max(390, positions.at(-1).x + 72),
        height: 230
    };
}

function pathBetween(start, end, state) {
    const path = document.createElementNS(SVG_NS, 'path');
    const midpoint = (start.x + end.x) / 2;
    path.classList.add('achievement-map-bezier');
    path.dataset.state = state;
    path.dataset.pathState = state;
    path.setAttribute('d', `M ${start.x} ${start.y} C ${midpoint} ${start.y}, ${midpoint} ${end.y}, ${end.x} ${end.y}`);
    path.setAttribute('pathLength', '1');
    return path;
}

/** Build the single SVG overlay for a family, using the following tier's state. */
export function progressionSvg(geometry, tiers, stateForTier) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.classList.add('achievement-map-path', 'achievement-progression-paths');
    svg.setAttribute('viewBox', `0 0 ${geometry.width} ${geometry.height}`);
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');
    geometry.positions.slice(0, -1).forEach((position, index) => {
        const nextState = stateForTier(tiers[index + 1]);
        svg.append(pathBetween(position, geometry.positions[index + 1], nextState));
    });
    return svg;
}

export function applyNodePosition(node, position, index) {
    node.style.setProperty('--node-x', `${position.x}px`);
    node.style.setProperty('--node-y', `${position.y}px`);
    node.style.setProperty('--node-order', String(index));
}

export function setAchievementTooltipVisible(stop, visible, pinned = false) {
    const node = stop.querySelector('.achievement-map-node-button');
    const tooltip = stop.querySelector('.achievement-map-tooltip');
    stop.classList.toggle('is-open', visible);
    stop.classList.toggle('is-pinned', visible && pinned);
    node?.setAttribute('aria-expanded', String(visible));
    tooltip?.setAttribute('aria-hidden', String(!visible));
}

export function bindAchievementTooltip(stop, scope) {
    const node = stop.querySelector('.achievement-map-node-button');
    if (!node) return;
    node.addEventListener('pointerenter', () => setAchievementTooltipVisible(
        stop, true, stop.classList.contains('is-pinned')
    ));
    node.addEventListener('pointerleave', () => {
        if (!stop.classList.contains('is-pinned') && !node.matches(':focus')) {
            setAchievementTooltipVisible(stop, false);
        }
    });
    node.addEventListener('focus', () => setAchievementTooltipVisible(
        stop, true, stop.classList.contains('is-pinned')
    ));
    node.addEventListener('blur', () => {
        if (!stop.classList.contains('is-pinned')) setAchievementTooltipVisible(stop, false);
    });
    node.addEventListener('click', () => {
        const pin = !stop.classList.contains('is-pinned');
        scope.querySelectorAll('.achievement-map-stop.is-open').forEach(other => {
            if (other !== stop) setAchievementTooltipVisible(other, false);
        });
        setAchievementTooltipVisible(stop, pin, pin);
    });
    node.addEventListener('keydown', event => {
        if (event.key === 'Escape') setAchievementTooltipVisible(stop, false);
    });
}
