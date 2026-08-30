import {
    getRedesignFixture,
    isLocalFixtureHost,
    isRedesignFixtureRequested
} from './redesign-fixture-mode.js';
import {
    applyAvailabilityToAllPlayerCards,
    clearActiveCwlPoll,
    setActiveCwlPoll
} from '../cwl/cwl-availability.js?v=20260829-public-auth-v1';
import { createClanCard, createPlayerCard } from '../templates/CWLTemplates.js?v=20260830-card-settings';
import { updateAllPlayerCounters } from '../cwl/cwl-planner-card-state.js?v=20260829-public-auth-v1';

const DAYS = Object.freeze([1, 2, 3, 4, 5, 6, 7]);
const ALL_DAYS = [...DAYS];
const CLAN_BADGES = Object.freeze([
    '/assets/fixtures/clan-badges/ember-legion.png',
    '/assets/fixtures/clan-badges/northwind-main.png',
    '/assets/fixtures/clan-badges/northwind-academy.png'
]);
const PLAYER_NAMES = Object.freeze([
    'Aster', 'Bramble', 'Cobalt', 'Dusk', 'Ember', 'Freya', 'Griffin', 'Havoc',
    'Iris', 'Jasper', 'Kael', 'Lyra', 'Mako', 'Nova', 'Orion', 'Pyre', 'Quinn',
    'Ragnar', 'Sable', 'Thorne', 'Ursa', 'Vale', 'Willow', 'Xander', 'Yara',
    'Zephyr', 'Atlas', 'Blaze', 'Cirrus', 'Drake', 'Echo', 'Flint', 'Gale',
    'Halo', 'Indigo', 'Juno', 'Knox', 'Lumen', 'Mira', 'Nyx', 'Onyx', 'Piper',
    'Quartz', 'Rune', 'Skye', 'Talon', 'Umber', 'Vex', 'Wren', 'Xena', 'Ymir',
    'Zora', 'Arden', 'Briar', 'Cinder', 'Delta', 'Elio', 'Fable', 'Glimmer',
    'Harbor', 'Ivory', 'Jet', 'Koda', 'Lotus', 'Maven'
]);

export const PLANNER_FIXTURE_IDS = Object.freeze([
    'planner-empty',
    'planner-normal',
    'planner-large',
    'planner-multi-clan',
    'planner-conflicts',
    'planner-poll-partial',
    'planner-auto-preview',
    'planner-optimize'
]);

export async function getRequestedPlannerFixture(location = window.location) {
    if (!isRedesignFixtureRequested(location)) return null;
    const fixture = await getRedesignFixture(location);
    return fixture?.module === 'planner' ? fixture : null;
}

export function getPlannerFixtureData(id) {
    if (!PLANNER_FIXTURE_IDS.includes(id)) throw new Error(`Unknown planner fixture: ${id}`);
    const data = {
        'planner-empty': buildEmpty(),
        'planner-normal': buildNormal(),
        'planner-large': buildLarge(),
        'planner-multi-clan': buildMultiClan(),
        'planner-conflicts': buildConflicts(),
        'planner-poll-partial': buildPollPartial(),
        'planner-auto-preview': buildAutoPreview(),
        'planner-optimize': buildOptimize()
    }[id];
    return data;
}

