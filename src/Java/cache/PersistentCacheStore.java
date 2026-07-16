package Java.cache;

import Java.SUPABASE_Client;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

public final class PersistentCacheStore implements CacheStore {
    private static final AtomicInteger WRITES = new AtomicInteger();

    @Override
    public CacheEntry get(String key) {
        try {
            String response = SUPABASE_Client.getWithBody(
                    "api_cache",
                    "select=payload,fetched_at,fresh_until,stale_until,source_status"
                            + "&cache_key=" + SUPABASE_Client.eq(key)
                            + "&limit=1"
            );
            JsonArray rows = JsonParser.parseString(response).getAsJsonArray();
            if (rows.isEmpty()) return null;
            JsonObject row = rows.get(0).getAsJsonObject();
            CacheEntry entry = new CacheEntry(
                    row.get("payload").toString(),
                    Instant.parse(row.get("fetched_at").getAsString()).toEpochMilli(),
                    Instant.parse(row.get("fresh_until").getAsString()).toEpochMilli(),
                    Instant.parse(row.get("stale_until").getAsString()).toEpochMilli(),
                    row.has("source_status") ? row.get("source_status").getAsInt() : 200
            );
            if (!entry.isUsable()) {
                invalidate(key);
                return null;
            }
            return entry;
        } catch (Exception cacheFailure) {
            return null;
        }
    }

    @Override
    public void put(String key, CacheEntry entry) {
        try {
            JsonObject row = new JsonObject();
            row.addProperty("cache_key", key);
            row.addProperty("entity_type", entityType(key));
            row.addProperty("entity_id", entityId(key));
            row.add("payload", parsePayload(entry.value()));
            row.addProperty("fetched_at", Instant.ofEpochMilli(entry.fetchedAt()).toString());
            row.addProperty("fresh_until", Instant.ofEpochMilli(entry.freshUntil()).toString());
            row.addProperty("stale_until", Instant.ofEpochMilli(entry.staleUntil()).toString());
            row.addProperty("source_status", entry.sourceStatus());
            row.addProperty("schema_version", 1);
            SUPABASE_Client.upsert("api_cache", "cache_key", row.toString());
            if (WRITES.incrementAndGet() % 100 == 0) cleanupExpired();
        } catch (Exception cacheFailure) {
            // L2 is an optimization. A cache outage must not break Clash requests.
        }
    }

    @Override
    public void invalidate(String key) {
        try {
            SUPABASE_Client.deleteColumn("api_cache", "cache_key=" + SUPABASE_Client.eq(key));
        } catch (Exception cacheFailure) {
            // Best effort.
        }
    }

    @Override
    public void invalidatePrefix(String prefix) {
        try {
            SUPABASE_Client.deleteColumn("api_cache", "cache_key=like." + encodeLikePrefix(prefix));
        } catch (Exception cacheFailure) {
            // Best effort.
        }
    }

    private void cleanupExpired() {
        try {
            SUPABASE_Client.deleteColumn("api_cache", "stale_until=lt." + Instant.now());
        } catch (Exception cacheFailure) {
            // Best effort.
        }
    }

    private JsonElement parsePayload(String value) {
        try {
            return JsonParser.parseString(value);
        } catch (RuntimeException invalidJson) {
            return JsonParser.parseString("{\"error\":\"Ongeldige gecachete payload\"}");
        }
    }

    private String entityType(String key) {
        return key.startsWith("clash:get:") ? "clash_api" : "generic";
    }

    private String entityId(String key) {
        int separator = key.lastIndexOf(':');
        return separator >= 0 ? key.substring(separator + 1) : key;
    }

    private String encodeLikePrefix(String prefix) {
        return java.net.URLEncoder.encode(prefix + "*", java.nio.charset.StandardCharsets.UTF_8);
    }
}
