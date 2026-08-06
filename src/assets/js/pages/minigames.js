import { TROOP_CATEGORY, TROOPS, ENTITY_GUESSER_DATA_VERSION } from '../minigames/entity-guesser-data.js';
import {
    DAILY_STORAGE_KEY,
    STATS_STORAGE_KEY,
    availableHintCount,
    buildHint,
    calculateScore,
    compareEntity,
    findEntity,
    getDailyEntity,
    getPracticeEntity,
    isWinningGuess,
    resultSquares,
    searchEntities,
    updateStreak,
    utcDateKey
} from '../minigames/entity-guesser-engine.js';

const TEXT = {
    en: {
        daily: 'Daily', practice: 'Practice', attempts: 'Attempts', score: 'Score', streak: 'Streak', best: 'Best',
        category: 'Home Village Troops', input: 'Type a troop name', submit: 'Submit guess', hint: 'Reveal hint',
        newPractice: 'New practice round', share: 'Share result', copied: 'Result copied', invalid: 'Choose a valid troop from the list.',
        duplicate: 'You already guessed that troop.', win: 'Correct!', loss: 'Round over', answer: 'The answer was',
        noHint: 'A hint unlocks after attempt 3.', hintReady: 'A hint is available.', dailyDone: 'Today’s daily challenge is complete.',
        practiceNote: 'Practice rounds do not affect your daily streak.', dailyNote: 'The same troop is used for everyone until 00:00 UTC.',
        instructions: 'Compare each property. Arrows show whether the hidden value is higher or lower.',
        correct: 'Exact match', close: 'Close value', higher: 'Hidden value is higher', lower: 'Hidden value is lower', wrong: 'Different',
        type: 'Type', move: 'Move', targets: 'Targets', favorite: 'Favorite', housing: 'Housing', th: 'TH', attack: 'Attack', role: 'Role'
    },
    nl: {
        daily: 'Dagelijks', practice: 'Oefenen', attempts: 'Pogingen', score: 'Score', streak: 'Reeks', best: 'Beste',
        category: 'Thuisdorp-troepen', input: 'Typ een troepnaam', submit: 'Dien gok in', hint: 'Toon hint',
        newPractice: 'Nieuwe oefenronde', share: 'Deel resultaat', copied: 'Resultaat gekopieerd', invalid: 'Kies een geldige troep uit de lijst.',
        duplicate: 'Je hebt die troep al gekozen.', win: 'Juist!', loss: 'Ronde voorbij', answer: 'Het antwoord was',
        noHint: 'Na poging 3 komt een hint vrij.', hintReady: 'Er is een hint beschikbaar.', dailyDone: 'De dagelijkse uitdaging is voltooid.',
        practiceNote: 'Oefenrondes hebben geen invloed op je dagelijkse reeks.', dailyNote: 'Iedereen krijgt tot 00:00 UTC dezelfde troep.',
        instructions: 'Vergelijk elke eigenschap. Pijlen tonen of de verborgen waarde hoger of lager ligt.',
        correct: 'Exact gelijk', close: 'Dichte waarde', higher: 'Verborgen waarde is hoger', lower: 'Verborgen waarde is lager', wrong: 'Anders',
        type: 'Type', move: 'Beweging', targets: 'Doelen', favorite: 'Voorkeur', housing: 'Ruimte', th: 'TH', attack: 'Aanval', role: 'Rol'
    },
    de: {
        daily: 'Täglich', practice: 'Üben', attempts: 'Versuche', score: 'Punkte', streak: 'Serie', best: 'Bestwert',
        category: 'Heimatdorf-Truppen', input: 'Truppenname eingeben', submit: 'Tipp abgeben', hint: 'Hinweis zeigen',
        newPractice: 'Neue Übungsrunde', share: 'Ergebnis teilen', copied: 'Ergebnis kopiert', invalid: 'Wähle eine gültige Truppe.',
        duplicate: 'Diese Truppe wurde bereits gewählt.', win: 'Richtig!', loss: 'Runde beendet', answer: 'Die Antwort war',
        noHint: 'Nach Versuch 3 wird ein Hinweis freigeschaltet.', hintReady: 'Ein Hinweis ist verfügbar.', dailyDone: 'Die tägliche Aufgabe ist abgeschlossen.',
        practiceNote: 'Übungsrunden ändern deine tägliche Serie nicht.', dailyNote: 'Bis 00:00 UTC gilt für alle dieselbe Truppe.',
        instructions: 'Vergleiche jede Eigenschaft. Pfeile zeigen, ob der versteckte Wert höher oder niedriger ist.',
        correct: 'Genau gleich', close: 'Naher Wert', higher: 'Versteckter Wert ist höher', lower: 'Versteckter Wert ist niedriger', wrong: 'Anders',
        type: 'Typ', move: 'Bewegung', targets: 'Ziele', favorite: 'Favorit', housing: 'Platz', th: 'RH', attack: 'Angriff', role: 'Rolle'
    },
    fr: {
        daily: 'Quotidien', practice: 'Entraînement', attempts: 'Essais', score: 'Score', streak: 'Série', best: 'Record',
        category: 'Troupes du village principal', input: 'Saisissez une troupe', submit: 'Valider', hint: 'Afficher un indice',
        newPractice: 'Nouvelle partie', share: 'Partager', copied: 'Résultat copié', invalid: 'Choisissez une troupe valide.',
        duplicate: 'Cette troupe a déjà été proposée.', win: 'Correct !', loss: 'Partie terminée', answer: 'La réponse était',
        noHint: 'Un indice se débloque après le 3e essai.', hintReady: 'Un indice est disponible.', dailyDone: 'Le défi du jour est terminé.',
        practiceNote: 'L’entraînement ne modifie pas votre série quotidienne.', dailyNote: 'La même troupe est proposée à tous jusqu’à 00:00 UTC.',
        instructions: 'Comparez chaque propriété. Les flèches indiquent si la valeur cachée est supérieure ou inférieure.',
        correct: 'Identique', close: 'Valeur proche', higher: 'Valeur cachée supérieure', lower: 'Valeur cachée inférieure', wrong: 'Différent',
        type: 'Type', move: 'Mouvement', targets: 'Cibles', favorite: 'Cible favorite', housing: 'Places', th: 'HDV', attack: 'Attaque', role: 'Rôle'
    },
    es: {
        daily: 'Diario', practice: 'Práctica', attempts: 'Intentos', score: 'Puntos', streak: 'Racha', best: 'Mejor',
        category: 'Tropas de la aldea principal', input: 'Escribe una tropa', submit: 'Enviar intento', hint: 'Mostrar pista',
        newPractice: 'Nueva práctica', share: 'Compartir', copied: 'Resultado copiado', invalid: 'Elige una tropa válida.',
        duplicate: 'Ya elegiste esa tropa.', win: '¡Correcto!', loss: 'Fin de la ronda', answer: 'La respuesta era',
        noHint: 'La primera pista se desbloquea tras el intento 3.', hintReady: 'Hay una pista disponible.', dailyDone: 'El reto diario está completado.',
        practiceNote: 'La práctica no afecta tu racha diaria.', dailyNote: 'Todos reciben la misma tropa hasta las 00:00 UTC.',
        instructions: 'Compara cada propiedad. Las flechas indican si el valor oculto es mayor o menor.',
        correct: 'Coincide', close: 'Valor cercano', higher: 'El valor oculto es mayor', lower: 'El valor oculto es menor', wrong: 'Diferente',
        type: 'Tipo', move: 'Movimiento', targets: 'Objetivos', favorite: 'Favorito', housing: 'Espacio', th: 'AY', attack: 'Ataque', role: 'Rol'
    }
};

