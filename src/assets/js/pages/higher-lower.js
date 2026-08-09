import { ENTITY_CATEGORIES } from '../minigames/entity-guesser-catalog.js?v=20260809-2';
import {
    DAILY_CATEGORY_IDS,
    DAILY_QUESTION_COUNT,
    HIGHER_LOWER_DAILY_KEY,
    HIGHER_LOWER_DATA_VERSION,
    HIGHER_LOWER_PRACTICE_FILTER_KEY,
    HIGHER_LOWER_STATS_KEY,
    advanceRun,
    applyChoice,
    buildDailyQuestions,
    buildPracticeQuestion,
    createDailyRun,
    createPracticeRun,
    resultSymbols,
    updateLifetimeStats,
    utcDateKey
} from '../minigames/higher-lower-engine.js?v=20260809-2';

const COPY = {
    en: {
        daily: 'Daily', practice: 'Practice', question: 'Question', score: 'Score', correct: 'Correct', combo: 'Combo',
        higher: 'Higher', lower: 'Lower', next: 'Next comparison', newPractice: 'Reset practice', share: 'Share result',
        allCategories: 'All four categories', filter: 'Practice category', dailyNote: 'Nine comparisons across four broad categories. Resets at 00:00 UTC.',
        practiceNote: 'Unlimited comparisons. Practice does not affect the Daily result.', choose: 'Does the right side have a higher or lower value?',
        correctAnswer: 'Correct', wrongAnswer: 'Not quite', revealed: 'Revealed value', completed: 'Daily complete',
        accuracy: 'Accuracy', bestCombo: 'Best combo', copied: 'Result copied', points: 'points', bonus: 'combo bonus',
        housingSpace: 'housing space', unlockStage: 'unlock stage', equipmentCount: 'equipment count',
        petHouseRequirement: 'Pet House requirement', maximumLevel: 'maximum level', rangeClass: 'range class',
        buildingFootprint: 'building footprint', effectArea: 'effect area', housingSpaces: 'housing spaces',
        progressionStage: 'progression stage', equipmentItems: 'equipment items', petHouseLevel: 'Pet House level', levels: 'levels',
        rangeClassUnit: 'range class', tiles: 'tiles', areaClass: 'area class',
        defenses: 'Defenses', otherBuildings: 'Other Buildings', troopsHeroes: 'Troops & Heroes', spellsEquipment: 'Spells & Equipment'
    },
    nl: {
        daily: 'Dagelijks', practice: 'Oefenen', question: 'Vraag', score: 'Score', correct: 'Juist', combo: 'Combo',
        higher: 'Hoger', lower: 'Lager', next: 'Volgende vergelijking', newPractice: 'Oefening resetten', share: 'Deel resultaat',
        allCategories: 'Alle vier categorieën', filter: 'Oefencategorie', dailyNote: 'Negen vergelijkingen over vier brede categorieën. Reset om 00:00 UTC.',
        practiceNote: 'Onbeperkte vergelijkingen. Oefenen beïnvloedt het dagelijkse resultaat niet.', choose: 'Heeft de rechterkant een hogere of lagere waarde?',
        correctAnswer: 'Juist', wrongAnswer: 'Niet juist', revealed: 'Onthulde waarde', completed: 'Daily voltooid',
        accuracy: 'Nauwkeurigheid', bestCombo: 'Beste combo', copied: 'Resultaat gekopieerd', points: 'punten', bonus: 'combobonus',
        housingSpace: 'housing space', unlockStage: 'ontgrendelfase', equipmentCount: 'aantal equipment-items',
        petHouseRequirement: 'vereist Pet House-level', maximumLevel: 'maximumlevel', rangeClass: 'bereikklasse',
        buildingFootprint: 'gebouwoppervlakte', effectArea: 'effectgebied', housingSpaces: 'housing spaces',
        progressionStage: 'progressiefase', equipmentItems: 'equipment-items', petHouseLevel: 'Pet House-level', levels: 'levels',
        rangeClassUnit: 'bereikklasse', tiles: 'tegels', areaClass: 'gebiedsklasse',
        defenses: 'Verdedigingen', otherBuildings: 'Andere gebouwen', troopsHeroes: 'Troepen & helden', spellsEquipment: 'Spreuken & uitrusting'
    },
    de: {
        daily: 'Täglich', practice: 'Üben', question: 'Frage', score: 'Punkte', correct: 'Richtig', combo: 'Combo',
        higher: 'Höher', lower: 'Niedriger', next: 'Nächster Vergleich', newPractice: 'Übung zurücksetzen', share: 'Ergebnis teilen',
        allCategories: 'Alle vier Kategorien', filter: 'Übungskategorie', dailyNote: 'Neun Vergleiche aus vier breiten Kategorien. Reset um 00:00 UTC.',
        practiceNote: 'Unbegrenzte Vergleiche. Übung beeinflusst das Daily nicht.', choose: 'Hat die rechte Seite einen höheren oder niedrigeren Wert?',
        correctAnswer: 'Richtig', wrongAnswer: 'Leider falsch', revealed: 'Aufgedeckter Wert', completed: 'Daily abgeschlossen',
        accuracy: 'Genauigkeit', bestCombo: 'Beste Combo', copied: 'Ergebnis kopiert', points: 'Punkte', bonus: 'Combobonus',
        housingSpace: 'Wohnraum', unlockStage: 'Freischaltphase', equipmentCount: 'Ausrüstungsanzahl',
        petHouseRequirement: 'Tierhaus-Anforderung', maximumLevel: 'Maximalstufe', rangeClass: 'Reichweitenklasse',
        buildingFootprint: 'Gebäudegröße', effectArea: 'Effektbereich', housingSpaces: 'Wohnraum', progressionStage: 'Fortschrittsphase',
        equipmentItems: 'Ausrüstungen', petHouseLevel: 'Tierhaus-Stufe', levels: 'Stufen', rangeClassUnit: 'Reichweitenklasse', tiles: 'Felder', areaClass: 'Bereichsklasse',
        defenses: 'Verteidigungen', otherBuildings: 'Andere Gebäude', troopsHeroes: 'Truppen & Helden', spellsEquipment: 'Zauber & Ausrüstung'
    },
    fr: {
        daily: 'Quotidien', practice: 'Entraînement', question: 'Question', score: 'Score', correct: 'Correct', combo: 'Combo',
        higher: 'Plus élevé', lower: 'Plus bas', next: 'Comparaison suivante', newPractice: 'Réinitialiser', share: 'Partager',
        allCategories: 'Les quatre catégories', filter: 'Catégorie d’entraînement', dailyNote: 'Neuf comparaisons dans quatre grandes catégories. Réinitialisation à 00:00 UTC.',
        practiceNote: 'Comparaisons illimitées. L’entraînement n’affecte pas le défi quotidien.', choose: 'La valeur de droite est-elle plus élevée ou plus basse ?',
        correctAnswer: 'Correct', wrongAnswer: 'Incorrect', revealed: 'Valeur révélée', completed: 'Défi terminé', accuracy: 'Précision',
        bestCombo: 'Meilleur combo', copied: 'Résultat copié', points: 'points', bonus: 'bonus de combo', housingSpace: 'capacité de logement',
        unlockStage: 'phase de déblocage', equipmentCount: 'nombre d’équipements',
        petHouseRequirement: 'niveau de la Maison des familiers', maximumLevel: 'niveau maximum', rangeClass: 'classe de portée',
        buildingFootprint: 'surface du bâtiment', effectArea: 'zone d’effet', housingSpaces: 'places',
        progressionStage: 'phase de progression', equipmentItems: 'équipements', petHouseLevel: 'niveau de Maison des familiers', levels: 'niveaux',
        rangeClassUnit: 'classe de portée', tiles: 'cases', areaClass: 'classe de zone', defenses: 'Défenses',
        otherBuildings: 'Autres bâtiments', troopsHeroes: 'Troupes et héros', spellsEquipment: 'Sorts et équipements'
    },
    es: {
        daily: 'Diario', practice: 'Práctica', question: 'Pregunta', score: 'Puntos', correct: 'Correctas', combo: 'Combo',
        higher: 'Mayor', lower: 'Menor', next: 'Siguiente comparación', newPractice: 'Reiniciar práctica', share: 'Compartir',
        allCategories: 'Las cuatro categorías', filter: 'Categoría de práctica', dailyNote: 'Nueve comparaciones entre cuatro categorías amplias. Reinicio a las 00:00 UTC.',
        practiceNote: 'Comparaciones ilimitadas. La práctica no afecta al reto diario.', choose: '¿El valor de la derecha es mayor o menor?',
        correctAnswer: 'Correcto', wrongAnswer: 'Incorrecto', revealed: 'Valor revelado', completed: 'Reto diario completado', accuracy: 'Precisión',
        bestCombo: 'Mejor combo', copied: 'Resultado copiado', points: 'puntos', bonus: 'bonus de combo', housingSpace: 'espacio de vivienda',
        unlockStage: 'fase de desbloqueo', equipmentCount: 'cantidad de equipamiento',
        petHouseRequirement: 'nivel de Casa de mascotas', maximumLevel: 'nivel máximo', rangeClass: 'clase de alcance',
        buildingFootprint: 'superficie del edificio', effectArea: 'área de efecto', housingSpaces: 'espacios',
        progressionStage: 'fase de progreso', equipmentItems: 'equipamientos', petHouseLevel: 'nivel de Casa de mascotas', levels: 'niveles',
        rangeClassUnit: 'clase de alcance', tiles: 'casillas', areaClass: 'clase de área', defenses: 'Defensas',
        otherBuildings: 'Otros edificios', troopsHeroes: 'Tropas y héroes', spellsEquipment: 'Hechizos y equipamiento'
    }
};

