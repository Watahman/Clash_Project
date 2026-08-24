import { describe, expect, it } from 'vitest';

import { ASSET_FALLBACKS } from '../../src/assets/js/assets/entity-assets.js';
import {
    installLiveBadgeFallbacks,
    liveSideMarkup
} from '../../src/assets/js/operation-board/operation-board-live-side-renderer.js';

const side = {
    name: 'Belgian Warriors',
    stars: 31,
    destruction: 91.4,
    attacksUsed: 12,
    availableAttacks: 15,
    remainingAttacks: 3
};

describe('Operation Board live clan badges', () => {
    it('renders an official clan badge beside the clan name', () => {
        document.body.innerHTML = liveSideMarkup({
            ...side,
            badgeUrl: 'https://example.test/badge.png'
        });

        const badge = document.querySelector('.op-live-clan-badge');
        expect(badge.src).toBe('https://example.test/badge.png');
        expect(badge.nextElementSibling.textContent).toBe('Belgian Warriors');
    });

    it('uses the central fallback for unsafe or failed badge URLs', () => {
        document.body.innerHTML = liveSideMarkup({
            ...side,
            badgeUrl: 'javascript:alert(1)'
        });

        const badge = document.querySelector('.op-live-clan-badge');
        expect(badge.getAttribute('src')).toBe(ASSET_FALLBACKS.clan);

        badge.src = 'https://example.test/missing.png';
        installLiveBadgeFallbacks(document.body);
        badge.dispatchEvent(new Event('error'));
        expect(badge.getAttribute('src')).toBe(ASSET_FALLBACKS.clan);
    });
});
