import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import en from './compete-locale-en.js';
import nl from './compete-locale-nl.js';
import fr from './compete-locale-fr.js';
import de from './compete-locale-de.js';
import es from './compete-locale-es.js';

const SUPPORTED_LANGUAGES = new Set(['nl', 'en', 'fr', 'de', 'es']);

const COPY = Object.freeze({ en, nl, fr, de, es });

export const competeLocales = COPY;

const reverseValues = Object.freeze(Object.fromEntries(
    Object.entries(COPY).map(([language, copy]) => [
        language,
        new Map(Object.entries(copy).map(([key, value]) => [value, key]))
    ])
));

export function competeT(key, params = {}) {
    const value = COPY[currentLanguage()]?.[key] ?? COPY.en[key] ?? t(key);
    return Object.entries(params).reduce(
        (result, [name, replacement]) =>
            result.replaceAll(`{${name}}`, replacement ?? ''),
        value
    );
}

export function findCompeteKey(value) {
    return reverseValues[currentLanguage()]?.get(String(value || '').trim()) || null;
}

function currentLanguage() {
    const stored = typeof localStorage === 'undefined'
        ? ''
        : localStorage.getItem('clashtools_language');
    if (SUPPORTED_LANGUAGES.has(stored)) return stored;
    const documentLanguage = typeof document === 'undefined'
        ? ''
        : document.documentElement?.lang;
    return SUPPORTED_LANGUAGES.has(documentLanguage) ? documentLanguage : 'en';
}

export function applyCompeteI18n(root = document) {
    root.querySelectorAll?.('[data-compete-i18n]').forEach(element => {
        element.textContent = competeT(element.dataset.competeI18n);
    });
    root.querySelectorAll?.('[data-compete-aria-label]').forEach(element => {
        element.setAttribute(
            'aria-label',
            competeT(element.dataset.competeAriaLabel)
        );
    });
    root.querySelectorAll?.('[data-compete-placeholder]').forEach(element => {
        element.setAttribute(
            'placeholder',
            competeT(element.dataset.competePlaceholder)
        );
    });
    root.querySelectorAll?.('[data-compete-content]').forEach(element => {
        element.setAttribute(
            'content',
            competeT(element.dataset.competeContent)
        );
    });
}

export function initCompeteI18n(root = document, onChange = null) {
    applyCompeteI18n(root);
    if (typeof window === 'undefined') return;
    window.addEventListener('clashtools:language-changed', () => {
        applyCompeteI18n(root);
        onChange?.();
    });
}
