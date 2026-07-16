import { describe, expect, it } from 'vitest';
import { cacheKeys, normalizeTag } from '../../src/assets/js/cache/cache-keys.js';

describe('Clash cache keys', () => {
    it('normalizes tags with whitespace, casing and an optional hash', () => {
        expect(normalizeTag('  abc123 ')).toBe('#ABC123');
        expect(normalizeTag(' #AbC123 ')).toBe('#ABC123');
    });

    it('keeps endpoint payload types isolated', () => {
        const tag = '#ABC123';
        const keys = new Set([
            cacheKeys.clashClanInfo(tag),
            cacheKeys.clashClanMembers(tag),
            cacheKeys.clashClanCurrentWar(tag),
            cacheKeys.clashClanLeagueGroup(tag),
            cacheKeys.clashClanRaidSeasons(tag)
        ]);
        expect(keys.size).toBe(5);
    });

    it('creates stable clan search keys independent of property order', () => {
        expect(cacheKeys.clashClanSearch({ name: 'Test', limit: 10 }))
            .toBe(cacheKeys.clashClanSearch({ limit: 10, name: 'Test' }));
    });
});
