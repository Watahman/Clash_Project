package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Converts ClashKing raid-history responses into one compact record per weekend. */
public final class RaidHistoryNormalizer {
    private static final DateTimeFormatter CLASH_TIME = DateTimeFormatter
            .ofPattern("yyyyMMdd'T'HHmmss.SSSX", Locale.ROOT);

    private RaidHistoryNormalizer() {}

    public static History normalize(JsonObject response, String playerTag, Instant fetchedAt) {
        JsonArray items = array(response == null ? null : response.get("items"));
        String requestedTag = normalizedTag(playerTag);
        Instant checkedAt = fetchedAt == null ? Instant.now() : fetchedAt;
        int missingPlayerRecords = 0;
        int invalidTimestampRecords = 0;
        int duplicateRecords = 0;
        int nonFinalRecords = 0;
        Map<String, WeekendRecord> unique = new LinkedHashMap<>();

        for (JsonElement element : items) {
            if (!element.isJsonObject()) continue;
            JsonObject weekend = element.getAsJsonObject();
            Instant startTime = instant(weekend, "startTime");
            Instant endTime = instant(weekend, "endTime");
            if (startTime == null && endTime == null) {
                invalidTimestampRecords++;
                continue;
            }

            JsonObject member = member(weekend, requestedTag);
            if (member == null) {
                missingPlayerRecords++;
                continue;
            }

            long attacks = nonNegativeLong(member, "attacks");
            long attackLimit = nonNegativeLong(member, "attackLimit");
            long bonusLimit = nonNegativeLong(member, "bonusAttackLimit");
            long loot = nonNegativeLong(member, "capitalResourcesLooted");
            long topLoot = highestMemberLoot(weekend);
            boolean bonusEarned = bonusLimit > 0;
            long availableAttacks = attackLimit + bonusLimit;
            boolean fullWeekend = availableAttacks > 0 && attacks >= availableAttacks;
            boolean topLooter = attacks >= 5 && loot > 0 && loot == topLoot;
            String state = string(weekend, "state");
            boolean finalState = "ended".equalsIgnoreCase(state);
            if (!finalState) {
                nonFinalRecords++;
                continue;
            }

            Map<String, Long> metrics = new LinkedHashMap<>();
            metrics.put("raid_weekends", 1L);
            metrics.put("raid_attacks", attacks);
            metrics.put("raid_loot", loot);
            metrics.put("raid_weekend_loot", loot);
            metrics.put("raid_full_weekends", fullWeekend ? 1L : 0L);
            metrics.put("raid_bonus_weekends", bonusEarned ? 1L : 0L);
            metrics.put("raid_top_looter_weekends", topLooter ? 1L : 0L);

            String recordKey = startTime != null ? startTime.toString() : endTime.toString();
            WeekendRecord record = new WeekendRecord(
                    recordKey,
                    startTime,
                    endTime,
                    finalState,
                    state,
                    normalizedTag(string(member, "tag")),
                    string(member, "name"),
                    Map.copyOf(metrics)
            );
            WeekendRecord existing = unique.get(recordKey);
            if (existing != null) {
                duplicateRecords++;
                record = better(existing, record);
            }
            unique.put(recordKey, record);
        }

        List<WeekendRecord> records = new ArrayList<>(unique.values());
        records.sort(Comparator.comparing(
                WeekendRecord::recordTimestamp,
                Comparator.nullsLast(Comparator.reverseOrder())
        ));
        long finalRecords = records.stream().filter(WeekendRecord::finalState).count();
        Instant oldest = records.stream().map(WeekendRecord::recordTimestamp)
                .filter(value -> value != null).min(Comparator.naturalOrder()).orElse(null);
        Instant newest = records.stream().map(WeekendRecord::recordTimestamp)
                .filter(value -> value != null).max(Comparator.naturalOrder()).orElse(null);
        Coverage coverage = new Coverage(
                items.size(),
                records.size(),
                missingPlayerRecords,
                invalidTimestampRecords,
                duplicateRecords,
                nonFinalRecords,
                Math.toIntExact(finalRecords),
                items.size() >= 100,
                oldest,
                newest,
                checkedAt
        );
        return new History(List.copyOf(records), coverage);
    }

    private static JsonObject member(JsonObject weekend, String requestedTag) {
        if (requestedTag.isBlank()) return null;
        for (JsonElement element : array(weekend.get("members"))) {
            if (!element.isJsonObject()) continue;
            JsonObject candidate = element.getAsJsonObject();
            if (requestedTag.equals(normalizedTag(string(candidate, "tag")))) return candidate;
        }
        return null;
    }

