import { initI18n, t } from '../i18n/i18n.js';
import { profileHTML } from '../profile/profile_popup.js';
import { syncAuthSession } from '../auth/auth-client.js';
import {
    BRACKET_MAX_PARTICIPANTS,
    BRACKET_MIN_PARTICIPANTS,
    bracketChampion,
    createBracket,
    importBracket,
    setMatchWinner
} from '../bracket/bracket-engine.js';
import { bracketText } from '../bracket/bracket-copy.js';
import { createBracketFixture } from '../bracket/bracket-fixtures.js';
import { bracketIcon } from '../bracket/bracket-icons.js';
import {
    drawBracketConnectors,
    renderBracketBoard
} from '../bracket/bracket-renderer.js';
import {
    getRedesignFixture,
    isRedesignFixtureRequested
} from '../fixtures/redesign-fixture-mode.js';

const STORAGE_KEY = 'clashtools.bracket.current';
const refs = {};
let bracket = null;
let activeRound = 0;
let setupCollapsed = false;
let fixtureMode = false;
let changedMatchIds = new Set();

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
    refs.participantCountText = document.querySelector('#bracket-participant-count-text');
    refs.resultTitle = document.querySelector('#bracket-result-title');
    refs.resultCount = document.querySelector('#bracket-result-count');
    refs.resultChampion = document.querySelector('#bracket-result-champion');
    refs.resultChampionHelp = document.querySelector('#bracket-result-champion-help');
    refs.roundNavigation = document.querySelector('#bracket-round-navigation');
    refs.roundPrev = document.querySelector('#bracket-round-prev');
    refs.roundNext = document.querySelector('#bracket-round-next');
    refs.setupToggle = document.querySelector('#bracket-setup-toggle');
    refs.setupToggleLabel = document.querySelector('#bracket-setup-toggle-label');
    refs.setupContent = document.querySelector('#bracket-setup-content');
    refs.announcement = document.querySelector('#bracket-board-announcement');
    refs.resetDialog = document.querySelector('#bracket-reset-dialog');
    refs.resetConfirm = document.querySelector('#bracket-reset-confirm');
    refs.resetCancel = document.querySelector('#bracket-reset-cancel');
}

function participantEntries() {
    return refs.participants.value
        .split(/\r?\n|,/)
        .map(value => value.trim())
        .filter(Boolean);
}

function setStatus(message = '', state = '') {
    refs.status.textContent = message;
    refs.status.dataset.state = state;
}

function renderModuleCopy() {
    document.querySelectorAll('[data-bracket-copy]').forEach(element => {
        element.textContent = bracketText(element.dataset.bracketCopy);
    });
    if (refs.setupToggle) {
        refs.setupToggleLabel.textContent = bracketText(setupCollapsed ? 'showSetup' : 'hideSetup');
        refs.setupToggle.setAttribute('aria-label', refs.setupToggleLabel.textContent);
    }
    if (refs.resetDialog) {
        refs.resetDialog.querySelector('h2').textContent = bracketText('resetConfirmTitle');
        refs.resetDialog.querySelector('[data-reset-copy]').textContent = bracketText('resetConfirmText');
        refs.resetCancel.textContent = bracketText('cancel');
        refs.resetConfirm.textContent = bracketText('clear');
    }
}

function mountActionIcons() {
    [
        [refs.seed, 'seed'],
        [refs.shuffle, 'shuffle'],
        [refs.importButton, 'upload'],
        [refs.exportButton, 'download'],
        [refs.reset, 'reset'],
        [refs.roundPrev, 'chevronLeft'],
        [refs.roundNext, 'chevronRight'],
        [refs.setupToggle, 'bracket']
    ].forEach(([button, name]) => button?.prepend(bracketIcon(name)));
}

function updateSetupSummary() {
    const count = participantEntries().length;
    refs.participantCount.textContent = String(count);
    refs.participantCountText.textContent = bracketText('count', { count });
    if (!bracket) {
        refs.resultCount.textContent = String(count);
        refs.resultTitle.textContent = refs.name.value.trim() || t('bracket.title');
    }
}

