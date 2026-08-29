import {
    ASSET_FALLBACKS,
    installImageFallback
} from '../assets/entity-assets.js';
import { competeT as t } from './compete-locales.js?v=20260829-public-auth-v1';
import { escapeHtml, number } from './operation-board-utils.js';

export function liveSideMarkup(side) {
    const hasData = side.stars != null;
    const badgeUrl = safeBadgeUrl(side.badgeUrl) || ASSET_FALLBACKS.clan;
    return `
        <article class="op-live-side">
            <div class="op-live-clan">
                <img class="op-live-clan-badge" src="${escapeHtml(badgeUrl)}"
                    alt="" width="44" height="44" loading="lazy">
                <h2>${escapeHtml(side.name || '—')}</h2>
            </div>
            <strong>${hasData ? number(side.stars, 0) : '—'}<small> ${escapeHtml(t('cwl.starsUnit'))}</small></strong>
            <dl>
                <div><dt>${escapeHtml(t('op.destruction'))}</dt><dd>${hasData ? `${number(side.destruction, 0).toFixed(1)}%` : '—'}</dd></div>
                <div><dt>${escapeHtml(t('op.attacks'))}</dt><dd>${number(side.attacksUsed, 0)} / ${number(side.availableAttacks, 0)}</dd></div>
                <div><dt>${escapeHtml(t('op.remainingAttacks'))}</dt><dd>${number(side.remainingAttacks, 0)}</dd></div>
            </dl>
        </article>`;
}

export function installLiveBadgeFallbacks(container) {
    container.querySelectorAll('.op-live-clan-badge').forEach(image =>
        installImageFallback(image, ASSET_FALLBACKS.clan)
    );
}

function safeBadgeUrl(value) {
    const raw = String(value || '').trim();
    if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
    try {
        const url = new URL(raw);
        return ['http:', 'https:'].includes(url.protocol) ? raw : '';
    } catch {
        return '';
    }
}
