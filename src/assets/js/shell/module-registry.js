const icon = path => `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="${path}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const icons = Object.freeze({
    dashboard: icon('M4 11.5 12 5l8 6.5v7a1 1 0 0 1-1 1h-5v-5h-4v5H5a1 1 0 0 1-1-1v-7Z'),
    explore: icon('M12 3.5 15 9l5.5 3-5.5 3-3 5.5L9 15l-5.5-3L9 9l3-5.5Z'),
    groups: icon('M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 19v-1.5A3.5 3.5 0 0 1 7 14h3a3.5 3.5 0 0 1 3.5 3.5V19m0-4h2.5a3 3 0 0 1 3 3v1'),
    planner: icon('M5 6.5h14M5 12h14M5 17.5h14'),
    drafts: icon('M6 4.5h9l3 3v12H6v-15ZM9 11h6M9 15h6'),
    operation: icon('M5 19V9m5 10V5m5 14v-7m4 7V7'),
    warOperation: icon('M12 3 5.5 6v5.2c0 4.2 2.7 7.8 6.5 9.8 3.8-2 6.5-5.6 6.5-9.8V6L12 3Zm-3 11 6-6m-5.5.5 5 5'),
    bracket: icon('M6 5h4v4H6V5Zm8 10h4v4h-4v-4Zm0-10h4v4h-4V5ZM10 7h2v10h2M12 7h2'),
    minigames: icon('M8.5 8.5h7a5 5 0 0 1 4.8 3.6l1 3.5a3 3 0 0 1-5.1 2.9l-1.5-1.7H9.3l-1.5 1.7a3 3 0 0 1-5.1-2.9l1-3.5a5 5 0 0 1 4.8-3.6Zm-1 3v3M6 13h3m7-1h.01m2 2h.01M9 6h6'),
    advancedStats: icon('M5 18.5V14m4.7 4.5V9.5m4.6 9V12m4.7 6.5V5.5M5 10l4.7-3 4.6 2.1L19 4.5'),
    achievements: icon('M8 4h8v5a4 4 0 0 1-8 0V4Zm0 2H5v1.5A3.5 3.5 0 0 0 8.5 11M16 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 13v4m-3 3h6'),
    profile: icon('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0')
});

const sections = Object.freeze([
    { id: 'home', key: 'shell.home', fallback: 'Home' },
    { id: 'manage', key: 'shell.manage', fallback: 'Manage' },
    { id: 'plan', key: 'shell.plan', fallback: 'Plan' },
    { id: 'compete', key: 'shell.compete', fallback: 'Compete' },
    { id: 'play', key: 'shell.play', fallback: 'Play' },
    { id: 'progress', key: 'shell.progression', fallback: 'Progress' }
]);

const modules = Object.freeze([
    ['dashboard', 'nav.dashboard', 'Dashboard', 'home', '/dashboard', true],
    ['explore', 'nav.explore', 'Explore', 'home', '/app/explore', true],
    ['groups', 'nav.groups', 'Clan Family', 'manage', '/app/clan-management', true],
    ['planner', 'nav.cwl', 'CWL Planner', 'plan', '/app/cwl-planner', true],
    ['drafts', 'nav.savedPlans', 'Saved Plans', 'plan', '/app/cwl-planner-drafts', true],
    ['operation', 'nav.operation', 'CWL Tracker', 'compete', '/app/cwl-tracker', true],
    ['warOperation', 'nav.warOperation', 'War Board', 'compete', '/app/war-board', true],
    ['bracket', 'nav.bracket', 'Brackets', 'compete', '/app/brackets', true],
    ['minigames', 'nav.minigames', 'Minigames', 'play', '/app/minigames', true],
    ['advancedStats', 'nav.advancedStats', 'Advanced Stats', 'progress', '/app/advanced-stats', true, true],
    ['achievements', 'nav.achievements', 'Achievements', 'progress', '/app/achievements', true, true],
    ['profile', 'profile.title', 'Profile', 'home', '/app/profile', false]
].map(([id, key, fallback, section, href, available, comingSoon = false]) => Object.freeze({
    id,
    key,
    fallback,
    icon: icons[id],
    section,
    href,
    available,
    comingSoon,
    access: 'private'
})));

const moduleById = new Map(modules.map(module => [module.id, module]));

export function getWorkspaceModule(id) {
    return moduleById.get(id) || moduleById.get('dashboard');
}

export function getWorkspaceSections() {
    return sections.map(section => ({
        ...section,
        modules: modules.filter(module => module.available && module.section === section.id)
    }));
}

export { modules as WORKSPACE_MODULES, sections as WORKSPACE_SECTIONS };
