import {
    renderWarCwl,
    renderProgression,
    renderLeague,
    syncInsightTabs
} from './advanced-stats-insights-renderer.js?v=20260916-advanced-insights-v1';

const SECTIONS = ['overview', 'warCwl', 'progression', 'league'];
const RENDERERS = { warCwl: renderWarCwl, progression: renderProgression, league: renderLeague };
const ROOT_IDS = {
    warCwl: 'advanced-stats-war-cwl-root',
    progression: 'advanced-stats-progression-root',
    league: 'advanced-stats-league-root'
};

export function createInsightsController({ document, getPlayerTag, getPeriod, getTracking, getReader, onOverviewSelected }) {
    const tabList = document.getElementById('advanced-stats-tabs');
    const panelRoot = document.getElementById('advanced-stats-content');
    const roots = Object.fromEntries(Object.entries(ROOT_IDS)
        .map(([section, id]) => [section, document.getElementById(id)]));
    const cache = new Map();
    const states = new Map();
    let selected = 'overview';
    let generation = 0;
    let leagueCurrentSeason = false;

    function periodFor(section) {
        return section === 'league' && leagueCurrentSeason ? 'current-season' : getPeriod();
    }

    function keyFor(section) {
        return `${getPlayerTag()}|${periodFor(section)}|${section}`;
    }

    function renderSection(section) {
        const key = keyFor(section);
        RENDERERS[section]?.(roots[section], states.get(key) || { state: 'idle' });
    }

    function render() {
        syncInsightTabs(panelRoot, selected);
        const seasonButton = panelRoot?.querySelector('[data-insights-current-season]');
        seasonButton?.setAttribute('aria-pressed', String(leagueCurrentSeason));
        Object.keys(ROOT_IDS).forEach(renderSection);
    }

    async function load(section, force = false) {
        if (section === 'overview' || !getTracking()?.trackingExists) return;
        const key = keyFor(section);
        if (!force && cache.has(key)) return;
        if (!force && states.get(key)?.state === 'loading') return;
        const reader = getReader();
        if (typeof reader !== 'function') {
            states.set(key, { state: 'unavailable' });
            renderSection(section);
            return;
        }
        const requestGeneration = generation;
        states.set(key, { state: 'loading' });
        renderSection(section);
        try {
            const result = await reader(getPlayerTag(), periodFor(section), section);
            if (requestGeneration !== generation || key !== keyFor(section)) return;
            cache.set(key, result);
            states.set(key, result);
        } catch (error) {
            if (requestGeneration !== generation || key !== keyFor(section)) return;
            console.error('advanced_stats_insights_load_failed', { section, error });
            states.set(key, { state: 'error' });
        }
        renderSection(section);
    }

    function select(section, focus = false) {
        if (!SECTIONS.includes(section)) return;
        selected = section;
        render();
        if (focus) tabList?.querySelector(`[data-advanced-stats-tab="${section}"]`)?.focus();
        if (section === 'overview') onOverviewSelected?.();
        else void load(section);
    }

    function onKeydown(event) {
        const tab = event.target.closest('[data-advanced-stats-tab]');
        if (!tab) return;
        const index = SECTIONS.indexOf(tab.dataset.advancedStatsTab);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? SECTIONS.length - 1
            : event.key === 'ArrowRight' ? (index + 1) % SECTIONS.length
            : event.key === 'ArrowLeft' ? (index + SECTIONS.length - 1) % SECTIONS.length : -1;
        if (next < 0) return;
        event.preventDefault();
        select(SECTIONS[next], true);
    }

    function bind() {
        tabList?.addEventListener('click', event => {
            const section = event.target.closest('[data-advanced-stats-tab]')?.dataset.advancedStatsTab;
            if (section) select(section);
        });
        tabList?.addEventListener('keydown', onKeydown);
        panelRoot?.querySelector('[data-insights-current-season]')?.addEventListener('click', () => {
            leagueCurrentSeason = !leagueCurrentSeason;
            render();
            if (selected === 'league') void load('league');
        });
        render();
    }

    function reset() {
        generation += 1;
        cache.clear();
        states.clear();
        render();
    }

    return {
        bind,
        render,
        reset,
        refreshActive: () => load(selected, true),
        clearSeason: () => { leagueCurrentSeason = false; render(); },
        selected: () => selected
    };
}