const elements = {
    form: document.querySelector('[data-guess-form]'),
    input: document.querySelector('[data-guess-input]'),
    suggestions: document.querySelector('[data-guess-suggestions]'),
    message: document.querySelector('[data-game-message]'),
    rows: document.querySelector('[data-guess-rows]'),
    hintButton: document.querySelector('[data-hint-button]'),
    hints: document.querySelector('[data-hints]'),
    result: document.querySelector('[data-result]'),
    modeButtons: Array.from(document.querySelectorAll('[data-game-mode]')),
    attempts: document.querySelector('[data-attempts-value]'),
    score: document.querySelector('[data-score-value]'),
    streak: document.querySelector('[data-streak-value]'),
    best: document.querySelector('[data-best-value]'),
    resetPractice: document.querySelector('[data-new-practice]'),
    share: document.querySelector('[data-share-result]'),
    modeNote: document.querySelector('[data-mode-note]')
};

let state;
let answer;
let comparisonRows = [];

function language() {
    const lang = document.documentElement.lang?.slice(0, 2).toLowerCase();
    return TEXT[lang] ? lang : 'en';
}

function text(key) {
    return TEXT[language()][key] || TEXT.en[key] || key;
}

function translateStaticText() {
    document.querySelectorAll('[data-game-i18n]').forEach(node => {
        node.textContent = text(node.dataset.gameI18n);
    });
    if (elements.input) elements.input.placeholder = text('input');
}