    private static long highestMemberLoot(JsonObject weekend) {
        long maximum = 0;
        for (JsonElement element : array(weekend.get("members"))) {
            if (!element.isJsonObject()) continue;
            maximum = Math.max(maximum, nonNegativeLong(
                    element.getAsJsonObject(), "capitalResourcesLooted"
            ));
        }
        return maximum;
    }

    private static WeekendRecord better(WeekendRecord left, WeekendRecord right) {
        if (right.finalState() != left.finalState()) return right.finalState() ? right : left;
        Instant leftTimestamp = left.recordTimestamp();
        Instant rightTimestamp = right.recordTimestamp();
        if (leftTimestamp != null && rightTimestamp != null && !leftTimestamp.equals(rightTimestamp)) {
            return rightTimestamp.isAfter(leftTimestamp) ? right : left;
        }
        long leftAttacks = left.metrics().getOrDefault("raid_attacks", 0L);
        long rightAttacks = right.metrics().getOrDefault("raid_attacks", 0L);
        if (leftAttacks != rightAttacks) return rightAttacks > leftAttacks ? right : left;
        long leftLoot = left.metrics().getOrDefault("raid_loot", 0L);
        long rightLoot = right.metrics().getOrDefault("raid_loot", 0L);
        return rightLoot > leftLoot ? right : left;
    }

    private static Instant instant(JsonObject object, String field) {
        String value = string(object, field);
        if (value.isBlank()) return null;
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException ignored) {
            try {
                return OffsetDateTime.parse(value, CLASH_TIME).toInstant();
            } catch (DateTimeParseException invalid) {
                return null;
            }
        }
    }

    private static String normalizedTag(String value) {
        if (value == null) return "";
        String result = value.trim().toUpperCase(Locale.ROOT);
        if (result.isBlank()) return "";
        return result.startsWith("#") ? result : "#" + result;
    }

    private static long nonNegativeLong(JsonObject object, String field) {
        JsonElement value = object == null ? null : object.get(field);
        if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isNumber()) return 0;
        try {
            return Math.max(0, value.getAsLong());
        } catch (RuntimeException ignored) {
            return 0;
        }
    }

    private static String string(JsonObject object, String field) {
        JsonElement value = object == null ? null : object.get(field);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isString()
                ? value.getAsString()
                : "";
    }

    private static JsonArray array(JsonElement value) {
        return value != null && value.isJsonArray() ? value.getAsJsonArray() : new JsonArray();
    }

    public record History(List<WeekendRecord> records, Coverage coverage) {}

    public record WeekendRecord(
            String recordKey,
            Instant startTime,
            Instant endTime,
            boolean finalState,
            String state,
            String playerTag,
            String playerName,
            Map<String, Long> metrics
    ) {
        public Instant recordTimestamp() {
            return endTime != null ? endTime : startTime;
        }

        public JsonObject metadata() {
            JsonObject result = new JsonObject();
            result.addProperty("final", finalState);
            result.addProperty("state", state);
            result.addProperty("playerPresent", true);
            result.addProperty("playerTag", playerTag);
            result.addProperty("playerName", playerName);
            if (startTime != null) result.addProperty("startTime", startTime.toString());
            if (endTime != null) result.addProperty("endTime", endTime.toString());
            return result;
        }
    }

    public record Coverage(
            int sourceRecords,
            int measurableRecords,
            int missingPlayerRecords,
            int invalidTimestampRecords,
            int duplicateRecords,
            int nonFinalRecords,
            int finalRecords,
            boolean limitReached,
            Instant oldestTimestamp,
            Instant newestTimestamp,
            Instant fetchedAt
    ) {
        public JsonObject metadata() {
            JsonObject result = new JsonObject();
            result.addProperty("availableRecords", sourceRecords);
            result.addProperty("measurableRecords", measurableRecords);
            result.addProperty("missingPlayerRecords", missingPlayerRecords);
            result.addProperty("invalidTimestampRecords", invalidTimestampRecords);
            result.addProperty("duplicateRecords", duplicateRecords);
            result.addProperty("nonFinalRecords", nonFinalRecords);
            result.addProperty("finalRecords", finalRecords);
            result.addProperty("limit", 100);
            result.addProperty("limitReached", limitReached);
            if (oldestTimestamp != null) result.addProperty("oldestTimestamp", oldestTimestamp.toString());
            if (newestTimestamp != null) result.addProperty("newestTimestamp", newestTimestamp.toString());
            result.addProperty("fetchedAt", fetchedAt.toString());
            return result;
        }
    }
}
