import {
    ASSET_FALLBACKS,
    getEntityAsset,
    installImageFallback
} from '../assets/entity-assets.js';

const ACHIEVEMENT_CATEGORY_ICONS = Object.freeze({
    progression: '/assets/icons/achievements/progression.svg',
    village: '/assets/icons/achievements/village.svg',
    collection: '/assets/icons/achievements/collection.svg',
    attack: '/assets/icons/achievements/attack.svg',
    defense: '/assets/icons/achievements/defense.svg',
    war: '/assets/icons/achievements/war.svg',
    cwl: '/assets/icons/achievements/cwl.svg',
    stats: '/assets/icons/achievements/stats.svg',
    clan: '/assets/icons/achievements/clan-family.svg',
    clan_family: '/assets/icons/achievements/clan-family.svg',
    social: '/assets/icons/achievements/social.svg',
    special: '/assets/icons/achievements/special.svg'
});

function safeCategory(category) {
    return String(category || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
}

export function achievementCategoryIcon(category) {
    return ACHIEVEMENT_CATEGORY_ICONS[safeCategory(category)]
        || ACHIEVEMENT_CATEGORY_ICONS.special;
}

export function entityImage(entity, {
    alt = '',
    className = 'progress-entity-image',
    loading = 'lazy'
} = {}) {
    const image = document.createElement('img');
    image.className = className;
    image.src = ASSET_FALLBACKS.entity;
    image.alt = alt;
    image.loading = loading;
    image.decoding = 'async';
    image.width = 32;
    image.height = 32;
    installImageFallback(image, ASSET_FALLBACKS.entity);

    if (entity) {
        void getEntityAsset(entity).then(asset => {
            if (asset?.image) image.src = asset.image;
        });
    }
    return image;
}

export function categoryImage(category, label = '') {
    const image = document.createElement('img');
    image.className = 'progress-category-image';
    image.src = achievementCategoryIcon(category);
    image.alt = '';
    image.title = label;
    image.width = 32;
    image.height = 32;
    image.loading = 'lazy';
    image.decoding = 'async';
    return image;
}
