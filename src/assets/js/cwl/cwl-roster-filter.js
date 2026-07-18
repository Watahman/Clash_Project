import { t } from '../i18n/i18n.js';

function normalizeSearchValue(value) {
    return String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function getPlayerSearchValue(card) {
    const name = card.querySelector('.cwl-player-name')?.textContent || '';
    const tag = card.dataset.playerTag
        || card.querySelector('.cwl-player-hashtag')?.textContent
        || '';
    const normalizedTag = tag.replace(/^#/, '');
    return normalizeSearchValue(`${name} ${tag} ${normalizedTag}`);
}

function filterFreeRoster(container, query) {
    const normalizedQuery = normalizeSearchValue(query);
    const cards = Array.from(container?.children || [])
        .filter(element => element.matches?.('.cwl-player-article[data-planner-card="true"]'));
    let visible = 0;

    cards.forEach(card => {
        const matches = !normalizedQuery || getPlayerSearchValue(card).includes(normalizedQuery);
        card.hidden = !matches;
        if (matches) visible += 1;
    });

    return { total: cards.length, visible, hasQuery: Boolean(normalizedQuery) };
}

function initFreeRosterFilter({ container, input, status }) {
    if (!container || !input) return () => {};

    const applyFilter = () => {
        const result = filterFreeRoster(container, input.value);
        const noMatches = result.hasQuery && result.total > 0 && result.visible === 0;
        container.dataset.filterEmpty = String(noMatches);
        container.dataset.filterEmptyLabel = t('planner.noRosterMatches');
        if (status) {
            status.textContent = result.hasQuery
                ? t('planner.rosterResults', { visible: result.visible, total: result.total })
                : '';
        }
        return result;
    };

    const observer = new MutationObserver(applyFilter);
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    input.addEventListener('input', applyFilter);
    window.addEventListener('clashtools:language-changed', applyFilter);
    applyFilter();

    return () => {
        observer.disconnect();
        input.removeEventListener('input', applyFilter);
        window.removeEventListener('clashtools:language-changed', applyFilter);
    };
}

export { filterFreeRoster, initFreeRosterFilter, normalizeSearchValue };
