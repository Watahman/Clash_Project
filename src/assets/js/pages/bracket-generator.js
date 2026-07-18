import { initI18n, t } from '../i18n/i18n.js';
import { profileHTML } from '../profile/profile_popup.js';
import { syncAuthSession } from '../auth/auth-client.js';
import {
    BRACKET_MAX_PARTICIPANTS,
    bracketChampion,
    createBracket,
    importBracket,
    setMatchWinner
} from '../bracket/bracket-engine.js';

const STORAGE_KEY = 'clashtools.bracket.current';
const refs = {};
let bracket = null;

function initRefs() {
    refs.name = document.querySelector('#bracket-name');
    refs.participants = document.querySelector('#bracket-participants');
    refs.seed = document.querySelector('#bracket-generate-seeded');
    refs.shuffle = document.querySelector('#bracket-generate-shuffled');
    refs.board = document.querySelector('#bracket-board');
    refs.status = document.querySelector('#bracket-status');
    refs.exportButton = document.querySelector('#bracket-export');
    refs.importButton = document.querySelector('#bracket-import');
    refs.importFile = document.querySelector('#bracket-import-file');
    refs.reset = document.querySelector('#bracket-reset');
    refs.participantCount = document.querySelector('#bracket-participant-count');
    refs.resultTitle = document.querySelector('#bracket-result-title');
    refs.resultCount = document.querySelector('#bracket-result-count');
    refs.resultChampion = document.querySelector('#bracket-result-champion');
}

function participants() {
    return refs.participants.value.split(/\r?\n|,/).map(value => value.trim()).filter(Boolean);
}

function setStatus(message = '', state = '') {
    refs.status.textContent = message;
    refs.status.dataset.state = state;
}

function updateSetupSummary() {
    const count = participants().length;
    if (refs.participantCount) refs.participantCount.textContent = String(count);
    if (!bracket && refs.resultCount) refs.resultCount.textContent = String(count);
    if (!bracket && refs.resultTitle) refs.resultTitle.textContent = refs.name.value.trim() || t('bracket.title');
}

function generate(shuffle) {
    const entries = participants();
    if (entries.length < 2) {
        setStatus(t('bracket.minParticipants'), 'error');
        return;
    }
    if (entries.length > BRACKET_MAX_PARTICIPANTS) {
        setStatus(t('bracket.maxParticipants', { count: BRACKET_MAX_PARTICIPANTS }), 'error');
        return;
    }
    try {
        bracket = createBracket(entries, { shuffle, name: refs.name.value });
        save();
        render();
        setStatus(t('bracket.generated'), 'success');
    } catch (error) {
        setStatus(error.message, 'error');
    }
}

function save() {
    if (bracket) localStorage.setItem(STORAGE_KEY, JSON.stringify(bracket));
}

function restore() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        bracket = importBracket(stored);
        refs.name.value = bracket.name;
        refs.participants.value = bracket.participants.join('\n');
        render();
    } catch {
        localStorage.removeItem(STORAGE_KEY);
    }
}

function render() {
    refs.board.replaceChildren();
    if (!bracket) {
        if (refs.resultChampion) refs.resultChampion.textContent = '—';
        updateSetupSummary();
        refs.board.appendChild(message(t('bracket.empty')));
        return;
    }
    if (refs.resultTitle) refs.resultTitle.textContent = bracket.name;
    if (refs.resultCount) refs.resultCount.textContent = String(bracket.participants.length);
    bracket.rounds.forEach((round, roundIndex) => {
        const column = document.createElement('section');
        column.className = 'bracket-round';
        const heading = document.createElement('h2');
        heading.textContent = roundIndex === bracket.rounds.length - 1
            ? t('bracket.final')
            : t('bracket.round', { round: roundIndex + 1 });
        column.appendChild(heading);
        round.forEach(match => column.appendChild(renderMatch(match)));
        refs.board.appendChild(column);
    });
    const champion = bracketChampion(bracket);
    if (refs.resultChampion) refs.resultChampion.textContent = champion || '—';
    if (champion) setStatus(t('bracket.champion', { name: champion }), 'success');
}

function renderMatch(match) {
    const card = document.createElement('article');
    card.className = 'bracket-match';
    match.players.forEach(player => {
        const button = document.createElement('button');
        button.type = 'button';
        button.disabled = !player;
        button.textContent = player || t('bracket.bye');
        button.classList.toggle('winner', player && match.winner === player);
        button.setAttribute('aria-pressed', String(Boolean(player && match.winner === player)));
        button.addEventListener('click', () => {
            setMatchWinner(bracket, match.id, player);
            save();
            render();
        });
        card.appendChild(button);
    });
    return card;
}

function message(text) {
    const paragraph = document.createElement('p');
    paragraph.className = 'bracket-empty';
    paragraph.textContent = text;
    return paragraph;
}

function exportJson() {
    if (!bracket) return setStatus(t('bracket.empty'), 'error');
    const blob = new Blob([JSON.stringify(bracket, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${bracket.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'bracket'}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
}

async function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        if (file.size > 1024 * 1024) throw new Error('Bracketbestand is te groot.');
        bracket = importBracket(await file.text());
        refs.name.value = bracket.name;
        refs.participants.value = bracket.participants.join('\n');
        save();
        render();
        setStatus(t('bracket.imported'), 'success');
    } catch {
        setStatus(t('bracket.importError'), 'error');
    } finally {
        refs.importFile.value = '';
    }
}

async function init() {
    initI18n();
    await syncAuthSession().catch(() => null);
    initRefs();
    refs.seed.addEventListener('click', () => generate(false));
    refs.shuffle.addEventListener('click', () => generate(true));
    refs.exportButton.addEventListener('click', exportJson);
    refs.importButton.addEventListener('click', () => refs.importFile.click());
    refs.importFile.addEventListener('change', importJson);
    refs.reset.addEventListener('click', () => {
        bracket = null;
        localStorage.removeItem(STORAGE_KEY);
        render();
        setStatus('');
    });
    refs.name.addEventListener('input', updateSetupSummary);
    refs.participants.addEventListener('input', updateSetupSummary);
    window.addEventListener('clashtools:language-changed', render);
    restore();
    render();
    updateSetupSummary();
    profileHTML();
}

void init();
