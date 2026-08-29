import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';

export function initClanVisibilityFilter({ container, select }) {
    if (!container || !select) return () => {};

    const apply = () => {
        const selected = select.value;
        clanCards(container).forEach(card => {
            card.hidden = Boolean(selected && clanId(card) !== selected);
        });
    };
    const refresh = () => {
        const selected = select.value;
        const cards = clanCards(container);
        const options = uniqueClanOptions(cards);
        select.replaceChildren(
            option('', t('planner.allClans')),
            ...options.map(({ id, name }) => option(id, name))
        );
        select.value = options.some(({ id }) => id === selected) ? selected : '';
        apply();
    };
    const observer = new MutationObserver(refresh);
    observer.observe(container, { childList: true });
    select.addEventListener('change', apply);
    window.addEventListener('clashtools:language-changed', refresh);
    refresh();

    return () => {
        observer.disconnect();
        select.removeEventListener('change', apply);
        window.removeEventListener('clashtools:language-changed', refresh);
        clanCards(container).forEach(card => { card.hidden = false; });
    };
}

function clanCards(container) {
    return Array.from(container.children).filter(card =>
        card.matches('.cwl-clan-article')
    );
}

function clanId(card) {
    return String(
        card.dataset.clanId
        || card.id
        || card.dataset.clanTag
        || ''
    ).replace(/^cwl-clan-template_/, '').trim();
}

function clanName(card) {
    return card.dataset.clanName
        || card.querySelector('.cwl-clan-name')?.textContent?.trim()
        || card.dataset.clanTag
        || t('cwl.clan');
}

function option(value, label) {
    const element = document.createElement('option');
    element.value = value;
    element.textContent = label;
    return element;
}

function uniqueClanOptions(cards) {
    const seen = new Set();
    return cards.reduce((options, card) => {
        const id = clanId(card);
        if (!id || seen.has(id)) return options;
        seen.add(id);
        options.push({ id, name: clanName(card) });
        return options;
    }, []);
}
