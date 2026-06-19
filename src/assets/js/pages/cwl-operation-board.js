import { profileHTML } from '../profile/profile_popup.js';
import { initI18n, t } from '../i18n/i18n.js';

const STORAGE_KEY = 'clashtools_cwl_operation_board_v1';
const SAVE_DELAY = 350;

const defaultState = () => ({
    players: [],
    rounds: Array.from({ length: 7 }, (_, index) => ({
        day: index + 1,
        opponent: '',
        lineupSize: 15,
        stars: 0,
        destruction: 0,
        attacksUsed: 0,
        result: 'pending',
        notes: ''
    }))
});

let state = loadState();
let saveTimer;

const refs = {};

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultState();
        const parsed = JSON.parse(raw);
        return {
            players: Array.isArray(parsed.players) ? parsed.players : [],
            rounds: Array.isArray(parsed.rounds) && parsed.rounds.length === 7 ? parsed.rounds : defaultState().rounds
        };
    } catch {
        return defaultState();
    }
}

function saveState() {
    refs.saveState.textContent = 'saving';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        refs.saveState.textContent = 'saved';
    }, SAVE_DELAY);
}

function uid() {
    return crypto?.randomUUID?.() || 'id_' + Date.now() + '_' + Math.random().toString(16).slice(2);
}

function initRefs() {
    refs.addPlayer = document.querySelector('#op-add-player');
    refs.importPlanner = document.querySelector('#op-import-planner');
    refs.exportBtn = document.querySelector('#op-export');
    refs.importFile = document.querySelector('#op-import-file');
    refs.resetBtn = document.querySelector('#op-reset');
    refs.saveState = document.querySelector('#op-save-state');
    refs.totalStars = document.querySelector('#op-total-stars');
    refs.avgDestruction = document.querySelector('#op-avg-destruction');
    refs.attacksUsed = document.querySelector('#op-attacks-used');
    refs.missed = document.querySelector('#op-missed-attacks');
    refs.thList = document.querySelector('#op-th-list');
    refs.rosterCount = document.querySelector('#op-roster-count');
    refs.rosterBody = document.querySelector('#op-roster-body');
    refs.roundsList = document.querySelector('#op-rounds-list');
    refs.bonusList = document.querySelector('#op-bonus-list');
}

function initEvents() {
    refs.addPlayer.onclick = () => {
        state.players.push({ id: uid(), selected: true, name: 'New player', tag: '#TAG', townHall: 16, stars: 0, destruction: 0, attacksUsed: 0, missed: 0, notes: '' });
        render();
        saveState();
    };

    refs.importPlanner.onclick = () => importFromPlannerDomOrStorage();

    refs.exportBtn.onclick = () => {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'clashtools-cwl-operation-board.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    refs.importFile.onchange = () => {
        const file = refs.importFile.files?.[0];
        if (!file) return;
        file.text().then(text => {
            const parsed = JSON.parse(text);
            state = {
                players: Array.isArray(parsed.players) ? parsed.players : [],
                rounds: Array.isArray(parsed.rounds) && parsed.rounds.length === 7 ? parsed.rounds : defaultState().rounds
            };
            render();
            saveState();
        }).catch(error => console.error(error));
    };

    refs.resetBtn.onclick = () => {
        if (!confirm('Reset CWL Operation Board?')) return;
        state = defaultState();
        render();
        saveState();
    };
}

function importFromPlannerDomOrStorage() {
    const plannerPlayers = JSON.parse(localStorage.getItem('clashtools_last_planner_players') || '[]');
    const existingTags = new Set(state.players.map(player => player.tag));
    const toAdd = plannerPlayers.filter(player => player.tag && !existingTags.has(player.tag));
    if (toAdd.length === 0) {
        state.players.push({ id: uid(), selected: true, name: 'Manual player', tag: '#TAG', townHall: 16, stars: 0, destruction: 0, attacksUsed: 0, missed: 0, notes: '' });
    } else {
        toAdd.forEach(player => state.players.push({
            id: uid(),
            selected: true,
            name: player.name || 'Player',
            tag: player.tag,
            townHall: Number(player.townHall || player.townHallLevel || 1),
            stars: 0,
            destruction: 0,
            attacksUsed: 0,
            missed: 0,
            notes: ''
        }));
    }
    render();
    saveState();
}