function loadJson(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
        return fallback;
    }
}

function saveState() {
    if (state.mode !== 'daily') return;
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(state));
}

function createState(mode) {
    const dateKey = utcDateKey();
    if (mode === 'daily') {
        const saved = loadJson(DAILY_STORAGE_KEY, null);
        if (saved?.dateKey === dateKey && saved?.dataVersion === ENTITY_GUESSER_DATA_VERSION) return saved;
        return { mode, dateKey, dataVersion: ENTITY_GUESSER_DATA_VERSION, answerId: getDailyEntity(dateKey).id, guesses: [], hints: [], completed: false, won: false, score: 0 };
    }
    return { mode, dateKey, dataVersion: ENTITY_GUESSER_DATA_VERSION, answerId: getPracticeEntity().id, guesses: [], hints: [], completed: false, won: false, score: 0 };
}

function entityById(id) {
    return TROOPS.find(entity => entity.id === id);
}

function setMessage(message, type = 'neutral') {
    elements.message.textContent = message;
    elements.message.dataset.type = type;
}

function directionLabel(direction) {
    if (direction === 'higher') return `↑ ${text('higher')}`;
    if (direction === 'lower') return `↓ ${text('lower')}`;
    return '';
}

function cellLabel(cell, column) {
    const stateLabel = text(cell.state);
    const direction = directionLabel(cell.direction);
    return `${column.label}: ${cell.value}. ${stateLabel}${direction ? `. ${direction}` : ''}`;
}

function renderRows() {
    elements.rows.replaceChildren();
    comparisonRows = [];
    state.guesses.forEach(guessId => {
        const guess = entityById(guessId);
        if (!guess) return;
        const comparison = compareEntity(guess, answer);
        comparisonRows.push(comparison);
        const row = document.createElement('div');
        row.className = 'guess-grid guess-grid-row';

        const name = document.createElement('div');
        name.className = 'guess-cell guess-name';
        name.textContent = guess.name;
        name.setAttribute('aria-label', `Guess: ${guess.name}`);
        row.append(name);

        TROOP_CATEGORY.columns.forEach((column, index) => {
            const cell = comparison[index];
            const node = document.createElement('div');
            node.className = `guess-cell is-${cell.state}`;
            node.dataset.direction = cell.direction || '';
            const value = document.createElement('span');
            value.textContent = String(cell.value);
            node.append(value);
            if (cell.direction) {
                const arrow = document.createElement('b');
                arrow.textContent = cell.direction === 'higher' ? '↑' : '↓';
                arrow.setAttribute('aria-hidden', 'true');
                node.append(arrow);
            }
            node.title = cellLabel(cell, column);
            node.setAttribute('aria-label', cellLabel(cell, column));
            row.append(node);
        });
        elements.rows.append(row);
    });
}

function renderHeaderLabels() {
    const labelKeys = ['type', 'move', 'targets', 'favorite', 'housing', 'th', 'attack', 'role'];
    document.querySelectorAll('[data-column-label]').forEach((node, index) => {
        node.textContent = text(labelKeys[index]);
    });
}

function renderHints() {
    elements.hints.replaceChildren();
    state.hints.forEach(hint => {
        const item = document.createElement('li');
        item.textContent = hint;
        elements.hints.append(item);
    });
    const available = availableHintCount(state.guesses.length, state.hints.length);
    elements.hintButton.disabled = state.completed || available === 0;
    elements.hintButton.hidden = state.completed;
    if (!state.completed) setMessage(available > 0 ? text('hintReady') : text('noHint'));
}

function renderResult() {
    elements.result.hidden = !state.completed;
    elements.share.hidden = !state.completed || state.mode !== 'daily';
    if (!state.completed) return;
    const heading = elements.result.querySelector('[data-result-heading]');
    const body = elements.result.querySelector('[data-result-body]');
    heading.textContent = state.won ? text('win') : text('loss');
    body.textContent = `${text('answer')}: ${answer.name}.`;
    setMessage(state.mode === 'daily' ? text('dailyDone') : text('practiceNote'), state.won ? 'success' : 'warning');
}

