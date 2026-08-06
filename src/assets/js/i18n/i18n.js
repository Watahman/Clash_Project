import '../theme/theme-manager.js';
import {
    ensureLanguage,
    getTranslationValue,
    isLanguageLoaded,
    isSupportedLanguage,
    supportedLanguages,
    translations
} from './runtime-translations.js';

const STORAGE_KEY = 'clashtools_language';
const DEFAULT_LANG = 'en';

const LANGUAGE_METADATA = Object.freeze({
    nl: Object.freeze({ code: 'NL', name: 'Nederlands' }),
    en: Object.freeze({ code: 'EN', name: 'English' }),
    fr: Object.freeze({ code: 'FR', name: 'Français' }),
    de: Object.freeze({ code: 'DE', name: 'Deutsch' }),
    es: Object.freeze({ code: 'ES', name: 'Español' })
});

const LANGUAGE_ICON = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.8 12h16.4M12 3.5c2.2 2.3 3.4 5.1 3.4 8.5S14.2 18.2 12 20.5M12 3.5C9.8 5.8 8.6 8.6 8.6 12s1.2 6.2 3.4 8.5"/></svg>';
const CHEVRON_ICON = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 9.5 5 5 5-5"/></svg>';
const CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6.5 12.5 3.3 3.3 7.7-8"/></svg>';
const languageChangeHandlers = new WeakMap();
const sourceText = new WeakMap();
const sourceAttributes = new WeakMap();
const documentSource = {};
let englishSourceIndex = null;

export function getLanguage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isSupportedLanguage(stored) ? stored : DEFAULT_LANG;
}

export function setLanguage(language) {
    const safeLanguage = isSupportedLanguage(language) ? language : DEFAULT_LANG;
    localStorage.setItem(STORAGE_KEY, safeLanguage);
    document.documentElement.lang = safeLanguage;
    void ensureLanguage(safeLanguage).then(() => {
        applyI18n(document);
        window.dispatchEvent(new CustomEvent('clashtools:language-changed', { detail: { language: safeLanguage } }));
    });
}

export function t(key, params = {}) {
    let value = getTranslationValue(getLanguage(), key) ?? key;
    Object.entries(params).forEach(([param, replacement]) => {
        value = value.replaceAll(`{${param}}`, replacement ?? '');
    });
    return value;
}

const SAFE_HTML_KEYS = new Set(['home.title']);
const SOURCE_ATTRIBUTE_NAMES = ['aria-label', 'title', 'placeholder', 'alt'];
const SOURCE_SKIP_SELECTOR = [
    '[data-i18n]',
    '[data-i18n-html]',
    'script',
    'style',
    'noscript',
    'textarea',
    'input',
    'select',
    'option',
    'code',
    'pre',
    'svg'
].join(',');

function getEnglishSourceIndex() {
    if (englishSourceIndex) return englishSourceIndex;
    englishSourceIndex = new Map();
    Object.entries(translations.en).forEach(([key, value]) => {
        if (typeof value !== 'string') return;
        const source = value.trim();
        if (!source || source.includes('{')) return;
        if (!englishSourceIndex.has(source)) englishSourceIndex.set(source, key);
    });
    return englishSourceIndex;
}

function translatedSource(source) {
    const normalized = String(source || '').trim();
    if (!normalized) return null;
    const key = getEnglishSourceIndex().get(normalized);
    if (!key) return null;
    return t(key);
}

function applyPublicTextNodes(root) {
    const scanRoot = root === document ? document.body : root;
    if (!scanRoot) return;
    const showText = document.defaultView?.NodeFilter?.SHOW_TEXT ?? 4;
    const walker = document.createTreeWalker(scanRoot, showText);
    let node = walker.nextNode();
    while (node) {
        const parent = node.parentElement;
        if (parent && !parent.closest(SOURCE_SKIP_SELECTOR)) {
            const original = sourceText.get(node) ?? node.nodeValue;
            if (!sourceText.has(node)) sourceText.set(node, original);
            const translated = translatedSource(original);
            if (translated !== null) {
                const leading = original.match(/^\s*/)?.[0] || '';
                const trailing = original.match(/\s*$/)?.[0] || '';
                node.nodeValue = `${leading}${translated}${trailing}`;
            } else if (getLanguage() === DEFAULT_LANG) {
                node.nodeValue = original;
            }
        }
        node = walker.nextNode();
    }
}

