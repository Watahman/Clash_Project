package Java.cache;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class InMemoryCacheStoreTest {
    @Test
    void returnsFreshAndStaleUsableEntriesButDropsHardExpiredEntries() {
        InMemoryCacheStore store = new InMemoryCacheStore();
        long now = System.currentTimeMillis();
        CacheEntry fresh = new CacheEntry("{\"fresh\":true}", now, now + 1_000, now + 2_000, 200);
        store.put("fresh", fresh);
        assertSame(fresh, store.get("fresh"));
        assertTrue(store.get("fresh").isFresh());

        CacheEntry stale = new CacheEntry("{\"stale\":true}", now - 2_000, now - 1_000, now + 1_000, 200);
        store.put("stale", stale);
        assertSame(stale, store.get("stale"));
        assertFalse(store.get("stale").isFresh());
        assertTrue(store.get("stale").isUsable());

        CacheEntry expired = new CacheEntry("{}", now - 3_000, now - 2_000, now - 1_000, 200);
        store.put("expired", expired);
        assertNull(store.get("expired"));
    }
}
