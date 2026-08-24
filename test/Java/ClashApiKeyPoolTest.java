package Java;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ClashApiKeyPoolTest {
    @Test
    void parsesOneToTenJsonKeysAndNormalizesBearerPrefix() {
        List<String> parsed = ClashApiKeyPool.parseConfiguredKeys(
                "[\"first\",\"bearer second\",\"Bearer third\"]",
                List.of("ignored-legacy")
        );
        List<String> ten = ClashApiKeyPool.parseConfiguredKeys(
                "[\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\",\"8\",\"9\",\"10\"]",
                List.of()
        );

        assertEquals(List.of("first", "second", "third"), parsed);
        assertEquals(10, ten.size());
    }

    @Test
    void removesDuplicatesAndKeepsLegacyCompatibilityWhenPoolIsAbsent() {
        assertEquals(
                List.of("same", "other"),
                ClashApiKeyPool.parseConfiguredKeys(
                        "[\"same\",\"Bearer same\",\"other\"]",
                        List.of("ignored")
                )
        );
        assertEquals(
                List.of("first", "second"),
                ClashApiKeyPool.parseConfiguredKeys(
                        "",
                        List.of("first", "Bearer second", "first", "")
                )
        );
    }

    @Test
    void rejectsMalformedOrOversizedConfigurationWithoutEchoingSecrets() {
        IllegalStateException malformed = assertThrows(
                IllegalStateException.class,
                () -> ClashApiKeyPool.parseConfiguredKeys(
                        "[\"do-not-echo\",}", List.of()
                )
        );
        assertFalse(malformed.getMessage().contains("do-not-echo"));
        assertThrows(
                IllegalStateException.class,
                () -> ClashApiKeyPool.parseConfiguredKeys(
                        "[\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\",\"8\",\"9\",\"10\",\"11\"]",
                        List.of()
                )
        );
        assertThrows(
                IllegalStateException.class,
                () -> ClashApiKeyPool.parseConfiguredKeys("[\"has whitespace\"]", List.of())
        );
    }

    @Test
    void rotatesKeysAndSharesCooldownState() throws Exception {
        AtomicLong clock = new AtomicLong(1_000L);
        ClashApiKeyPool pool = new ClashApiKeyPool(
                List.of("first", "second"), clock::get
        );
        ClashApiKeyPool.Lease first = pool.acquire(Set.of());
        pool.markRateLimited(first, 5_000L);

        assertEquals("Bearer first", first.authorizationValue());
        assertEquals("Bearer second", pool.acquire(Set.of()).authorizationValue());
        assertEquals(1, pool.usableCount());

        clock.addAndGet(5_001L);
        assertEquals(2, pool.usableCount());
    }

    @Test
    void invalidKeysStayDisabledAndEmptyPoolsFailPredictably() throws Exception {
        ClashApiKeyPool pool = new ClashApiKeyPool(List.of("only"), () -> 1_000L);
        ClashApiKeyPool.Lease lease = pool.acquire(Set.of());
        pool.markInvalid(lease);

        assertEquals(0, pool.usableCount());
        assertThrows(
                ClashApiKeyPool.UnavailableException.class,
                () -> pool.acquire(Set.of())
        );
        assertThrows(
                ClashApiKeyPool.UnavailableException.class,
                () -> new ClashApiKeyPool(List.of(), () -> 1_000L).acquire(Set.of())
        );
    }

    @Test
    void concurrentSelectionRemainsSafeAndUsesEveryKey() throws Exception {
        ClashApiKeyPool pool = new ClashApiKeyPool(
                List.of("first", "second", "third"),
                System::currentTimeMillis
        );
        Set<String> selected = ConcurrentHashMap.newKeySet();
        try (var executor = Executors.newFixedThreadPool(12)) {
            for (int index = 0; index < 240; index++) {
                executor.submit(() -> selected.add(
                        pool.acquire(Set.of()).authorizationValue()
                ));
            }
            executor.shutdown();
            assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS));
        }

        assertEquals(
                Set.of("Bearer first", "Bearer second", "Bearer third"),
                selected
        );
    }
}
