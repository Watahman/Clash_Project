import '../theme/theme-manager.js';
import { translations } from './translations.js';

const STORAGE_KEY = 'clashtools_language';
const DEFAULT_LANG = 'nl';

export function getLanguage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return translations[stored] ? stored : DEFAULT_LANG;
}

export function setLanguage(language) {
    const safeLanguage = translations[language] ? language : DEFAULT_LANG;
    localStorage.setItem(STORAGE_KEY, safeLanguage);
    document.documentElement.lang = safeLanguage;
    applyI18n(document);
    window.dispatchEvent(new CustomEvent('clashtools:language-changed', { detail: { language: safeLanguage } }));
}

export function t(key, params = {}) {
    const dictionary = translations[getLanguage()] || translations[DEFAULT_LANG];
    let value = dictionary[key] || translations[DEFAULT_LANG][key] || key;
    Object.entries(params).forEach(([param, replacement]) => {
        value = value.replaceAll(`{${param}}`, replacement ?? '');
    });
    return value;
}

function setContent(element, value) {
    if (value.includes('<')) element.innerHTML = value;
    else element.textContent = value;
}

export function applyI18n(root = document) {
    document.documentElement.lang = getLanguage();

    root.querySelectorAll('[data-i18n]').forEach(element => {
        setContent(element, t(element.dataset.i18n));
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder));
    });
    root.querySelectorAll('[data-i18n-title]').forEach(element => {
        element.setAttribute('title', t(element.dataset.i18nTitle));
    });
    root.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
        element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
    });
}

export function initLanguageSwitcher() {
    let control = document.querySelector('[data-language-control]');
    if (!control) {
        control = Array.from(document.querySelectorAll('header .right button')).find(button => button.id !== 'profile-btn');
    }
    if (!control) return;

    if (control.tagName.toLowerCase() !== 'select') {
        const select = document.createElement('select');
        select.className = 'language-select';
        select.setAttribute('aria-label', t('header.language'));
        select.dataset.languageControl = 'true';
        select.innerHTML = Object.keys(translations).map(lang => `<option value="${lang}">${translations[lang]['language.label'] || lang.toUpperCase()}</option>`).join('');
        control.replaceWith(select);
        control = select;
    } else {
        control.classList.add('language-select');
        control.dataset.languageControl = 'true';
    }

    control.value = getLanguage();
    control.onchange = () => setLanguage(control.value);
}

export function initI18n(root = document) {
    initLanguageSwitcher();
    applyI18n(root);
}
