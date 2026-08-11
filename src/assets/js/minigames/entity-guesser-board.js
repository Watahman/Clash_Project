function applyGridStyle(node, category) {
    node.style.gridTemplateColumns = (
        `minmax(8.5rem,1.35fr) repeat(${category.columns.length},minmax(6.6rem,1fr))`
    );
    node.style.minWidth = `${10 + category.columns.length * 7.25}rem`;
}

function directionLabel(cell, text) {
    if (cell.direction === 'higher') return `↑ ${text('higher')}`;
    if (cell.direction === 'lower') return `↓ ${text('lower')}`;
    return '';
}

function cellLabel(cell, column, text) {
    const direction = directionLabel(cell, text);
    const suffix = direction ? `. ${direction}` : '';
    return `${text(column.labelKey)}: ${cell.displayValue}. ${text(cell.state)}${suffix}`;
}

function cellGlyph(cell) {
    if (cell.state === 'correct') return '✓';
    if (cell.state === 'close' || cell.state === 'partial') return '≈';
    if (cell.state === 'notComparable') return '—';
    return '×';
}

function createCell(cell, column, text) {
    const node = document.createElement('div');
    node.className = `guess-cell is-${cell.state}`;
    node.dataset.state = cell.state;

    const value = document.createElement('span');
    value.textContent = cell.displayValue;
    node.append(value);

    const glyph = document.createElement('span');
    glyph.className = 'guess-state-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = cellGlyph(cell);
    node.append(glyph);

    if (cell.direction) {
        const arrow = document.createElement('b');
        arrow.textContent = cell.direction === 'higher' ? '↑' : '↓';
        arrow.setAttribute('aria-hidden', 'true');
        node.append(arrow);
    }

    const label = cellLabel(cell, column, text);
    node.title = label;
    node.setAttribute('aria-label', label);
    return node;
}

function createGuessRow({ guessed, rowIndex, category, state, answer, compareEntity, text, appendImage }) {
    const comparison = compareEntity(guessed, answer, category);
    const row = document.createElement('div');
    row.className = 'guess-grid guess-grid-row';
    if (rowIndex === state.guesses.length - 1) row.classList.add('is-latest');
    applyGridStyle(row, category);

    const name = document.createElement('div');
    name.className = 'guess-cell guess-name';
    name.setAttribute('aria-label', guessed.name);
    const nameText = document.createElement('span');
    nameText.textContent = guessed.name;
    name.append(nameText);
    appendImage(name, guessed, 'guess-entity-image');
    row.append(name);

    category.columns.forEach((column, index) => {
        row.append(createCell(comparison[index], column, text));
    });
    return { row, comparison };
}

export function createEntityGuessBoard({
    elements,
    getCategory,
    getState,
    getEntities,
    getAnswer,
    compareEntity,
    text,
    appendImage
}) {
    let comparisonRows = [];

    function renderHeader(category) {
        elements.header.replaceChildren();
        applyGridStyle(elements.header, category);

        const first = document.createElement('div');
        first.textContent = text('guess');
        elements.header.append(first);
        category.columns.forEach(column => {
            const node = document.createElement('div');
            node.textContent = text(column.labelKey);
            elements.header.append(node);
        });
    }

    function renderRows(category, state, answer) {
        const entities = getEntities();
        comparisonRows = [];
        elements.rows.replaceChildren();

        state.guesses.forEach((id, rowIndex) => {
            const guessed = entities.find(entity => entity.id === id);
            if (!guessed) return;
            const result = createGuessRow({
                guessed,
                rowIndex,
                category,
                state,
                answer,
                compareEntity,
                text,
                appendImage
            });
            comparisonRows.push(result.comparison);
            elements.rows.append(result.row);
        });
    }

    function render() {
        const category = getCategory();
        const state = getState();
        renderHeader(category);
        renderRows(category, state, getAnswer());
    }

    return {
        render,
        getComparisonRows: () => comparisonRows
    };
}
