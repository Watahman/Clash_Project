const FIXTURE_PARAM = 'cpFixture';
const CATALOG_URL = '/fixtures/redesign/scenarios.json';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

let scenarioPromise;
let activeScenario;

function isLocalFixtureHost(location = window.location) {
    return LOCAL_HOSTS.has(location.hostname);
}

function requestedFixtureId(location = window.location) {
    return new URLSearchParams(location.search).get(FIXTURE_PARAM)?.trim() || '';
}

export function isRedesignFixtureRequested(location = window.location) {
    return isLocalFixtureHost(location) && Boolean(requestedFixtureId(location));
}

function renderBadge(label, error = false) {
    let badge = document.querySelector('[data-redesign-fixture-badge]');
    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'cp-fixture-badge';
        badge.dataset.redesignFixtureBadge = 'true';
        badge.setAttribute('role', 'status');
        document.body.appendChild(badge);
    }
    badge.dataset.fixtureError = String(error);
    badge.textContent = label;
}

async function loadScenarios() {
    scenarioPromise ||= fetch(CATALOG_URL, { credentials: 'same-origin' })
        .then(response => {
            if (!response.ok) throw new Error(`Fixture catalog unavailable (${response.status})`);
            return response.json();
        })
        .then(value => Array.isArray(value) ? value : value?.scenarios || []);
    return scenarioPromise;
}

export async function getRedesignFixture(location = window.location) {
    const id = requestedFixtureId(location);
    if (!id) return null;
    if (!isLocalFixtureHost(location)) {
        throw new Error('Redesign fixtures are restricted to localhost.');
    }
    if (activeScenario?.id === id) return activeScenario;
    const scenarios = await loadScenarios();
    const scenario = scenarios.find(candidate => candidate.id === id);
    if (!scenario) throw new Error(`Unknown redesign fixture: ${id}`);
    activeScenario = Object.freeze({ ...scenario });
    return activeScenario;
}

export async function initRedesignFixtureMode() {
    if (!requestedFixtureId()) return null;
    try {
        const fixture = await getRedesignFixture();
        document.documentElement.dataset.redesignFixture = fixture.id;
        renderBadge(`Fixture mode · ${fixture.id}`);
        window.dispatchEvent(new CustomEvent('clashpanel:fixture-ready', { detail: fixture }));
        return fixture;
    } catch (error) {
        renderBadge(error.message, true);
        throw error;
    }
}

export function fixtureMatches(moduleId, state) {
    if (!activeScenario) return false;
    const fixtureModule = activeScenario.module || activeScenario.area;
    return fixtureModule === moduleId && (!state || activeScenario.state === state);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const start = () => void initRedesignFixtureMode().catch(error => {
        console.error('[redesign-fixture]', error);
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
}

export { FIXTURE_PARAM, isLocalFixtureHost };