function render() {
    renderRoster();
    renderRounds();
    renderScoreboard();
    renderBonusAdvice();
}

function renderRoster() {
    refs.rosterBody.replaceChildren();
    refs.rosterCount.textContent = `${state.players.length} spelers`;

    state.players.forEach(player => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="checkbox" class="op-player-selected" ${player.selected ? 'checked' : ''}></td>
            <td><input class="op-player-name" value="${escapeAttr(player.name)}"><input class="op-player-tag" value="${escapeAttr(player.tag)}"></td>
            <td><input type="number" min="1" max="18" class="op-player-th" value="${Number(player.townHall) || 1}"></td>
            <td><input type="number" min="0" max="21" class="op-player-stars" value="${Number(player.stars) || 0}"></td>
            <td><input type="number" min="0" max="700" step="0.1" class="op-player-destruction" value="${Number(player.destruction) || 0}"></td>
            <td><input type="number" min="0" max="7" class="op-player-attacks" value="${Number(player.attacksUsed) || 0}"></td>
            <td><input type="number" min="0" max="7" class="op-player-missed" value="${Number(player.missed) || 0}"></td>
            <td><input class="op-player-notes" value="${escapeAttr(player.notes || '')}"></td>
            <td><button class="op-row-delete" aria-label="delete">×</button></td>
        `;
        bindRosterRow(row, player);
        refs.rosterBody.appendChild(row);
    });
}

function bindRosterRow(row, player) {
    row.querySelector('.op-player-selected').onchange = e => updatePlayer(player.id, 'selected', e.target.checked);
    row.querySelector('.op-player-name').oninput = e => updatePlayer(player.id, 'name', e.target.value);
    row.querySelector('.op-player-tag').oninput = e => updatePlayer(player.id, 'tag', e.target.value);
    row.querySelector('.op-player-th').oninput = e => updatePlayer(player.id, 'townHall', Number(e.target.value));
    row.querySelector('.op-player-stars').oninput = e => updatePlayer(player.id, 'stars', Number(e.target.value));
    row.querySelector('.op-player-destruction').oninput = e => updatePlayer(player.id, 'destruction', Number(e.target.value));
    row.querySelector('.op-player-attacks').oninput = e => updatePlayer(player.id, 'attacksUsed', Number(e.target.value));
    row.querySelector('.op-player-missed').oninput = e => updatePlayer(player.id, 'missed', Number(e.target.value));
    row.querySelector('.op-player-notes').oninput = e => updatePlayer(player.id, 'notes', e.target.value, false);
    row.querySelector('.op-row-delete').onclick = () => {
        state.players = state.players.filter(candidate => candidate.id !== player.id);
        render();
        saveState();
    };
}

function updatePlayer(id, field, value, rerender = true) {
    const player = state.players.find(candidate => candidate.id === id);
    if (!player) return;
    player[field] = value;
    if (rerender) {
        renderScoreboard();
        renderBonusAdvice();
    }
    saveState();
}

function renderRounds() {
    refs.roundsList.replaceChildren();
    state.rounds.forEach(round => {
        const card = document.createElement('article');
        card.className = 'op-round-card';
        card.innerHTML = `
            <div class="op-round-title"><strong>Day ${round.day}</strong><select class="op-round-result"><option value="pending">Pending</option><option value="win">Win</option><option value="loss">Loss</option><option value="draw">Draw</option></select></div>
            <input class="op-round-opponent" placeholder="Opponent clan" value="${escapeAttr(round.opponent || '')}">
            <div class="op-round-stats">
                <label>Stars<input type="number" min="0" max="45" class="op-round-stars" value="${Number(round.stars) || 0}"></label>
                <label>Dest %<input type="number" min="0" max="100" step="0.1" class="op-round-destruction" value="${Number(round.destruction) || 0}"></label>
                <label>Attacks<input type="number" min="0" max="30" class="op-round-attacks" value="${Number(round.attacksUsed) || 0}"></label>
            </div>
            <textarea class="op-round-notes" placeholder="Lineup / target notes">${escapeHtml(round.notes || '')}</textarea>
        `;
        const result = card.querySelector('.op-round-result');
        result.value = round.result || 'pending';
        bindRoundCard(card, round.day);
        refs.roundsList.appendChild(card);
    });
}

function bindRoundCard(card, day) {
    const round = state.rounds.find(candidate => candidate.day === day);
    card.querySelector('.op-round-result').onchange = e => updateRound(day, 'result', e.target.value);
    card.querySelector('.op-round-opponent').oninput = e => updateRound(day, 'opponent', e.target.value, false);
    card.querySelector('.op-round-stars').oninput = e => updateRound(day, 'stars', Number(e.target.value));
    card.querySelector('.op-round-destruction').oninput = e => updateRound(day, 'destruction', Number(e.target.value));
    card.querySelector('.op-round-attacks').oninput = e => updateRound(day, 'attacksUsed', Number(e.target.value));
    card.querySelector('.op-round-notes').oninput = e => updateRound(day, 'notes', e.target.value, false);
}

function updateRound(day, field, value, rerender = true) {
    const round = state.rounds.find(candidate => candidate.day === day);
    if (!round) return;
    round[field] = value;
    if (rerender) renderScoreboard();
    saveState();
}

function renderScoreboard() {
    const totalStars = state.rounds.reduce((sum, round) => sum + Number(round.stars || 0), 0);
    const activeDestruction = state.rounds.filter(round => Number(round.destruction) > 0);
    const avgDestruction = activeDestruction.length
        ? activeDestruction.reduce((sum, round) => sum + Number(round.destruction || 0), 0) / activeDestruction.length
        : 0;
    const attacksUsed = state.players.reduce((sum, player) => sum + Number(player.attacksUsed || 0), 0);
    const missed = state.players.reduce((sum, player) => sum + Number(player.missed || 0), 0);

    refs.totalStars.textContent = totalStars;
    refs.avgDestruction.textContent = avgDestruction.toFixed(1) + '%';
    refs.attacksUsed.textContent = attacksUsed;
    refs.missed.textContent = missed;

    const distribution = state.players.reduce((acc, player) => {
        const th = Number(player.townHall) || 0;
        if (!th) return acc;
        acc[th] = (acc[th] || 0) + 1;
        return acc;
    }, {});
    refs.thList.replaceChildren();
    Object.entries(distribution).sort((a, b) => Number(b[0]) - Number(a[0])).forEach(([th, amount]) => {
        const item = document.createElement('span');
        item.textContent = `TH${th}: ${amount}`;
        refs.thList.appendChild(item);
    });
    if (Object.keys(distribution).length === 0) {
        const item = document.createElement('span');
        item.textContent = 'No roster yet';
        refs.thList.appendChild(item);
    }
}

function renderBonusAdvice() {
    refs.bonusList.replaceChildren();
    const ranked = [...state.players]
        .map(player => ({
            ...player,
            score: (Number(player.stars || 0) * 100)
                + (Number(player.destruction || 0) * 0.6)
                + (Number(player.attacksUsed || 0) * 18)
                + (player.selected ? 8 : 0)
                - (Number(player.missed || 0) * 120)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    if (ranked.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'Nog geen spelers';
        refs.bonusList.appendChild(li);
        return;
    }

    ranked.forEach(player => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${escapeHtml(player.name)}</strong><span>${Number(player.stars || 0)}★ · ${Number(player.destruction || 0)}% · ${Number(player.attacksUsed || 0)}/7 attacks · ${Number(player.missed || 0)} missed</span>`;
        refs.bonusList.appendChild(li);
    });
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, '&#39;');
}

function init() {
    initRefs();
    initI18n();
    profileHTML();
    initEvents();
    render();
}

init();
