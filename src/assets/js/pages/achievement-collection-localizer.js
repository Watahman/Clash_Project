import { getLanguage, t } from '../i18n/i18n.js?v=20260914-achievement-polish-v1';
import { achievementChronicleLocales } from '../i18n/achievement-chronicle-locales.js?v=20260914-achievement-polish-v1';
import { buildAchievementCategories } from './achievement-category-model.js?v=20260914-achievement-polish-v1';

export function hubTranslated(key, fallback = key, params = {}) {
    let value = achievementChronicleLocales[getLanguage()]?.[key]
        || achievementChronicleLocales.en?.[key]
        || translated(key, fallback);
    Object.entries(params).forEach(([param, replacement]) => {
        value = value.replaceAll(`{${param}}`, replacement ?? '');
    });
    return value;
}

function translated(key, fallback = key) {
    const value = t(key);
    return value === key ? fallback : value;
}

function localeKey(key) {
    return String(key || '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function localizeCollection(collection) {
    const key = collection?.collectionKey || collection?.key || collection?.categoryKey || collection?.category;
    const localizedKey = localeKey(key);
    const title = hubTranslated(`achievements.collection.${localizedKey}.title`, collection?.categoryLabel || key);
    const description = hubTranslated(`achievements.collection.${localizedKey}.description`, collection?.description || '');
    const badge = collection?.badge && typeof collection.badge === 'object'
        ? { ...collection.badge, name: hubTranslated(`achievements.collection.${localizedKey}.badge`, collection.badge.name || collection.badge.label || '') }
        : collection?.badge;
    return { ...collection, key: key || 'other', title, label: title, categoryLabel: title, description, badge, badgeDefinition: badge };
}

export function localizeAchievementCollections(families) {
    return buildAchievementCategories(families).map(localizeCollection);
}
