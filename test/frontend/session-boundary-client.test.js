import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    requestJson: vi.fn().mockResolvedValue({}),
    getCachedThenRefresh: vi.fn()
}));

vi.mock('../../src/assets/js/utils/request-json.js?v=20260829-public-auth-v1', () => ({
    requestJson: mocks.requestJson
}));
vi.mock('../../src/assets/js/cache/local-cache.js?v=20260829-public-auth-v1', () => ({
    getCachedThenRefresh: mocks.getCachedThenRefresh
}));

describe('session-bound API clients', () => {
    beforeEach(() => {
        mocks.requestJson.mockClear().mockResolvedValue({});
        mocks.getCachedThenRefresh.mockReset();
    });

    it('marks database requests as session-bound', async () => {
        const { databaseRequestWithBody } = await import(
            '../../src/assets/js/Supabase/Supabase-Client.js?v=20260829-public-auth-v1'
        );

        await databaseRequestWithBody('/private', { userId: 'user-1' });

        expect(mocks.requestJson).toHaveBeenCalledWith('/private', expect.objectContaining({
            sessionBound: true
        }));
    });

    it('marks direct authenticated achievement requests as session-bound', async () => {
        const achievements = await import(
            '../../src/assets/js/Supabase/Supabase-Achievements.js?v=20260829-public-auth-v1'
        );

        await achievements.getAchievements('#PLAYER');
        await achievements.importAchievementBaseData({ buildings: [] });

        expect(mocks.requestJson).toHaveBeenNthCalledWith(1, expect.stringContaining('/Achievements?'),
            expect.objectContaining({ sessionBound: true }));
        expect(mocks.requestJson).toHaveBeenNthCalledWith(2, expect.stringContaining('/AchievementsImport'),
            expect.objectContaining({ sessionBound: true }));
    });
});
