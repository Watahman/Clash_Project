const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function connectorSvg(board) {
    const current = board.querySelector('.bracket-connectors');
    if (current) return current;
    const svg = board.ownerDocument.createElementNS(SVG_NAMESPACE, 'svg');
    svg.classList.add('bracket-connectors');
    svg.setAttribute('aria-hidden', 'true');
    board.appendChild(svg);
    return svg;
}

function connectorPath(svg, source, target, active, sourceId) {
    const path = svg.ownerDocument.createElementNS(SVG_NAMESPACE, 'path');
    const board = svg.parentElement;
    const boardRect = board.getBoundingClientRect();
    const sourceRect = source.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const startX = sourceRect.right - boardRect.left + board.scrollLeft;
    const startY = sourceRect.top - boardRect.top + board.scrollTop + sourceRect.height / 2;
    const endX = targetRect.left - boardRect.left + board.scrollLeft;
    const endY = targetRect.top - boardRect.top + board.scrollTop + targetRect.height / 2;
    const middleX = startX + Math.max(18, (endX - startX) / 2);
    path.classList.add('bracket-connector');
    path.classList.toggle('is-active', active);
    path.dataset.sourceMatch = sourceId;
    path.setAttribute('d', `M ${startX} ${startY} H ${middleX} V ${endY} H ${endX}`);
    svg.appendChild(path);
}

function removeConnectors(board) {
    board?.querySelectorAll('.bracket-connectors').forEach(element => element.remove());
}

export function drawBracketConnectors(board, bracket) {
    if (!board || !bracket || board.dataset.representation !== 'classic') {
        removeConnectors(board);
        return board;
    }
    const svg = connectorSvg(board);
    const matches = new Map(
        [...board.querySelectorAll('.bracket-match')]
            .filter(element => !element.closest('.bracket-round')?.hidden)
            .map(element => [element.dataset.matchId, element])
    );
    const classicStart = Number(board.dataset.classicStart || 0);
    const width = Math.max(board.clientWidth, board.scrollWidth);
    const height = Math.max(board.clientHeight, board.scrollHeight);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.replaceChildren();
    bracket.rounds.slice(classicStart, -1).forEach((round, offset) => {
        const roundIndex = classicStart + offset;
        round.forEach((match, matchIndex) => {
            const source = matches.get(match.id);
            const targetMatch = bracket.rounds[roundIndex + 1][Math.floor(matchIndex / 2)];
            const target = matches.get(targetMatch.id);
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
    return board;
}
