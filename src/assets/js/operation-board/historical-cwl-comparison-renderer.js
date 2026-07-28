import { compareHistoricalSeasons } from './historical-cwl-comparison.js';
import { escapeHtml } from './operation-board-utils.js';

export function renderHistoricalComparison(container, seasons) {
    if (seasons.length < 2) {
        container.innerHTML = '<p class="op-history-empty">At least two complete seasons are needed for comparison.</p>';
        return;
    }
    const left = seasons[1];
    const right = seasons[0];
    container.innerHTML = `
        <div class="op-history-compare-controls">
            ${seasonSelect('op-compare-left', seasons, left.data.season)}
            <span aria-hidden="true">vs</span>
            ${seasonSelect('op-compare-right', seasons, right.data.season)}
        </div>
        <div class="op-history-comparison-table"></div>`;
    const leftSelect = container.querySelector('#op-compare-left');
    const rightSelect = container.querySelector('#op-compare-right');
    const table = container.querySelector('.op-history-comparison-table');
    const render = () => {
        const leftItem = seasons.find(item =>
            item.data.season === leftSelect.value
        );
        const rightItem = seasons.find(item =>
            item.data.season === rightSelect.value
        );
        const rows = compareHistoricalSeasons(
            leftItem?.summary,
            rightItem?.summary
        );
        table.innerHTML = `
            <div class="op-history-comparison-row op-history-comparison-head">
                <span>Metric</span>
                <strong>${escapeHtml(leftItem?.label || '')}</strong>
                <strong>${escapeHtml(rightItem?.label || '')}</strong>
                <span>Change</span>
            </div>
            ${rows.map(row => `
                <div class="op-history-comparison-row">
                    <span>${escapeHtml(row.label)}</span>
                    <strong>${escapeHtml(row.left)}</strong>
                    <strong>${escapeHtml(row.right)}</strong>
                    <em data-direction="${row.direction}">${escapeHtml(row.change)}</em>
                </div>`).join('')}`;
    };
    leftSelect.onchange = render;
    rightSelect.onchange = render;
    render();
}

function seasonSelect(id, seasons, selected) {
    return `<label>
        <span class="sr-only">Season</span>
        <select id="${id}">
            ${seasons.map(item => `
                <option value="${escapeHtml(item.data.season)}"
                    ${item.data.season === selected ? 'selected' : ''}>
                    ${escapeHtml(item.label)}
                </option>`).join('')}
        </select>
    </label>`;
}