function renderStats() {
    const stats = loadJson(STATS_STORAGE_KEY, { currentStreak: 0, bestStreak: 0 });
    elements.attempts.textContent = `${state.guesses.length}/${TROOP_CATEGORY.maxAttempts}`;
    elements.score.textContent = String(state.score || 0);
    elements.streak.textContent = String(stats.currentStreak || 0);
    elements.best.textContent = String(stats.bestStreak || 0);
    elements.modeNote.textContent = state.mode === 'daily' ? text('dailyNote') : text('practiceNote');
}

function renderMode() {
    elements.modeButtons.forEach(button => {
        const active = button.dataset.gameMode === state.mode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
    });
    elements.resetPractice.hidden = state.mode !== 'practice';
}

function render() {
    translateStaticText();
    renderHeaderLabels();
    renderMode();
    renderRows();
    renderHints();
    renderResult();
    renderStats();
    elements.input.disabled = state.completed;
    elements.form.querySelector('button[type="submit"]').disabled = state.completed;
}

function completeRound(won) {
    state.completed = true;
    state.won = won;
    state.score = calculateScore(state.guesses.length, state.hints.length, won);
    if (state.mode === 'daily') {
        const stats = updateStreak(loadJson(STATS_STORAGE_KEY, {}), state.dateKey, won);
        localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    }
    saveState();
}

function submitGuess(event) {
    event.preventDefault();
    if (state.completed) return;
    const guess = findEntity(elements.input.value);
    if (!guess) {
        setMessage(text('invalid'), 'error');
        return;
    }
    if (state.guesses.includes(guess.id)) {
        setMessage(text('duplicate'), 'error');
        return;
    }

    state.guesses.push(guess.id);
    elements.input.value = '';
    if (isWinningGuess(guess, answer)) completeRound(true);
    else if (state.guesses.length >= TROOP_CATEGORY.maxAttempts) completeRound(false);
    saveState();
    render();
}

function revealHint() {
    const available = availableHintCount(state.guesses.length, state.hints.length);
    if (available <= 0 || state.completed) return;
    state.hints.push(buildHint(answer, state.hints.length + 1));
    saveState();
    render();
}

function setMode(mode) {
    state = createState(mode);
    answer = entityById(state.answerId);
    if (!answer) {
        state = createState(mode);
        answer = entityById(state.answerId);
    }
    render();
    elements.input.focus();
}

function newPracticeRound() {
    state = createState('practice');
    answer = entityById(state.answerId);
    render();
    elements.input.focus();
}

function updateSuggestions() {
    elements.suggestions.replaceChildren();
    searchEntities(elements.input.value, TROOPS, 10).forEach(entity => {
        const option = document.createElement('option');
        option.value = entity.name;
        elements.suggestions.append(option);
    });
}

async function shareResult() {
    const rows = resultSquares(comparisonRows);
    const result = state.won ? `${state.guesses.length}/${TROOP_CATEGORY.maxAttempts}` : `X/${TROOP_CATEGORY.maxAttempts}`;
    const shareText = [
        `ClashPanel Daily Troop Guesser ${state.dateKey}`,
        `${result} · ${state.score} points`,
        ...rows,
        `Streak: ${loadJson(STATS_STORAGE_KEY, {}).currentStreak || 0}`,
        'https://clashpanel.com/minigames'
    ].join('\n');
    try {
        if (navigator.share) await navigator.share({ text: shareText });
        else await navigator.clipboard.writeText(shareText);
        setMessage(text('copied'), 'success');
    } catch (error) {
        if (error?.name !== 'AbortError') setMessage(shareText, 'neutral');
    }
}

function bindEvents() {
    elements.form.addEventListener('submit', submitGuess);
    elements.input.addEventListener('input', updateSuggestions);
    elements.hintButton.addEventListener('click', revealHint);
    elements.resetPractice.addEventListener('click', newPracticeRound);
    elements.share.addEventListener('click', shareResult);
    elements.modeButtons.forEach(button => button.addEventListener('click', () => setMode(button.dataset.gameMode)));
    window.addEventListener('clashtools:language-changed', render);
}

bindEvents();
setMode(new URLSearchParams(location.search).get('mode') === 'practice' ? 'practice' : 'daily');
