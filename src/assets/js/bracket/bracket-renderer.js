import { t } from '../i18n/i18n.js';
import { bracketChampion } from './bracket-engine.js';
import { bracketText } from './bracket-copy.js';
import { drawBracketConnectors } from './bracket-connectors.js';
import { bracketIcon } from './bracket-icons.js';
import { participantDisplayName } from './bracket-model.js';

function ownerDocument(element) {
    return element?.ownerDocument || globalThis.document;
}

function roundLabel(bracket, roundIndex) {
    return roundIndex === bracket.rounds.length - 1
        ? t('bracket.final')
        : t('bracket.round', { round: roundIndex + 1 });
}

function roundProgress(round) {
    return {
        completed: round.filter(match => Boolean(match.winner)).length,
        total: round.length
    };
}

function normalizeRound(bracket, activeRound) {
    const lastRound = Math.max(0, (bracket?.rounds?.length || 1) - 1);
    return Math.max(0, Math.min(Number(activeRound) || 0, lastRound));
}

function classicStartRound(bracket) {
    const index = bracket.rounds.findIndex(round => round.length <= 4);
    return index < 0 ? bracket.rounds.length - 1 : index;
}

function setRoundRepresentation(board, columns, bracket, activeRound) {
    const classicStart = classicStartRound(bracket);
    const classic = activeRound >= classicStart;
    board.dataset.representation = classic ? 'classic' : 'round-grid';
    board.dataset.classicStart = String(classicStart);
    columns.forEach((column, index) => {
        const active = index === activeRound;
        const visible = classic ? index >= classicStart : active;
        column.dataset.active = String(active);
        column.classList.toggle('is-classic-round', classic && visible);
        column.hidden = !visible;
        column.style.display = visible ? '' : 'none';
        column.setAttribute('aria-hidden', String(!visible));
        column.tabIndex = active ? 0 : -1;
    });
    return classic;
}

function renderRoundTabs(navigation, bracket, activeRound, onRoundChange) {
    navigation.replaceChildren();
    if (!bracket) return [];
    const selectedRound = normalizeRound(bracket, activeRound);
    const documentRef = ownerDocument(navigation);
    return bracket.rounds.map((round, index) => {
        const button = documentRef.createElement('button');
        const active = index === selectedRound;
        const label = roundLabel(bracket, index);
        const progress = roundProgress(round);
        const progressText = bracketText('roundProgress', progress);
        button.type = 'button';
        button.className = 'bracket-round-tab';
        button.id = `bracket-round-tab-${index + 1}`;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', `bracket-round-${index + 1}`);
        button.setAttribute('aria-selected', String(active));
        button.setAttribute('aria-label', `${label}, ${progressText}`);
        button.tabIndex = active ? 0 : -1;

        const title = documentRef.createElement('span');
        title.className = 'bracket-round-tab-label';
        title.textContent = label;
        const progressLabel = documentRef.createElement('span');
        progressLabel.className = 'bracket-round-tab-progress';
        progressLabel.textContent = progressText;
        button.append(title, progressLabel);

        button.addEventListener('click', () => onRoundChange(index, true));
        button.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0
                : event.key === 'End' ? bracket.rounds.length - 1
                    : (index + (event.key === 'ArrowRight' ? 1 : -1) + bracket.rounds.length)
                        % bracket.rounds.length;
            onRoundChange(next, true);
        });
        navigation.appendChild(button);
        return button;
    });
}

function renderSlot(documentRef, bracket, match, player, slotIndex, isOpeningRound, onWinner) {
    if (!player) {
        const empty = documentRef.createElement('span');
        empty.className = `bracket-slot ${isOpeningRound ? 'bracket-slot-bye' : 'bracket-slot-waiting'}`;
        empty.textContent = isOpeningRound ? t('bracket.bye') : bracketText('waiting');
        empty.setAttribute('aria-label', empty.textContent);
        empty.dataset.slot = String(slotIndex);
        return empty;
    }
    const button = documentRef.createElement('button');
    const name = participantDisplayName(
        bracket,
        player,
        number => bracketText('participantNumber', { number })
    );
    button.type = 'button';
    button.className = 'bracket-slot bracket-slot-player';
    button.dataset.slot = String(slotIndex);
    button.dataset.participant = name;
    button.dataset.participantId = player;
    button.setAttribute('aria-pressed', String(match.winner === player));
    button.setAttribute(
        'aria-label',
        match.winner === player
            ? bracketText('selectedWinner', { name })
            : bracketText('selectWinner', { name })
    );
    button.classList.toggle('is-winner', match.winner === player);
    const label = documentRef.createElement('span');
    label.className = 'bracket-slot-name';
    label.textContent = name;
    button.appendChild(label);
    button.addEventListener('click', () => onWinner(match, player));
    return button;
}