export function applyPlannerFixture(fixture, { root = document, location = window.location } = {}) {
    if (!isLocalFixtureHost(location)) {
        throw new Error('Planner fixtures are restricted to localhost.');
    }
    if (!fixture?.id || fixture.module !== 'planner') return null;

    const data = getPlannerFixtureData(fixture.id);
    const available = root.querySelector('#cwl-available-players');
    const clansRoot = root.querySelector('#cwl-all-clans');
    if (!available || !clansRoot) throw new Error('Planner fixture targets are unavailable.');

    clearActiveCwlPoll();
    if (data.poll) setActiveCwlPoll(data.poll.groupId, data.poll);
    available.replaceChildren();
    clansRoot.replaceChildren();
    root.querySelector('#cwl-plan-name')?.setAttribute('value', data.name);
    if (root.querySelector('#cwl-plan-name')) root.querySelector('#cwl-plan-name').value = data.name;
    if (root.querySelector('#cwl-load-plan')) root.querySelector('#cwl-load-plan').value = '';

    data.info.clans.forEach(clan => {
        createClanCard({ ...clan, warLeague: { name: clan.league } }, clan.capacity, clan.id, { persist: false });
    });
    data.info.freePlayers.forEach(player => createPlayerCard(player, null, { persist: false }));
    data.info.clans.forEach(clan => clan.players.forEach(player => {
        createPlayerCard(player, clan.id, { persist: false });
    }));

    applyAvailabilityToAllPlayerCards();
    updateAllPlayerCounters();
    root.documentElement?.setAttribute('data-planner-fixture', data.id);
    root.querySelector('.workspace-planner')?.setAttribute('data-fixture-scenario', data.id);
    window.dispatchEvent(new CustomEvent('clashtools:cwl-plan-meta-loaded', {
        detail: data.info.pollMeta
    }));
    window.dispatchEvent(new CustomEvent('clashtools:cwl-plan-loaded', {
        detail: { fixture: data.id }
    }));
    window.dispatchEvent(new CustomEvent('clashpanel:planner-fixture-applied', {
        detail: { id: data.id, counts: fixtureCounts(data) }
    }));
    queueFixtureTool(data.tool);
    return data;
}

function queueFixtureTool(tool) {
    const button = tool === 'auto'
        ? document.querySelector('#cwl-auto-plan-button')
        : tool === 'optimize' ? document.querySelector('#cwl-optimize-plan-button') : null;
    if (button) queueMicrotask(() => button.click());
}

function fixtureCounts(data) {
    return {
        clans: data.info.clans.length,
        players: [...data.info.freePlayers, ...data.info.clans.flatMap(clan => clan.players)].length,
        freePlayers: data.info.freePlayers.length,
        rounds: data.rounds
    };
}

function buildEmpty() {
    return makeScenario('planner-empty', 'Empty fixture', [], [], null);
}

function buildNormal() {
    const players = makePlayers(20, () => availability('yes'));
    return makeScenario('planner-normal', 'Normal planning fixture', [clan('alpha', 'Alpha Guard', 'Master League I')], players);
}

function buildLarge() {
    const players = makePlayers(65, index => largeAvailability(index));
    const clans = [
        clan('alpha', 'Alpha Guard', 'Champion League II'),
        clan('bravo', 'Bravo Forge', 'Master League I'),
        clan('charlie', 'Charlie Watch', 'Crystal League I')
    ];
    assignPlayers(players, clans, 15, 0, 13);
    assignPlayers(players, clans, 15, 15, 13);
    assignPlayers(players, clans, 15, 30, 13);
    return makeScenario('planner-large', 'Large planning fixture', clans, players);
}

function buildMultiClan() {
    const players = makePlayers(30, () => availability('yes'));
    const clans = [
        clan('north', 'North Guard', 'Master League I'),
        clan('south', 'South Watch', 'Crystal League I')
    ];
    assignPlayers(players, clans, 15, 0, 14);
    assignPlayers(players, clans, 15, 15, 14);
    return makeScenario('planner-multi-clan', 'Multi-clan roster fixture', clans, players);
}

function buildConflicts() {
    const players = makePlayers(32, index => conflictAvailability(index));
    const clans = [
        clan('overlook', 'Overlook Keep', 'Master League I'),
        clan('watchtower', 'Watchtower', 'Crystal League I')
    ];
    assignPlayers(players, clans, 16, 0, 16);
    assignPlayers(players, clans, 16, 16, 16);
    return makeScenario('planner-conflicts', 'Conflict review fixture', clans, players);
}

function buildPollPartial() {
    const players = makePlayers(15, index => partialAvailability(index));
    const clans = [clan('poll', 'Poll Review', 'Master League I')];
    assignPlayers(players, clans, 15, 0, 15);
    return makeScenario('planner-poll-partial', 'Partial poll fixture', clans, players);
}

function buildAutoPreview() {
    const players = makePlayers(20, () => availability('yes'));
    return makeScenario('planner-auto-preview', 'Auto Plan preview fixture', [
        clan('preview', 'Preview Guard', 'Master League I')
    ], players, undefined, 'auto');
}