function setSetupCollapsed(collapsed) {
    setupCollapsed = Boolean(collapsed && bracket);
    refs.setupContent.hidden = setupCollapsed;
    refs.setupToggle.setAttribute('aria-expanded', String(!setupCollapsed));
    refs.setupToggleLabel.textContent = bracketText(setupCollapsed ? 'showSetup' : 'hideSetup');
    refs.setupToggle.setAttribute('aria-label', refs.setupToggleLabel.textContent);
}

function applyBracketToForm() {
    if (!bracket) return;
    refs.name.value = bracket.name;
    refs.participants.value = bracket.participants.join('\n');
}

function saveBracket() {
    if (!bracket || fixtureMode) return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bracket));
    } catch {
        setStatus(bracketText('localSave'), 'info');
    }
}

function removeSavedBracket() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Private browsing can make storage removal unavailable.
    }
}

function restoreBracket() {
    if (fixtureMode) return;
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        bracket = importBracket(stored);
        applyBracketToForm();
        setSetupCollapsed(true);
        setStatus(bracketText('restored'), 'success');
    } catch {
        removeSavedBracket();
        setStatus(bracketText('restoreError'), 'error');
    }
}

function errorCopy(error) {
    const messages = {
        'duplicate-participants': 'duplicate',
        'too-few-participants': 'minimum',
        'too-many-participants': 'maximum'
    };
    return bracketText(messages[error?.code] || 'importError', {
        min: BRACKET_MIN_PARTICIPANTS,
        max: BRACKET_MAX_PARTICIPANTS
    });
}

function generate(shuffle) {
    try {
        bracket = createBracket(participantEntries(), {
            shuffle,
            name: refs.name.value
        });
        activeRound = 0;
        changedMatchIds = new Set();
        saveBracket();
        setSetupCollapsed(true);
        render();
        setStatus(bracketText('generated'), 'success');
    } catch (error) {
        setStatus(errorCopy(error), 'error');
    }
}

function snapshotMatches() {
    return new Map(bracket.rounds.flat().map(match => [
        match.id,
        JSON.stringify({ players: match.players, winner: match.winner })
    ]));
}

function changedMatches(before) {
    return new Set([...snapshotMatches().entries()]
        .filter(([id, value]) => before.get(id) !== value)
        .map(([id]) => id));
}

function announce(message) {
    refs.announcement.textContent = '';
    window.setTimeout(() => {
        refs.announcement.textContent = message;
    }, 0);
}

function chooseWinner(match, player) {
    if (!bracket) return;
    const before = snapshotMatches();
    try {
        setMatchWinner(bracket, match.id, player);
        changedMatchIds = changedMatches(before);
        saveBracket();
        render();
        const champion = bracketChampion(bracket);
        const message = champion
            ? bracketText('championComplete', { name: champion })
            : bracketText('selectedWinner', { name: player });
        setStatus(message, 'success');
        announce(message);
    } catch {
        setStatus(bracketText('changeWinner'), 'error');
    }
}

function changeRound(roundIndex, focus = false) {
    if (!bracket) return;
    activeRound = Math.max(0, Math.min(roundIndex, bracket.rounds.length - 1));
    render();
    if (focus) refs.roundNavigation.querySelector('[aria-selected="true"]')?.focus();
}

function updateRoundControls() {
    const hasRounds = Boolean(bracket?.rounds?.length);
    refs.roundNavigation.hidden = !hasRounds;
    refs.roundPrev.disabled = !hasRounds || activeRound === 0;
    refs.roundNext.disabled = !hasRounds || activeRound === bracket.rounds.length - 1;
    refs.roundPrev.setAttribute('aria-label', bracketText('previousRound'));
    refs.roundNext.setAttribute('aria-label', bracketText('nextRound'));
}

function render() {
    updateSetupSummary();
    refs.resultTitle.textContent = bracket?.name || refs.name.value.trim() || t('bracket.title');
    refs.resultCount.textContent = String(bracket?.participants.length || participantEntries().length);
    const champion = bracketChampion(bracket);
    refs.resultChampion.textContent = champion || '—';
    refs.resultChampionHelp.textContent = champion
        ? bracketText('championComplete', { name: champion })
        : bracketText('championHelp');
    renderBracketBoard({
        board: refs.board,
        navigation: refs.roundNavigation.querySelector('[role="tablist"]'),
        bracket,
        activeRound,
        changedMatchIds,
        onWinner: chooseWinner,
        onRoundChange: changeRound
    });
    updateRoundControls();
    setSetupCollapsed(setupCollapsed);
}

