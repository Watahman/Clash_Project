import {
    getRedesignFixture,
    isRedesignFixtureRequested
} from '../fixtures/redesign-fixture-mode.js';

const FIXTURE_URL = '/fixtures/redesign/compete-cwl.json';
const WAR_FIXTURE_URL = '/fixtures/redesign/compete-war.json';
const MODULES = new Set(['cwl-tracker', 'war-board']);

let payloadPromise;
let warPayloadPromise;
let current;

export async function loadCompeteFixture({
    signal,
    location = typeof window === 'undefined' ? null : window.location
} = {}) {
    if (!location || !isRedesignFixtureRequested(location)) return null;
    const scenario = await getRedesignFixture(location);
    if (!MODULES.has(scenario.module)) return null;
    if (current?.id === scenario.id) return current;
    const payload = await loadPayload(scenario.module, signal);
    const data = payload?.[scenario.id];
    if (!data) throw new Error(`Fixture payload unavailable: ${scenario.id}`);
    current = Object.freeze({ ...scenario, data });
    return current;
}

export async function loadCwlFixture(options = {}) {
    const fixture = await loadCompeteFixture(options);
    return fixture?.module === 'cwl-tracker' ? fixture : null;
}

export async function loadWarFixture(options = {}) {
    const fixture = await loadCompeteFixture(options);
    return fixture?.module === 'war-board' ? fixture : null;
}

async function loadPayload(module, signal) {
    if (module === 'cwl-tracker') {
        payloadPromise ||= fetch(FIXTURE_URL, {
            credentials: 'same-origin',
            signal
        }).then(readPayload);
        return payloadPromise;
    }
    warPayloadPromise ||= fetch(WAR_FIXTURE_URL, {
        credentials: 'same-origin',
        signal
    }).then(readPayload);
    return warPayloadPromise;
}

async function readPayload(response) {
    if (!response.ok) throw new Error(`Compete fixture unavailable (${response.status})`);
    return response.json();
}

export function resetCompeteFixtureCache() {
    payloadPromise = undefined;
    warPayloadPromise = undefined;
    current = undefined;
}