function buildOptimize() {
    const players = makePlayers(31, () => availability('yes'));
    const clans = [
        clan('source', 'Source Guard', 'Master League I'),
        clan('target', 'Target Watch', 'Crystal League I')
    ];
    assignPlayers(players, clans, 17, 0, 15, 2);
    assignPlayers(players, clans, 14, 17, 14);
    return makeScenario('planner-optimize', 'Optimize preview fixture', clans, players, undefined, 'optimize');
}

function makeScenario(id, name, clans, players, poll = undefined, tool = '') {
    const activePoll = poll === undefined ? makePoll(players, id) : poll;
    clans.forEach(item => {
        item.players = players.filter(player => player.currentClanId === item.id);
    });
    return {
        id,
        name,
        rounds: 7,
        tool,
        poll: activePoll,
        info: {
            schemaVersion: 4,
            freePlayers: players.filter(player => !player.currentClanId),
            clans,
            pollMeta: activePoll
                ? { groupId: activePoll.groupId, pollId: activePoll.id }
                : { groupId: '', pollId: '' }
        },
        players
    };
}

function clan(id, name, league, capacity = 15) {
    const badgeIndex = Math.abs([...id].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % CLAN_BADGES.length;
    return {
        id,
        tag: `#FX${id.toUpperCase()}`,
        name,
        league,
        capacity,
        players: [],
        badgeUrls: { small: CLAN_BADGES[badgeIndex] }
    };
}

function makePlayers(count, availabilityFor) {
    return Array.from({ length: count }, (_, index) => {
        const current = availabilityFor(index);
        return {
            tag: `#FXP${String(index + 1).padStart(3, '0')}`,
            name: PLAYER_NAMES[index % PLAYER_NAMES.length],
            townHallLevel: [17, 16, 15, 14][index % 4],
            clanName: '',
            currentClanId: null,
            rosterStatus: '',
            availability: current,
            performance: { status: 'unavailable', scope: 'Fixture data' }
        };
    });
}

function assignPlayers(players, clans, count, start, roleCount, reserveCount = 0) {
    const clan = clans[Math.floor(start / 15) % clans.length];
    players.slice(start, start + count).forEach((player, index) => {
        const reserve = reserveCount ? index >= count - reserveCount : false;
        const role = reserve ? 'reserve' : index < roleCount ? 'core' : 'rotation';
        Object.assign(player, {
            clanName: clan.name,
            currentClanId: clan.id,
            rosterStatus: role
        });
    });
}

function availability(state, availableDays = ALL_DAYS) {
    return { state, rounds: 7, availableDays: [...availableDays] };
}

function largeAvailability(index) {
    return index % 7 === 2
        ? availability('partial', [1, 2, 4, 6, 7])
        : index % 7 === 3 ? availability('unknown') : availability('yes');
}

function conflictAvailability(index) {
    if (index % 5 === 0) return availability('no', []);
    if (index % 5 === 1) return availability('partial', [1, 3, 5, 7]);
    if (index % 5 === 2) return availability('unknown');
    return availability('yes');
}

function partialAvailability(index) {
    if (index < 5) return availability('yes');
    if (index < 9) return availability('no', []);
    if (index < 12) return availability('unknown');
    return availability('partial', [1, 2, 4, 6]);
}

function makePoll(players, fixtureId) {
    const groups = { confirmed: [], partial: [], unavailable: [] };
    players.forEach(player => {
        const state = player.availability?.state;
        if (state === 'unknown') return;
        if (state === 'no') {
            groups.unavailable.push({ tag: player.tag, wantsCwl: false, days: {} });
            return;
        }
        const days = Object.fromEntries(DAYS.map(day => [String(day), player.availability.availableDays.includes(day)]));
        groups[state === 'partial' ? 'partial' : 'confirmed'].push({
            tag: player.tag,
            wantsCwl: true,
            days
        });
    });
    return {
        id: `fixture-poll-${fixtureId}`,
        groupId: 'fixture-family',
        type: 'cwl_availability',
        status: 'open',
        rounds: 7,
        created_at: '2026-01-15T00:00:00.000Z',
        answers: Object.fromEntries(Object.entries(groups).map(([key, accounts]) => [key, { accounts }]))
    };
}
