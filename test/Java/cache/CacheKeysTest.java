package Java.cache;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CacheKeysTest {
    @Test
    void normalizesTagsConsistently() {
        assertEquals("#ABC123", CacheKeys.normalizeTag("  abc123 "));
        assertEquals("#ABC123", CacheKeys.normalizeTag(" #AbC123 "));
        assertEquals("#ABC123", CacheKeys.normalizeTag("%23abc123"));
    }

    @Test
    void pathsProduceDifferentCacheKeys() {
        String clan = CacheKeys.clashGet("/clans/%23ABC123");
        String members = CacheKeys.clashGet("/clans/%23ABC123/members");
        String currentWar = CacheKeys.clashGet("/clans/%23ABC123/currentwar");
        assertNotEquals(clan, members);
        assertNotEquals(clan, currentWar);
        assertNotEquals(members, currentWar);
    }

    @Test
    void validatesTagsBeforeTheyReachTheClashApi() {
        assertEquals("#P0LYQ8", CacheKeys.requireValidTag("p0lyq8"));
        assertThrows(IllegalArgumentException.class, () -> CacheKeys.requireValidTag("#ABC123"));
        assertThrows(IllegalArgumentException.class, () -> CacheKeys.requireValidTag("../../players"));
    }
}
