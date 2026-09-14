import { buildAchievementCategories } from './achievement-category-model.js?v=20260914-achievement-polish-v1';

const normalizedKey = value => String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-');

export function achievementCollectionKey(value) {
    return String(value?.collectionKey || value?.key || value?.categoryKey
        || value?.id || value?.category || '').trim();
}

export function resolveAchievementCollectionKey(families, value) {
    const requested = String(value || '');
    if (!requested) return '';
    const normalized = normalizedKey(requested);
    const collection = buildAchievementCategories(families).find(candidate => {
        const key = achievementCollectionKey(candidate);
        return key === requested || normalizedKey(key) === normalized;
    });
    if (collection) return achievementCollectionKey(collection);
    return achievementCollectionKey((families || []).find(family => {
        const key = achievementCollectionKey(family);
        return key === requested || normalizedKey(key) === normalized;
    }));
}
