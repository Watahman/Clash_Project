const THEME_TOGGLE_MARKUP = `<span class="theme-button-icons" aria-hidden="true">
    <svg class="theme-icon theme-icon-sun" viewBox="0 0 24 24" fill="none" focusable="false"><circle cx="12" cy="12" r="3.35"/><path d="M12 2.6v2M12 19.4v2M4.1 4.1l1.4 1.4M18.5 18.5l1.4 1.4M2.6 12h2M19.4 12h2M4.1 19.9l1.4-1.4M18.5 5.5l1.4-1.4"/></svg>
    <svg class="theme-icon theme-icon-moon" viewBox="0 0 24 24" fill="none" focusable="false"><path d="M19.3 14.65A7.6 7.6 0 0 1 9.35 4.7 7.6 7.6 0 1 0 19.3 14.65Z"/></svg>
</span>`;

export function ensureThemeToggleMarkup(root = document) {
    root.querySelectorAll?.('[data-theme-toggle]').forEach(button => {
        if (button.querySelector('.theme-button-icons')) return;
        button.innerHTML = THEME_TOGGLE_MARKUP;
    });
}

export { THEME_TOGGLE_MARKUP };
