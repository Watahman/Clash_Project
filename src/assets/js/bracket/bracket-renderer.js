import { t } from '../i18n/i18n.js';
import { bracketChampion } from './bracket-engine.js';
import { bracketText } from './bracket-copy.js';
import { bracketIcon } from './bracket-icons.js';

function setActiveRound(columns, activeRound) {
    columns.forEach((column, index) => {
        const active = index === activeRound;
        column.dataset.active = String(active);
        column.setAttribute('aria-hidden', 'false');
    });
}

function renderRoundTabs(navigation, bracket, activeRound, onRoundChange) {
    navigation.replaceChildren();
    if (!bracket) return [];
    const tabs = bracket.rounds.map((round, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'bracket-round-tab';
        button.id = `bracket-round-tab-${index + 1}`;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', `bracket-round-${index + 1}`);
        button.setAttribute('aria-selected', String(index === activeRound));
        button.tabIndex = index === activeRound ? 0 : -1;
        button.textContent = index === bracket.rounds.length - 1
            ? t('bracket.final')
            : t('bracket.round', { round: index + 1 });
        button.addEventListener('click', () => onRoundChange(index));
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
    return tabs;
}

function renderSlot(match, player, slotIndex, isOpeningRound, onWinner) {
    if (!player) {
        const empty = document.createElement('span');
        empty.className = `bracket-slot ${isOpeningRound ? 'bracket-slot-bye' : 'bracket-slot-waiting'}`;
        empty.textContent = isOpeningRound ? t('bracket.bye') : bracketText('waiting');
        empty.setAttribute('aria-label', empty.textContent);
        empty.dataset.slot = String(slotIndex);
        return empty;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bracket-slot bracket-slot-player';
    button.dataset.slot = String(slotIndex);
    button.dataset.participant = player;
    button.setAttribute('aria-pressed', String(match.winner === player));
    button.setAttribute(
        'aria-label',
        match.winner === player
            ? bracketText('selectedWinner', { name: player })
            : bracketText('selectWinner', { name: player })
    );
    button.classList.toggle('is-winner', match.winner === player);
    const label = document.createElement('span');
    label.className = 'bracket-slot-name';
    label.textContent = player;
    button.appendChild(label);
    button.addEventListener('click', () => onWinner(match, player));
    return button;
}

function renderMatch(match, roundIndex, changedMatchIds, onWinner, champion) {
    const card = document.createElement('article');
    card.className = 'bracket-match';
    card.dataset.matchId = match.id;
    card.dataset.round = String(roundIndex + 1);
    card.setAttribute('aria-label', bracketText('match', { number: match.index + 1 }));
    if (changedMatchIds.has(match.id)) card.classList.add('is-updated');
    if (champion && match.winner === champion) card.classList.add('is-champion');

    const slots = document.createElement('div');
    slots.className = 'bracket-match-slots';
    match.players.forEach((player, slotIndex) => {
        slots.appendChild(renderSlot(match, player, slotIndex, roundIndex === 0, onWinner));
    });
    card.appendChild(slots);

    const state = document.createElement('p');
    state.className = 'bracket-match-state';
    state.textContent = match.winner
        ? bracketText('selectedWinner', { name: match.winner })
        : match.players.filter(Boolean).length === 2
            ? bracketText('chooseMatchWinner')
            : '';
    state.hidden = !state.textContent;
    card.appendChild(state);
    return card;
}

function renderRound(round, roundIndex, bracket, changedMatchIds, onWinner) {
    const column = document.createElement('section');
    column.className = 'bracket-round';
    column.id = `bracket-round-${roundIndex + 1}`;
    column.setAttribute('role', 'tabpanel');
    column.setAttribute('aria-labelledby', `bracket-round-tab-${roundIndex + 1}`);
    column.dataset.roundIndex = String(roundIndex);
    const heading = document.createElement('h3');
    heading.className = 'bracket-round-heading';
    heading.textContent = roundIndex === bracket.rounds.length - 1
        ? t('bracket.final')
        : t('bracket.round', { round: roundIndex + 1 });
    column.appendChild(heading);
    const list = document.createElement('div');
    list.className = 'bracket-round-matches';
    const champion = bracketChampion(bracket);
    round.forEach(match => list.appendChild(
        renderMatch(match, roundIndex, changedMatchIds, onWinner, champion)
    ));
    column.appendChild(list);
    return column;
}

function renderEmpty(board) {
    const empty = document.createElement('div');
    empty.className = 'bracket-empty-state';
    const icon = bracketIcon('bracket');
    icon.classList.add('bracket-empty-icon');
    empty.appendChild(icon);
    const heading = document.createElement('h3');
    heading.textContent = t('bracket.title');
    empty.appendChild(heading);
    const text = document.createElement('p');
    text.textContent = bracketText('empty');
    empty.appendChild(text);
    board.appendChild(empty);
}

function createConnectorSvg(board) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('bracket-connectors');
    svg.setAttribute('aria-hidden', 'true');
    board.appendChild(svg);
    return svg;
}

function connectorPath(svg, source, target, active, sourceId) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('bracket-connector');
    if (active) path.classList.add('is-active');
    path.dataset.sourceMatch = sourceId;
    const board = svg.parentElement;
    const boardRect = board.getBoundingClientRect();
    const sourceRect = source.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const startX = sourceRect.right - boardRect.left + board.scrollLeft;
    const startY = sourceRect.top - boardRect.top + board.scrollTop + sourceRect.height / 2;
    const endX = targetRect.left - boardRect.left + board.scrollLeft;
    const endY = targetRect.top - boardRect.top + board.scrollTop + targetRect.height / 2;
    const middleX = startX + Math.max(18, (endX - startX) / 2);
    path.setAttribute('d', `M ${startX} ${startY} H ${middleX} V ${endY} H ${endX}`);
    svg.appendChild(path);
}

export function drawBracketConnectors(board, bracket) {
    const svg = board.querySelector('.bracket-connectors');
    if (!svg || !bracket) return;
    const matchElements = new Map(
        [...board.querySelectorAll('.bracket-match')].map(element => [element.dataset.matchId, element])
    );
    const width = Math.max(board.clientWidth, board.scrollWidth);
    const height = Math.max(board.clientHeight, board.scrollHeight);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.replaceChildren();
    bracket.rounds.slice(0, -1).forEach((round, roundIndex) => {
        round.forEach((match, matchIndex) => {
            const source = matchElements.get(match.id);
            const targetMatch = bracket.rounds[roundIndex + 1][Math.floor(matchIndex / 2)];
            const target = matchElements.get(targetMatch.id);
            if (!source || !target) return;
            connectorPath(
                svg,
                source,
                target,
                Boolean(match.winner && targetMatch.players.includes(match.winner)),
                match.id
            );
        });
    });
}

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
        renderEmpty(board);
        return { tabs, columns: [] };
    }
    const columns = bracket.rounds.map((round, index) =>
        renderRound(round, index, bracket, changedMatchIds, onWinner)
    );
    board.append(...columns);
    createConnectorSvg(board);
    setActiveRound(columns, activeRound);
    drawBracketConnectors(board, bracket);
    return { tabs, columns };
}
