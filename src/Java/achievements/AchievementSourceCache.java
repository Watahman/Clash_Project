package Java.achievements;

import Java.SUPABASE_Client;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

public final class AchievementSourceCache {
    public record RecordState(
            String recordKey,
            JsonObject metrics,
            JsonObject metadata
    ) {}

    public Map<String, RecordState> records(
            String userId,
            String playerTag,
            String source,
            String sourceKey
    ) throws Exception {
        String response = SUPABASE_Client.getWithBody(
                "achievement_source_records",
                "select=record_key,metrics,metadata"
                        + "&user_id=" + SUPABASE_Client.eq(userId)
                        + "&player_tag=" + SUPABASE_Client.eq(playerTag)
                        + "&source=" + SUPABASE_Client.eq(source)
                        + "&source_key=" + SUPABASE_Client.eq(sourceKey)
        );
        JsonArray rows = JsonParser.parseString(response).getAsJsonArray();
        Map<String, RecordState> result = new LinkedHashMap<>();
        for (JsonElement element : rows) {
            if (!element.isJsonObject()) continue;
            JsonObject row = element.getAsJsonObject();
            String key = string(row, "record_key");
            if (key.isBlank()) continue;
            result.put(key, new RecordState(
                    key,
                    object(row.get("metrics")),
                    object(row.get("metadata"))
            ));
        }
        return Map.copyOf(result);
    }

    public Set<String> recordKeys(
            String userId,
            String playerTag,
            String source,
            String sourceKey
    ) throws Exception {
        return new LinkedHashSet<>(records(userId, playerTag, source, sourceKey).keySet());
    }

    public void upsertRecord(
            String userId,
            String playerTag,
            String source,
            String sourceKey,
            String recordKey,
            Instant recordTimestamp,
            Map<String, Long> metrics,
            JsonObject metadata
    ) throws Exception {
        JsonObject row = new JsonObject();
        row.addProperty("user_id", userId);
        row.addProperty("player_tag", playerTag);
        row.addProperty("source", source);
        row.addProperty("source_key", sourceKey == null ? "" : sourceKey);
        row.addProperty("record_key", recordKey);
        if (recordTimestamp != null) row.addProperty("record_timestamp", recordTimestamp.toString());
        row.add("metrics", metricsJson(metrics));
        row.add("metadata", metadata == null ? new JsonObject() : metadata);
        row.addProperty("updated_at", Instant.now().toString());

        JsonArray body = new JsonArray();
        body.add(row);
        SUPABASE_Client.upsert(
                "achievement_source_records",
                "user_id,player_tag,source,source_key,record_key",
                body.toString()
        );
    }

    public void markChecked(
            String userId,
            String playerTag,
            String source,
            String sourceKey,
            JsonObject cursor,
            JsonObject coverage,
            String errorCode
    ) throws Exception {
        JsonObject row = new JsonObject();
        row.addProperty("user_id", userId);
        row.addProperty("player_tag", playerTag);
        row.addProperty("source", source);
        row.addProperty("source_key", sourceKey == null ? "" : sourceKey);
        row.add("cursor", cursor == null ? new JsonObject() : cursor);
        row.add("coverage", coverage == null ? new JsonObject() : coverage);
        String now = Instant.now().toString();
        row.addProperty("last_checked_at", now);
        if (errorCode == null || errorCode.isBlank()) {
            row.addProperty("last_success_at", now);
            row.add("last_error_code", com.google.gson.JsonNull.INSTANCE);
        } else {
            row.addProperty("last_error_code", errorCode);
        }
        row.addProperty("updated_at", now);

        JsonArray body = new JsonArray();
        body.add(row);
        SUPABASE_Client.upsert(
                "achievement_source_state",
                "user_id,player_tag,source,source_key",
                body.toString()
        );
    }

    public Map<String, Long> aggregateMetrics(String userId, String playerTag) throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("p_user_id", userId);
        body.addProperty("p_player_tag", playerTag);
        JsonElement parsed = JsonParser.parseString(
                SUPABASE_Client.rpc("read_achievement_source_metrics_v1", body.toString())
        );
        JsonObject metrics = parsed != null && parsed.isJsonObject()
                ? parsed.getAsJsonObject()
                : new JsonObject();
        Map<String, Long> result = new LinkedHashMap<>();
        for (Map.Entry<String, JsonElement> entry : metrics.entrySet()) {
            JsonElement value = entry.getValue();
            if (value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isNumber()) {
                result.put(entry.getKey(), Math.max(0L, value.getAsLong()));
            }
        }
        return Map.copyOf(result);
    }

    private static JsonObject metricsJson(Map<String, Long> metrics) {
        JsonObject result = new JsonObject();
        if (metrics != null) metrics.forEach((key, value) -> result.addProperty(key, Math.max(0L, value == null ? 0L : value)));
        return result;
    }

    private static JsonObject object(JsonElement value) {
        return value != null && value.isJsonObject() ? value.getAsJsonObject() : new JsonObject();
    }

    private static String string(JsonObject object, String field) {
        JsonElement value = object.get(field);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isString()
                ? value.getAsString()
                : "";
    }
}