function applyPublicAttributes(root) {
    const scanRoot = root === document ? document : root;
    const elements = scanRoot.querySelectorAll(SOURCE_ATTRIBUTE_NAMES.map(name => `[${name}]`).join(','));
    elements.forEach(element => {
        const saved = sourceAttributes.get(element) || {};
        SOURCE_ATTRIBUTE_NAMES.forEach(name => {
            if (!element.hasAttribute(name)) return;
            const explicitKey = name === 'aria-label'
                ? element.dataset.i18nAriaLabel
                : name === 'title'
                    ? element.dataset.i18nTitle
                    : name === 'placeholder'
                        ? element.dataset.i18nPlaceholder
                        : null;
            if (explicitKey) return;
            if (!(name in saved)) saved[name] = element.getAttribute(name);
            const translated = translatedSource(saved[name]);
            element.setAttribute(name, translated ?? saved[name]);
        });
        sourceAttributes.set(element, saved);
    });
}

function applyPublicDocumentCopy() {
    if (!documentSource.title) documentSource.title = document.title;
    document.title = translatedSource(documentSource.title) ?? documentSource.title;

    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
        if (!documentSource.description) documentSource.description = meta.content;
        meta.content = translatedSource(documentSource.description) ?? documentSource.description;
    }
}

function applyPublicSourceCopy(root) {
    if (!document.body?.classList.contains('public-site')) return;
    applyPublicTextNodes(root);
    applyPublicAttributes(root);
    applyPublicDocumentCopy();
}