const root = document.querySelector('[data-higher-lower-game]');
if (!root) throw new Error('Higher or Lower root is missing.');

const elements = {
    modes: [...root.querySelectorAll('[data-hl-mode]')],
    modeNote: root.querySelector('[data-hl-mode-note]'),
    filterWrap: root.querySelector('[data-hl-filter-wrap]'),
    filter: root.querySelector('[data-hl-filter]'),
    question: root.querySelector('[data-hl-question]'),
    score: root.querySelector('[data-hl-score]'),
    correct: root.querySelector('[data-hl-correct]'),
    combo: root.querySelector('[data-hl-combo]'),
    metric: root.querySelector('[data-hl-metric]'),
    prompt: root.querySelector('[data-hl-prompt]'),
    leftName: root.querySelector('[data-hl-left-name]'),
    leftValue: root.querySelector('[data-hl-left-value]'),
    rightName: root.querySelector('[data-hl-right-name]'),
    rightValue: root.querySelector('[data-hl-right-value]'),
    choices: [...root.querySelectorAll('[data-hl-choice]')],
    feedback: root.querySelector('[data-hl-feedback]'),
    next: root.querySelector('[data-hl-next]'),
    reset: root.querySelector('[data-hl-reset]'),
    result: root.querySelector('[data-hl-result]'),
    resultTitle: root.querySelector('[data-hl-result-title]'),
    resultBody: root.querySelector('[data-hl-result-body]'),
    share: root.querySelector('[data-hl-share]')
};

