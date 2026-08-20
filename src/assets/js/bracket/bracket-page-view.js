import { t } from '../i18n/i18n.js';
import { bracketIcon } from './bracket-icons.js';
import { bracketText } from './bracket-copy.js';

const REF_IDS = Object.freeze({
    name: 'bracket-name',
    participants: 'bracket-participants',
    seed: 'bracket-generate-seeded',
    shuffle: 'bracket-generate-shuffled',
    board: 'bracket-board',
    status: 'bracket-status',
    exportButton: 'bracket-export',
    importButton: 'bracket-import',
    importFile: 'bracket-import-file',
    reset: 'bracket-reset',
    participantCount: 'bracket-participant-count',
    participantCountText: 'bracket-participant-count-text',
    resultTitle: 'bracket-result-title',
    resultCount: 'bracket-result-count',
    resultChampion: 'bracket-result-champion',
    resultChampionHelp: 'bracket-result-champion-help',
    returnSetup: 'bracket-return-setup',
    roundNavigation: 'bracket-round-navigation',
    roundPrev: 'bracket-round-prev',
    roundNext: 'bracket-round-next',
    announcement: 'bracket-board-announcement',
    resetDialog: 'bracket-reset-dialog',
    resetConfirm: 'bracket-reset-confirm',
    resetCancel: 'bracket-reset-cancel'
});

export function collectBracketRefs(documentRef) {
    const refs = Object.fromEntries(Object.entries(REF_IDS).map(([key, id]) => [
        key,
        documentRef.getElementById(id)
    ]));
    refs.roundTabs = refs.roundNavigation?.querySelector('[role="tablist"]');
    refs.layout = documentRef.querySelector('.bracket-layout');
    refs.setup = documentRef.querySelector('.bracket-setup');
    return refs;
}

export function participantEntries(refs) {
    return refs.participants.value
        .split(/\r?\n|,/)
        .map(value => value.trim())
        .filter(Boolean);
}

export function setStatus(refs, message = '', state = '') {
    refs.status.textContent = message;
    refs.status.dataset.state = state;
}

export function renderModuleCopy(documentRef, refs) {
    documentRef.querySelectorAll('[data-bracket-copy]').forEach(element => {
        element.textContent = bracketText(element.dataset.bracketCopy);
    });
    if (refs.resetDialog) {
        refs.resetDialog.querySelector('h2').textContent = bracketText('resetConfirmTitle');
        refs.resetDialog.querySelector('[data-reset-copy]').textContent = bracketText('resetConfirmText');
        refs.resetCancel.textContent = bracketText('cancel');
        refs.resetConfirm.textContent = bracketText('clear');
    }
}

export function mountActionIcons(refs) {
    [
        [refs.seed, 'seed'], [refs.shuffle, 'shuffle'], [refs.importButton, 'upload'],
        [refs.exportButton, 'download'], [refs.reset, 'reset'], [refs.roundPrev, 'chevronLeft'],
        [refs.roundNext, 'chevronRight'],
        [refs.returnSetup, 'bracket']
    ].forEach(([button, name]) => button?.prepend(bracketIcon(name, button.ownerDocument)));
}

export function updateSetupSummary(refs, bracket) {
    const count = participantEntries(refs).length;
    refs.participantCount.textContent = String(count);
    refs.participantCountText.textContent = bracketText('count', { count });
    if (!bracket) {
        refs.resultCount.textContent = String(count);
        refs.resultTitle.textContent = refs.name.value.trim() || t('bracket.title');
    }
}

export function setSetupVisibility(refs, hidden) {
    refs.setup.hidden = hidden;
    refs.returnSetup.hidden = !hidden;
    refs.layout?.classList.toggle('is-setup-complete', hidden);
}

export function applyBracketToForm(refs, bracket) {
    refs.name.value = bracket.name;
    refs.participants.value = bracket.participants
        .map(participant => typeof participant === 'string' ? participant : participant.name)
        .join('\n');
}

export function updateRoundControls(refs, bracket, activeRound) {
    const hasRounds = Boolean(bracket?.rounds?.length);
    refs.roundNavigation.hidden = !hasRounds;
    refs.roundPrev.disabled = !hasRounds || activeRound === 0;
    refs.roundNext.disabled = !hasRounds || activeRound === bracket.rounds.length - 1;
    refs.roundPrev.setAttribute('aria-label', bracketText('previousRound'));
    refs.roundNext.setAttribute('aria-label', bracketText('nextRound'));
}

export function focusSelectedRound(refs) {
    refs.roundNavigation.querySelector('[aria-selected="true"]')?.focus();
}

export function announce(refs, message, schedule) {
    refs.announcement.textContent = '';
    schedule(() => { refs.announcement.textContent = message; }, 0);
}

export function updateGuidanceCopy(documentRef) {
    const intro = documentRef.querySelector('#workspace-help-drawer .workspace-help-intro');
    if (intro) intro.textContent = bracketText('setupHelp');
}
