export const GROUP_BADGES = ['shield', 'swords', 'crown', 'war_star', 'tower', 'flame', 'banner', 'helmet'];

const SVG = {
    shield: '<path d="M12 2 4 5v6c0 5 3.4 8.6 8 11 4.6-2.4 8-6 8-11V5l-8-3Z"/><path d="M12 6v11"/>',
    swords: '<path d="m14 4 6 6-2 2-6-6 2-2Z"/><path d="M4 20 14 10"/><path d="m10 4-6 6 2 2 6-6-2-2Z"/><path d="m20 20-10-10"/>',
    crown: '<path d="m3 8 5 4 4-7 4 7 5-4-2 11H5L3 8Z"/><path d="M5 19h14"/>',
    war_star: '<path d="m12 3 2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.4-4.2 6-.9L12 3Z"/>',
    tower: '<path d="M7 21V9h10v12"/><path d="M6 9V4h3v2h2V4h2v2h2V4h3v5"/><path d="M10 21v-5a2 2 0 0 1 4 0v5"/>',
    flame: '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-5-9-.4 3-2 4.5-4 6 .3-3-1-5-2-7-1 4-4 6-4 10 0 4 4 7 8 7Z"/>',
    banner: '<path d="M6 22V4"/><path d="M6 4h12l-3 5 3 5H6"/>',
    helmet: '<path d="M4 14a8 8 0 1 1 16 0v3H4v-3Z"/><path d="M9 17v-5h6v5"/><path d="M4 17h16v3H4z"/>'
};

export function normalizeGroupBadge(value) {
    return GROUP_BADGES.includes(value) ? value : 'shield';
}

export function badgeSvg(badge, className = 'groups-badge-svg') {
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${SVG[normalizeGroupBadge(badge)]}</svg>`;
}

export function renderBadge(element, badge) {
    if (!element) return;
    element.innerHTML = badgeSvg(badge);
    element.dataset.badge = normalizeGroupBadge(badge);
}

export function badgeLabelKey(badge) {
    return `groups.badge.${normalizeGroupBadge(badge)}`;
}
