package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonParseException;
import com.google.gson.JsonParser;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;

/** Shared, concurrency-safe runtime state for official Clash API credentials. */
final class ClashApiKeyPool {
    static final int MAX_KEYS = 10;

    private final List<KeyState> keys;
    private final AtomicInteger cursor = new AtomicInteger();
    private final LongSupplier clock;

    static ClashApiKeyPool fromConfiguration(
            String serializedPool,
            List<String> legacyKeys
    ) {
        return new ClashApiKeyPool(
                parseConfiguredKeys(serializedPool, legacyKeys),
                System::currentTimeMillis
        );
    }

    ClashApiKeyPool(List<String> configuredKeys, LongSupplier clock) {
        this.keys = configuredKeys.stream().map(KeyState::new).toList();
        this.clock = clock;
    }

    Lease acquire(Set<Integer> excluded) throws UnavailableException {
        if (keys.isEmpty()) throw unavailable();
        Set<Integer> skipped = excluded == null ? Set.of() : excluded;
        int start = Math.floorMod(cursor.getAndIncrement(), keys.size());
        long now = clock.getAsLong();

        for (int offset = 0; offset < keys.size(); offset++) {
            int index = (start + offset) % keys.size();
            KeyState key = keys.get(index);
            if (!skipped.contains(index) && key.isUsable(now)) {
                return new Lease(index, key.authorizationValue());
            }
        }
        throw unavailable();
    }

    void markRateLimited(Lease lease, long cooldownMillis) {
        long until = clock.getAsLong() + Math.max(1L, cooldownMillis);
        keys.get(lease.index()).cooldownUntil().accumulateAndGet(until, Math::max);
    }

    void markInvalid(Lease lease) {
        keys.get(lease.index()).disabled().set(true);
    }

    int size() {
        return keys.size();
    }

    int usableCount() {
        long now = clock.getAsLong();
        return (int) keys.stream().filter(key -> key.isUsable(now)).count();
    }

    private UnavailableException unavailable() {
        long now = clock.getAsLong();
        long retryAfter = keys.stream()
                .filter(key -> !key.disabled().get())
                .mapToLong(key -> Math.max(0L, key.cooldownUntil().get() - now))
                .filter(delay -> delay > 0)
                .min()
                .orElse(0L);
        return new UnavailableException(retryAfter);
    }

    static List<String> parseConfiguredKeys(
            String serializedPool,
            List<String> legacyKeys
    ) {
        boolean hasPool = serializedPool != null && !serializedPool.isBlank();
        List<String> candidates = hasPool
                ? parseJsonPool(serializedPool)
                : legacyKeys == null ? List.of() : legacyKeys;
        Set<String> unique = new LinkedHashSet<>();
        for (String candidate : candidates) {
            String normalized = normalize(candidate, hasPool);
            if (!normalized.isBlank()) unique.add(normalized);
        }
        if (unique.size() > MAX_KEYS) {
            throw invalidConfiguration("meer dan tien unieke sleutels");
        }
        return List.copyOf(unique);
    }

    private static List<String> parseJsonPool(String serializedPool) {
        try {
            JsonElement parsed = JsonParser.parseString(serializedPool.trim());
            if (!parsed.isJsonArray()) throw invalidConfiguration("verwacht JSON-array");
            JsonArray array = parsed.getAsJsonArray();
            List<String> result = new ArrayList<>(array.size());
            for (JsonElement item : array) {
                if (!item.isJsonPrimitive() || !item.getAsJsonPrimitive().isString()) {
                    throw invalidConfiguration("alle items moeten tekst zijn");
                }
                result.add(item.getAsString());
            }
            return result;
        } catch (JsonParseException | IllegalStateException invalidJson) {
            throw invalidConfiguration("ongeldige JSON");
        }
    }

    private static String normalize(String value, boolean strict) {
        if (value == null || value.isBlank()) {
            if (strict) throw invalidConfiguration("lege sleutel");
            return "";
        }
        String key = value.trim();
        if (key.regionMatches(true, 0, "Bearer ", 0, 7)) {
            key = key.substring(7).trim();
        }
        if (key.isBlank() || key.length() > 4096 || containsWhitespace(key)) {
            throw invalidConfiguration("onbruikbare sleutel");
        }
        return key;
    }

    private static boolean containsWhitespace(String value) {
        for (int index = 0; index < value.length(); index++) {
            if (Character.isWhitespace(value.charAt(index))) return true;
        }
        return false;
    }

    private static IllegalStateException invalidConfiguration(String reason) {
        return new IllegalStateException(
                "Ongeldige CLASH_API_KEY_POOL-configuratie: " + reason
        );
    }

    record Lease(int index, String authorizationValue) {}

    static final class UnavailableException extends Exception {
        private final long retryAfterMillis;

        UnavailableException(long retryAfterMillis) {
            super("Geen bruikbare Clash API-sleutel beschikbaar");
            this.retryAfterMillis = retryAfterMillis;
        }

        long retryAfterMillis() {
            return retryAfterMillis;
        }
    }

    private record KeyState(
            String credential,
            AtomicLong cooldownUntil,
            AtomicBoolean disabled
    ) {
        KeyState(String credential) {
            this(credential, new AtomicLong(), new AtomicBoolean());
        }

        boolean isUsable(long now) {
            return !disabled.get() && cooldownUntil.get() <= now;
        }

        String authorizationValue() {
            return "Bearer " + credential;
        }
    }
}
