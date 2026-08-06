const COPY = {
    en: { entity: 'Entity Guesser', higherLower: 'Higher or Lower' },
    nl: { entity: 'Entity Guesser', higherLower: 'Hoger of lager' },
    de: { entity: 'Entity Guesser', higherLower: 'Höher oder niedriger' },
    fr: { entity: 'Entity Guesser', higherLower: 'Plus ou moins' },
    es: { entity: 'Entity Guesser', higherLower: 'Mayor o menor' }
};

const buttons = [...document.querySelectorAll('[data-minigame-select]')];
const views = [...document.querySelectorAll('[data-minigame-view]')];

function language() {
    const code = document.documentElement.lang?.slice(0, 2).toLowerCase();
    return COPY[code] ? code : 'en';
}

function normalizeGame(value) {
    return value === 'higher-lower' ? 'higher-lower' : 'entity';
}

function selectedFromUrl() {
    return normalizeGame(new URLSearchParams(location.search).get('game'));
}

function translate() {
    buttons.forEach(button => {
        const key = button.dataset.minigameSelect === 'higher-lower' ? 'higherLower' : 'entity';
        button.querySelector('[data-minigame-label]').textContent = COPY[language()][key];
    });
}

function selectGame(game, updateUrl = true) {
    const selected = normalizeGame(game);
    buttons.forEach(button => {
        const active = button.dataset.minigameSelect === selected;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
    });
    views.forEach(view => {
        const active = view.dataset.minigameView === selected;
        view.hidden = !active;
    });

    if (updateUrl) {
        const url = new URL(location.href);
        if (selected === 'entity') url.searchParams.delete('game');
        else url.searchParams.set('game', selected);
        history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
}

buttons.forEach(button => button.addEventListener('click', () => selectGame(button.dataset.minigameSelect)));
window.addEventListener('popstate', () => selectGame(selectedFromUrl(), false));
window.addEventListener('clashtools:language-changed', translate);

translate();
selectGame(selectedFromUrl(), false);
