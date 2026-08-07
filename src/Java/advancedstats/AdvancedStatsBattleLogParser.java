package Java.advancedstats;

import Java.cache.CacheKeys;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Converts the upstream player battle-log JSON into stable ingestion candidates. */
public final class AdvancedStatsBattleLogParser {
    private static final List<DateTimeFormatter> CLASH_TIME_FORMATS = List.of(
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss.SSSX").withZone(ZoneOffset.UTC),
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmssX").withZone(ZoneOffset.UTC)
    );

    public List<AdvancedStatsModels.BattleCandidate> parse(
            String rawPlayerTag,
            String rawJson,
            Instant observedAt,
            Integer playerTownHall
    ) {
        String playerTag = CacheKeys.requireValidTag(rawPlayerTag);
        if (observedAt == null) throw new IllegalArgumentException("observedAt is required");

        JsonElement root = JsonParser.parseString(rawJson == null || rawJson.isBlank() ? "[]" : rawJson);
        JsonArray entries = battleEntries(root);
        List<AdvancedStatsModels.BattleCandidate> result = new ArrayList<>(entries.size());

        for (JsonElement entry : entries) {
            if (!entry.isJsonObject()) continue;
            JsonObject battle = entry.getAsJsonObject();
            boolean attack = booleanValue(battle, "attack", false);

            Loot loot = new Loot();
            addResources(loot, arrayValue(battle, "lootedResources"));
            addResources(loot, arrayValue(battle, "extraLootedResources"));

            result.add(new AdvancedStatsModels.BattleCandidate(
                    playerTag,
                    firstInstant(battle, "battleTime", "battleTimestamp", "timestamp", "endTime"),
                    observedAt,
                    attack,
                    stringValue(battle, "battleType"),
                    optionalTag(stringValue(battle, "opponentPlayerTag")),
                    stringValue(battle, "opponentName"),
                    integerValue(battle, "opponentTownHallLevel", "opponentTownHall"),
                    playerTownHall,
                    integerValue(battle, "stars"),
                    doubleValue(battle, "destructionPercentage"),
                    stringValue(battle, "armyShareCode"),
                    loot.gold,
                    loot.elixir,
                    loot.darkElixir
            ));
        }

        return List.copyOf(result);
    }

    private JsonArray battleEntries(JsonElement root) {
        if (root == null || root.isJsonNull()) return new JsonArray();
        if (root.isJsonArray()) return root.getAsJsonArray();
        if (root.isJsonObject()) {
            JsonObject object = root.getAsJsonObject();
            JsonElement items = object.get("items");
            if (items != null && items.isJsonArray()) return items.getAsJsonArray();
            JsonElement battles = object.get("battles");
            if (battles != null && battles.isJsonArray()) return battles.getAsJsonArray();
        }
        throw new IllegalArgumentException("Player battle log must be an array or contain an items array");
    }

    private void addResources(Loot loot, JsonArray resources) {
        for (JsonElement element : resources) {
            if (!element.isJsonObject()) continue;
            JsonObject resource = element.getAsJsonObject();
            String name = firstNonBlank(
                    stringValue(resource, "name"),
                    stringValue(resource, "resource"),
                    stringValue(resource, "type")
            ).toLowerCase(Locale.ROOT).replace(" ", "").replace("_", "");
            long amount = longValue(resource, "amount", "value", "count");
            if (amount <= 0) continue;

            if (name.contains("darkelixir")) loot.darkElixir = Math.addExact(loot.darkElixir, amount);
            else if (name.contains("elixir")) loot.elixir = Math.addExact(loot.elixir, amount);
            else if (name.contains("gold")) loot.gold = Math.addExact(loot.gold, amount);
        }
    }

    private Instant firstInstant(JsonObject object, String... fields) {
        for (String field : fields) {
            String raw = stringValue(object, field);
            if (raw.isBlank()) continue;
            Instant parsed = parseInstant(raw);
            if (parsed != null) return parsed;
        }
        return null;
    }

    private Instant parseInstant(String raw) {
        try {
            return Instant.parse(raw);
        } catch (DateTimeParseException ignored) {
            // Continue with Clash compact formats.
        }
        try {
            return OffsetDateTime.parse(raw).toInstant();
        } catch (DateTimeParseException ignored) {
            // Continue with Clash compact formats.
        }
        for (DateTimeFormatter formatter : CLASH_TIME_FORMATS) {
            try {
                return Instant.from(formatter.parse(raw));
            } catch (DateTimeParseException ignored) {
                // Try the next format.
            }
        }
        return null;
    }

    private JsonArray arrayValue(JsonObject object, String field) {
        JsonElement value = object.get(field);
        return value != null && value.isJsonArray() ? value.getAsJsonArray() : new JsonArray();
    }

    private boolean booleanValue(JsonObject object, String field, boolean fallback) {
        JsonElement value = object.get(field);
        if (value == null || value.isJsonNull() || !value.isJsonPrimitive()) return fallback;
        try {
            return value.getAsBoolean();
        } catch (RuntimeException ignored) {
            return fallback;
        }
    }

    private String stringValue(JsonObject object, String field) {
        JsonElement value = object.get(field);
        if (value == null || value.isJsonNull() || !value.isJsonPrimitive()) return "";
        try {
            return value.getAsString().trim();
        } catch (RuntimeException ignored) {
            return "";
        }
    }

    private Integer integerValue(JsonObject object, String... fields) {
        for (String field : fields) {
            JsonElement value = object.get(field);
            if (value == null || value.isJsonNull() || !value.isJsonPrimitive()) continue;
            try {
                return value.getAsInt();
            } catch (RuntimeException ignored) {
                // Try the next alias.
            }
        }
        return null;
    }

    private Double doubleValue(JsonObject object, String field) {
        JsonElement value = object.get(field);
        if (value == null || value.isJsonNull() || !value.isJsonPrimitive()) return null;
        try {
            return value.getAsDouble();
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private long longValue(JsonObject object, String... fields) {
        for (String field : fields) {
            JsonElement value = object.get(field);
            if (value == null || value.isJsonNull() || !value.isJsonPrimitive()) continue;
            try {
                return Math.max(0L, value.getAsLong());
            } catch (RuntimeException ignored) {
                // Try the next alias.
            }
        }
        return 0L;
    }

    private String optionalTag(String raw) {
        if (raw == null || raw.isBlank()) return "";
        try {
            return CacheKeys.requireValidTag(raw);
        } catch (IllegalArgumentException invalidUpstreamTag) {
            return "";
        }
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return "";
    }

    private static final class Loot {
        private long gold;
        private long elixir;
        private long darkElixir;
    }
}