function openResetDialog() {
    if (!refs.resetDialog) return clearBracket();
    if (typeof refs.resetDialog.showModal === 'function') refs.resetDialog.showModal();
    else refs.resetDialog.setAttribute('open', '');
    refs.resetCancel.focus();
}

function clearBracket() {
    bracket = null;
    activeRound = 0;
    setupCollapsed = false;
    changedMatchIds = new Set();
    refs.name.value = 'Clash tournament';
    refs.participants.value = '';
    if (!fixtureMode) removeSavedBracket();
    render();
    setStatus('', '');
    announce(bracketText('empty'));
}

function closeResetDialog() {
    if (typeof refs.resetDialog.close === 'function' && refs.resetDialog.open) refs.resetDialog.close();
    else refs.resetDialog.removeAttribute('open');
    refs.reset.focus();
}

function exportJson() {
    if (!bracket) {
        setStatus(bracketText('empty'), 'error');
        return;
    }
    const blob = new Blob([JSON.stringify(bracket, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${bracket.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'bracket'}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
    setStatus(t('bracket.export'), 'success');
}

async function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        if (file.size > 1024 * 1024) throw new Error('too-large');
        const imported = importBracket(await file.text());
        bracket = imported;
        fixtureMode = false;
        activeRound = 0;
        changedMatchIds = new Set();
        applyBracketToForm();
        setSetupCollapsed(true);
        saveBracket();
        render();
        setStatus(bracketText('imported'), 'success');
    } catch (error) {
        setStatus(error?.message === 'too-large' ? bracketText('importTooLarge') : bracketText('importError'), 'error');
    } finally {
        refs.importFile.value = '';
    }
}

async function loadFixture() {
    if (!isRedesignFixtureRequested()) return false;
    fixtureMode = true;
    try {
        const scenario = await getRedesignFixture();
        bracket = createBracketFixture(scenario.id);
        if (bracket) {
            applyBracketToForm();
            setSetupCollapsed(true);
            setStatus(bracketText('fixtureLoaded'), 'info');
        }
    } catch {
        setStatus(bracketText('importError'), 'error');
    }
    return true;
}

function updateGuidanceCopy() {
    const intro = document.querySelector('#workspace-help-drawer .workspace-help-intro');
    if (intro) intro.textContent = bracketText('setupHelp');
}

function bindEvents() {
    refs.seed.addEventListener('click', () => generate(false));
    refs.shuffle.addEventListener('click', () => generate(true));
    refs.exportButton.addEventListener('click', exportJson);
    refs.importButton.addEventListener('click', () => refs.importFile.click());
    refs.importFile.addEventListener('change', importJson);
    refs.reset.addEventListener('click', openResetDialog);
    refs.resetConfirm.addEventListener('click', () => {
        closeResetDialog();
        clearBracket();
    });
    refs.resetCancel.addEventListener('click', closeResetDialog);
    refs.resetDialog.addEventListener('cancel', event => {
        event.preventDefault();
        closeResetDialog();
    });
    refs.setupToggle.addEventListener('click', () => setSetupCollapsed(!setupCollapsed));
    refs.roundPrev.addEventListener('click', () => changeRound(activeRound - 1));
    refs.roundNext.addEventListener('click', () => changeRound(activeRound + 1));
    refs.name.addEventListener('input', updateSetupSummary);
    refs.participants.addEventListener('input', updateSetupSummary);
    refs.board.addEventListener('scroll', () => drawBracketConnectors(refs.board, bracket), { passive: true });
    window.addEventListener('resize', () => drawBracketConnectors(refs.board, bracket), { passive: true });
    window.addEventListener('clashtools:language-changed', () => {
        renderModuleCopy();
        render();
        updateGuidanceCopy();
    });
}

async function init() {
    initI18n();
    initRefs();
    mountActionIcons();
    bindEvents();
    renderModuleCopy();
    const loadedFixture = await loadFixture();
    if (!loadedFixture) {
        await syncAuthSession().catch(() => null);
        restoreBracket();
    }
    render();
    profileHTML();
    window.setTimeout(updateGuidanceCopy, 0);
}

void init();
