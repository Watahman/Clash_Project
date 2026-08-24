const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function updateAchievementCount(cards, countNode) {
    if (!countNode) return;
    const visible = cards.filter(card => !card.hidden).length;
    countNode.textContent = String(visible);
}

function initAchievementFilters() {
    const grid = document.querySelector('[data-achievement-grid]');
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll('[data-category][data-rarity]'));
    const controls = Array.from(document.querySelectorAll('[data-achievement-filter]'));
    const empty = document.querySelector('[data-achievement-empty]');
    const countNode = document.querySelector('[data-achievement-count]');
    if (!cards.length || !controls.length) return;

    const apply = () => {
        const filters = Object.fromEntries(controls.map(control => [control.dataset.achievementFilter, control.value]));
        let visible = 0;
        cards.forEach(card => {
            const matches = Object.entries(filters).every(([key, value]) => value === 'all' || card.dataset[key] === value);
            card.hidden = !matches;
            if (matches) visible += 1;
        });
        if (empty) empty.hidden = visible > 0;
        updateAchievementCount(cards, countNode);
    };

    controls.forEach(control => control.addEventListener('change', apply));
    apply();
}

function initTrendPeriods() {
    const panel = document.querySelector('.pp-trend-panel');
    if (!panel) return;
    const buttons = Array.from(panel.querySelectorAll('[data-stat-period]'));
    const value = panel.querySelector('[data-stat-trend-value]');
    const caption = panel.querySelector('[data-stat-trend-caption]');
    const line = panel.querySelector('[data-stat-trend-line]');
    if (!buttons.length || !value || !caption || !line) return;

    const samples = { '20': buildTrendSample(20), '90': buildTrendSample(90) };
    const activate = period => {
        const sample = samples[period] || samples['20'];
        buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.statPeriod === period)));
        value.textContent = sample.value;
        caption.textContent = sample.caption;
        line.setAttribute('d', sample.path);
        line.nextElementSibling?.setAttribute('cx', String(sample.end.x));
        line.nextElementSibling?.setAttribute('cy', String(sample.end.y));
        window.dispatchEvent(new CustomEvent('clashtools:public-progress-updated'));
    };
    buttons.forEach(button => button.addEventListener('click', () => activate(button.dataset.statPeriod)));
    activate(buttons.find(button => button.getAttribute('aria-pressed') === 'true')?.dataset.statPeriod || '20');
}

function buildTrendSample(days) {
    const canonicalStars = Array.from({ length: 20 }, (_, index) => index % 5 === 0 ? 2 : 3);
    const isCanonical = days === canonicalStars.length;
    const values = isCanonical
        ? canonicalStars
        : Array.from({ length: days }, (_, index) => 2.2 + ((index * 7) % 8) / 10);
    const points = values.map((score, index) => ({
        x: 12 + (596 * index) / Math.max(values.length - 1, 1),
        y: 145 - ((score - 2) / 1) * 90
    }));
    const average = values.reduce((total, score) => total + score, 0) / values.length;
    return {
        value: average.toFixed(2),
        caption: isCanonical ? '20-battle fixture average' : `separate illustrative sample · ${days} days`,
        path: points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(''),
        end: points.at(-1)
    };
}

function initRevealFallback() {
    if (!document.querySelector('[data-reveal]')) return;
    if ('IntersectionObserver' in window && !window.matchMedia(REDUCED_MOTION).matches) return;
    document.querySelectorAll('[data-reveal]').forEach(element => element.classList.add('is-visible'));
}

function init() {
    initAchievementFilters();
    initTrendPeriods();
    initRevealFallback();
}

init();