export function applyI18n(root = document) {
    document.documentElement.lang = getLanguage();

    root.querySelectorAll('[data-i18n]').forEach(element => {
        element.textContent = t(element.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-html]').forEach(element => {
        const key = element.dataset.i18nHtml;
        if (SAFE_HTML_KEYS.has(key)) element.innerHTML = t(key);
        else element.textContent = t(key);
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
    applyPublicSourceCopy(root);
}

function getLanguageMeta(language) {
    return LANGUAGE_METADATA[language] || {
        code: language.toUpperCase(),
        name: translations[language]?.['language.label'] || language.toUpperCase()
    };
}

function syncLanguageSwitcher(switcher) {
    if (!switcher) return;

    const language = getLanguage();
    const metadata = getLanguageMeta(language);
    const button = switcher.querySelector('[data-language-trigger]');
    const currentCode = switcher.querySelector('[data-language-current-code]');
    const currentName = switcher.querySelector('[data-language-current-name]');

    if (currentCode) currentCode.textContent = metadata.code;
    if (currentName) currentName.textContent = metadata.name;

    if (button) {
        const languageLabel = t('header.language');
        button.setAttribute('aria-label', `${languageLabel}: ${metadata.name}`);
        button.title = `${languageLabel}: ${metadata.name}`;
    }

    switcher.querySelectorAll('[data-language-option]').forEach(option => {
        const isSelected = option.dataset.languageOption === language;
        option.classList.toggle('is-active', isSelected);
        option.setAttribute('aria-selected', String(isSelected));
        option.tabIndex = isSelected ? 0 : -1;
    });
}

function closeLanguageSwitcher(switcher, { restoreFocus = false } = {}) {
    const button = switcher?.querySelector('[data-language-trigger]');
    const menu = switcher?.querySelector('[data-language-menu]');
    if (!button || !menu || menu.classList.contains('hidden')) return;

    menu.classList.add('hidden');
    button.setAttribute('aria-expanded', 'false');
    switcher.classList.remove('is-open');

    if (restoreFocus) button.focus();
}

function openLanguageSwitcher(switcher) {
    const button = switcher?.querySelector('[data-language-trigger]');
    const menu = switcher?.querySelector('[data-language-menu]');
    if (!button || !menu) return;

    menu.classList.remove('hidden');
    button.setAttribute('aria-expanded', 'true');
    switcher.classList.add('is-open');

    const selected = menu.querySelector('[aria-selected="true"]');
    const focusSelected = () => selected?.focus();
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(focusSelected);
    else window.setTimeout(focusSelected, 0);
}

function moveLanguageFocus(options, currentIndex, direction) {
    if (!options.length) return;
    const nextIndex = (currentIndex + direction + options.length) % options.length;
    options.forEach((option, index) => {
        option.tabIndex = index === nextIndex ? 0 : -1;
    });
    options[nextIndex].focus();
}

export function mountLanguageSwitcher(control, { variant = '', onChange = null } = {}) {
    if (!control) return null;

    if (control.matches?.('[data-language-switcher]')) {
        if (variant) control.classList.add(`language-switcher--${variant}`);
        if (typeof onChange === 'function') languageChangeHandlers.set(control, onChange);
        syncLanguageSwitcher(control);
        return control;
    }

    const switcher = document.createElement('div');
    switcher.className = 'language-switcher';
    if (variant) switcher.classList.add(`language-switcher--${variant}`);
    switcher.dataset.languageSwitcher = 'true';

    if (control.id) switcher.id = control.id;
    if (typeof onChange === 'function') languageChangeHandlers.set(switcher, onChange);

    const options = supportedLanguages.map(language => {
        const metadata = getLanguageMeta(language);
        return `<button class="language-switcher-option" type="button" role="option" data-language-option="${language}" aria-selected="false" tabindex="-1">
            <span class="language-switcher-code" aria-hidden="true">${metadata.code}</span>
            <span class="language-switcher-option-name">${metadata.name}</span>
            <span class="language-switcher-check">${CHECK_ICON}</span>
        </button>`;
    }).join('');

    switcher.innerHTML = `
        <button class="language-switcher-button" type="button" data-language-trigger aria-haspopup="listbox" aria-expanded="false">
            <span class="language-switcher-globe">${LANGUAGE_ICON}</span>
            <span class="language-switcher-current">
                <span class="language-switcher-current-code" data-language-current-code></span>
                <span class="language-switcher-current-name" data-language-current-name></span>
            </span>
            <span class="language-switcher-chevron">${CHEVRON_ICON}</span>
        </button>
        <div class="language-switcher-menu hidden" data-language-menu role="listbox" aria-label="${t('header.language')}">
            ${options}
        </div>`;

    control.replaceWith(switcher);

    const button = switcher.querySelector('[data-language-trigger]');
    const menu = switcher.querySelector('[data-language-menu]');

    button.addEventListener('click', () => {
        if (menu.classList.contains('hidden')) openLanguageSwitcher(switcher);
        else closeLanguageSwitcher(switcher);
    });

    button.addEventListener('keydown', event => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        openLanguageSwitcher(switcher);
    });

    menu.addEventListener('click', event => {
        const option = event.target.closest('[data-language-option]');
        if (!option) return;
        const language = option.dataset.languageOption;
        setLanguage(language);
        languageChangeHandlers.get(switcher)?.(language);
        closeLanguageSwitcher(switcher, { restoreFocus: true });
    });

    menu.addEventListener('keydown', event => {
        const optionsList = Array.from(menu.querySelectorAll('[data-language-option]'));
        const currentIndex = Math.max(0, optionsList.indexOf(document.activeElement));

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveLanguageFocus(optionsList, currentIndex, 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveLanguageFocus(optionsList, currentIndex, -1);
        } else if (event.key === 'Home') {
            event.preventDefault();
            optionsList[0]?.focus();
        } else if (event.key === 'End') {
            event.preventDefault();
            optionsList.at(-1)?.focus();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            closeLanguageSwitcher(switcher, { restoreFocus: true });
        }
    });

    document.addEventListener('pointerdown', event => {
        if (!switcher.contains(event.target)) closeLanguageSwitcher(switcher);
    });

    window.addEventListener('clashtools:language-changed', () => {
        menu.setAttribute('aria-label', t('header.language'));
        syncLanguageSwitcher(switcher);
    });

    syncLanguageSwitcher(switcher);
    return switcher;
}

export function initLanguageSwitcher(root = document) {
    const existingSwitchers = Array.from(root.querySelectorAll('[data-language-switcher]'));
    existingSwitchers.forEach(syncLanguageSwitcher);

    const controls = Array.from(root.querySelectorAll('[data-language-control]'));
    if (controls.length) {
        controls.forEach(control => mountLanguageSwitcher(control));
        return;
    }

    if (existingSwitchers.length) return;

    const fallbackControl = Array.from(document.querySelectorAll('header .right button'))
        .find(button => button.id !== 'profile-btn');
    if (fallbackControl) mountLanguageSwitcher(fallbackControl);
}

export function initI18n(root = document) {
    initLanguageSwitcher(root);
    applyI18n(root);
    const language = getLanguage();
    if (!isLanguageLoaded(language)) {
        void ensureLanguage(language).then(() => {
            applyI18n(root);
            window.dispatchEvent(new CustomEvent('clashtools:language-changed', { detail: { language } }));
        });
    }
}