const language = () => {
    const code = document.documentElement.lang?.slice(0, 2).toLowerCase();
    return COPY[code] ? code : 'en';
};
const text = key => COPY[language()]?.[key] || COPY.en[key] || key;
const load = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
};
const saveDaily = () => {
    if (run.mode === 'daily') localStorage.setItem(HIGHER_LOWER_DAILY_KEY, JSON.stringify(run));
};

let run;
let dailyQuestions = [];
let practiceQuestion = null;

function validPracticeFilter(value) {
    return value === 'all' || DAILY_CATEGORY_IDS.includes(value) ? value : 'all';
}

function loadDailyRun() {
    const dateKey = utcDateKey();
    dailyQuestions = buildDailyQuestions(dateKey);
    const saved = load(HIGHER_LOWER_DAILY_KEY, null);
    if (saved?.dateKey === dateKey && saved?.dataVersion === HIGHER_LOWER_DATA_VERSION) {
        run = saved;
    } else {
        run = createDailyRun(dateKey);
        saveDaily();
    }
}

function loadPracticeRun(filter = localStorage.getItem(HIGHER_LOWER_PRACTICE_FILTER_KEY) || 'all') {
    const categoryId = validPracticeFilter(filter);
    localStorage.setItem(HIGHER_LOWER_PRACTICE_FILTER_KEY, categoryId);
    run = createPracticeRun(categoryId);
    practiceQuestion = buildPracticeQuestion(categoryId);
}

function currentQuestion() {
    if (run.mode === 'daily') return dailyQuestions[Math.min(run.currentIndex, DAILY_QUESTION_COUNT - 1)];
    return practiceQuestion;
}

function populateFilter() {
    elements.filter.replaceChildren();
    const all = document.createElement('option');
    all.value = 'all';
    all.textContent = text('allCategories');
    elements.filter.append(all);
    ENTITY_CATEGORIES.filter(category => DAILY_CATEGORY_IDS.includes(category.id)).forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = text(category.id);
        elements.filter.append(option);
    });
    elements.filter.value = run.mode === 'practice' ? run.categoryId : 'all';
}

function metricLabel(question) {
    return `${text(question.labelKey)} · ${text(question.unitKey)}`;
}

function renderTranslation() {
    root.querySelectorAll('[data-hl-i18n]').forEach(node => {
        node.textContent = text(node.dataset.hlI18n);
    });
    populateFilter();
}

function renderFeedback(question) {
    if (!run.revealed) {
        elements.feedback.textContent = '';
        elements.feedback.dataset.state = 'neutral';
        return;
    }
    const answerWord = text(question.correctChoice);
    const resultWord = run.lastCorrect ? text('correctAnswer') : text('wrongAnswer');
    const bonus = run.lastBonus ? ` · +${run.lastBonus} ${text('bonus')}` : '';
    elements.feedback.textContent = `${resultWord}. ${question.rightName}: ${question.rightDisplayValue} — ${answerWord}.${bonus}`;
    elements.feedback.dataset.state = run.lastCorrect ? 'correct' : 'wrong';
}