function renderMatch(documentRef, bracket, match, roundIndex, changedMatchIds, onWinner, champion) {
    const card = documentRef.createElement('article');
    card.className = 'bracket-match';
    card.dataset.matchId = match.id;
    card.dataset.round = String(roundIndex + 1);
    card.setAttribute('aria-label', bracketText('match', { number: match.index + 1 }));
    if (changedMatchIds.has(match.id)) card.classList.add('is-updated');
    if (champion && match.winner === champion) card.classList.add('is-champion');

    const slots = documentRef.createElement('div');
    slots.className = 'bracket-match-slots';
    match.players.forEach((player, slotIndex) => {
        slots.appendChild(renderSlot(
            documentRef,
            bracket,
            match,
            player,
            slotIndex,
            roundIndex === 0,
            onWinner
        ));
    });
    card.appendChild(slots);

    const state = documentRef.createElement('p');
    state.className = 'bracket-match-state';
    const winnerName = participantDisplayName(
        bracket,
        match.winner,
        number => bracketText('participantNumber', { number })
    );
    state.textContent = match.winner
        ? bracketText('selectedWinner', { name: winnerName })
        : match.players.filter(Boolean).length === 2
            ? bracketText('chooseMatchWinner')
            : '';
    state.hidden = !state.textContent;
    card.appendChild(state);
    return card;
}

function renderRound(documentRef, round, roundIndex, bracket, changedMatchIds, onWinner) {
    const column = documentRef.createElement('section');
    column.className = 'bracket-round';
    column.id = `bracket-round-${roundIndex + 1}`;
    column.setAttribute('role', 'tabpanel');
    column.setAttribute('aria-labelledby', `bracket-round-tab-${roundIndex + 1}`);
    column.dataset.roundIndex = String(roundIndex);
    const heading = documentRef.createElement('h3');
    heading.className = 'bracket-round-heading';
    heading.textContent = roundLabel(bracket, roundIndex);
    column.appendChild(heading);
    const list = documentRef.createElement('div');
    list.className = 'bracket-round-matches';
    const champion = bracketChampion(bracket);
    round.forEach(match => list.appendChild(
        renderMatch(documentRef, bracket, match, roundIndex, changedMatchIds, onWinner, champion)
    ));
    column.appendChild(list);
    return column;
}

function renderEmpty(board) {
    const documentRef = ownerDocument(board);
    const empty = documentRef.createElement('div');
    empty.className = 'bracket-empty-state';
    const icon = bracketIcon('bracket', documentRef);
    icon.classList.add('bracket-empty-icon');
    empty.appendChild(icon);
    const heading = documentRef.createElement('h3');
    heading.textContent = t('bracket.title');
    empty.appendChild(heading);
    const text = documentRef.createElement('p');
    text.textContent = bracketText('empty');
    empty.appendChild(text);
    board.appendChild(empty);
}

export { drawBracketConnectors } from './bracket-connectors.js';

export function renderBracketBoard({
    board,
    navigation,
    bracket,
    activeRound,
    changedMatchIds = new Set(),
    onWinner,
    onRoundChange
}) {
    board.replaceChildren();
    const tabs = renderRoundTabs(navigation, bracket, activeRound, onRoundChange);
    if (!bracket) {
        delete board.dataset.representation;
        delete board.dataset.classicStart;
        renderEmpty(board);
        return { tabs, columns: [] };
    }
    const documentRef = ownerDocument(board);
    const selectedRound = normalizeRound(bracket, activeRound);
    const columns = bracket.rounds.map((round, index) =>
        renderRound(documentRef, round, index, bracket, changedMatchIds, onWinner)
    );
    board.append(...columns);
    const classic = setRoundRepresentation(board, columns, bracket, selectedRound);
    if (classic) drawBracketConnectors(board, bracket);
    return { tabs, columns };
}