function renderResult() {
    elements.result.hidden = !run.completed;
    elements.share.hidden = !run.completed || run.mode !== 'daily';
    if (!run.completed) return;
    const accuracy = Math.round((run.correctCount / DAILY_QUESTION_COUNT) * 100);
    elements.resultTitle.textContent = text('completed');
    elements.resultBody.textContent = `${run.correctCount}/${DAILY_QUESTION_COUNT} · ${accuracy}% ${text('accuracy').toLowerCase()} · ${run.score} ${text('points')} · ${text('bestCombo')}: ${run.bestCombo}`;
}

function render() {
    const question = currentQuestion();
    renderTranslation();
    elements.modes.forEach(button => {
        const active = button.dataset.hlMode === run.mode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
    });
    elements.filterWrap.hidden = run.mode !== 'practice';
    elements.reset.hidden = run.mode !== 'practice';
    elements.modeNote.textContent = run.mode === 'daily' ? text('dailyNote') : text('practiceNote');
    elements.question.textContent = run.mode === 'daily'
        ? `${text('question')} ${Math.min(run.currentIndex + 1, DAILY_QUESTION_COUNT)}/${DAILY_QUESTION_COUNT}`
        : `${text('question')} ${run.currentIndex + 1}`;
    elements.score.textContent = String(run.score);
    elements.correct.textContent = String(run.correctCount);
    elements.combo.textContent = String(run.combo);
    elements.metric.textContent = metricLabel(question);
    elements.prompt.textContent = text('choose');
    elements.leftName.textContent = question.leftName;
    elements.leftValue.textContent = question.leftDisplayValue;
    elements.rightName.textContent = question.rightName;
    elements.rightValue.textContent = run.revealed ? question.rightDisplayValue : '?';
    elements.rightValue.classList.toggle('is-hidden-value', !run.revealed);
    elements.choices.forEach(button => {
        button.disabled = run.revealed || run.completed;
        button.classList.toggle('is-correct-choice', run.revealed && button.dataset.hlChoice === question.correctChoice);
        button.classList.toggle('is-wrong-choice', run.revealed && button.dataset.hlChoice !== question.correctChoice && button.dataset.selected === 'true');
    });
    elements.next.hidden = !run.revealed || run.completed;
    renderFeedback(question);
    renderResult();
}

function choose(choice, button) {
    if (run.revealed || run.completed) return;
    elements.choices.forEach(item => { item.dataset.selected = String(item === button); });
    const question = currentQuestion();
    run = applyChoice(run, question, choice);
    if (run.mode === 'daily') {
        saveDaily();
        if (run.completed) {
            const stats = updateLifetimeStats(load(HIGHER_LOWER_STATS_KEY, {}), run);
            localStorage.setItem(HIGHER_LOWER_STATS_KEY, JSON.stringify(stats));
        }
    }
    render();
}

function nextQuestion() {
    if (!run.revealed || run.completed) return;
    run = advanceRun(run);
    elements.choices.forEach(item => { delete item.dataset.selected; });
    if (run.mode === 'practice') {
        practiceQuestion = buildPracticeQuestion(run.categoryId, practiceQuestion?.id);
    } else {
        saveDaily();
    }
    render();
}

function setMode(mode) {
    elements.choices.forEach(item => { delete item.dataset.selected; });
    if (mode === 'practice') loadPracticeRun();
    else loadDailyRun();
    render();
}

function resetPractice() {
    loadPracticeRun(elements.filter.value);
    elements.choices.forEach(item => { delete item.dataset.selected; });
    render();
}

async function shareResult() {
    const value = [
        'ClashPanel Daily Higher or Lower',
        `${run.dateKey} · ${run.correctCount}/${DAILY_QUESTION_COUNT} · ${run.score} ${text('points')}`,
        resultSymbols(run.answers),
        `${text('bestCombo')}: ${run.bestCombo}`,
        'https://clashpanel.com/minigames?game=higher-lower'
    ].join('\n');
    try {
        if (navigator.share) await navigator.share({ text: value });
        else await navigator.clipboard.writeText(value);
        elements.feedback.textContent = text('copied');
        elements.feedback.dataset.state = 'correct';
    } catch (error) {
        if (error?.name !== 'AbortError') elements.feedback.textContent = value;
    }
}

elements.choices.forEach(button => button.addEventListener('click', () => choose(button.dataset.hlChoice, button)));
elements.next.addEventListener('click', nextQuestion);
elements.reset.addEventListener('click', resetPractice);
elements.share.addEventListener('click', shareResult);
elements.filter.addEventListener('change', () => loadPracticeRun(elements.filter.value) || render());
elements.modes.forEach(button => button.addEventListener('click', () => setMode(button.dataset.hlMode)));
window.addEventListener('clashtools:language-changed', render);

loadDailyRun();
render();
