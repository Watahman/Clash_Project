package Java.advancedstats;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Merges daily trend points while preserving reliable loot semantics. */
final class AdvancedStatsCompactReadTrendMerger {
    private record LootField(String total, String average, String averageAlias,
                             String best, String bestAlias) {}

    private static final List<LootField> LOOT_FIELDS = List.of(
            new LootField("goldLooted", "averageGoldLooted", "goldLootAverage",
                    "bestGoldLooted", "goldLootBest"),
            new LootField("elixirLooted", "averageElixirLooted", "elixirLootAverage",
                    "bestElixirLooted", "elixirLootBest"),
            new LootField("darkElixirLooted", "averageDarkElixirLooted", "darkElixirLootAverage",
                    "bestDarkElixirLooted", "darkElixirLootBest")
    );

    void merge(Map<String, JsonObject> merged, JsonElement value) {
        if (!value.isJsonObject()) return;
        JsonObject incoming = normalize(value.getAsJsonObject());
        String date = text(incoming, "date");
        if (date.isBlank()) return;
        JsonObject current = merged.get(date);
        if (current == null) {
            merged.put(date, incoming);
            return;
        }
        long oldAttacks = number(current, "attacks");
        long newAttacks = number(incoming, "attacks");
        current.addProperty("attacks", oldAttacks + newAttacks);
        current.addProperty("averageStars", weighted(current, incoming, "averageStars", oldAttacks, newAttacks));
        current.addProperty("averageDestruction",
                weighted(current, incoming, "averageDestruction", oldAttacks, newAttacks));
        current.addProperty("threeStarRate", weighted(current, incoming, "threeStarRate", oldAttacks, newAttacks));
        mergeLoot(current, incoming);
    }

    private JsonObject normalize(JsonObject source) {
        JsonObject result = source.deepCopy();
        Long count = optionalLong(result, "lootAttackCount", "lootKnownAttackCount");
        if (count == null || count < 0) {
            clearLoot(result);
            return result;
        }
        addLong(result, "lootAttackCount", count);
        if (result.has("lootKnownAttackCount")) addLong(result, "lootKnownAttackCount", count);
        for (LootField field : LOOT_FIELDS) {
            Long total = valid(optionalLong(result, field.total()));
            Long best = valid(optionalLong(result, field.best(), field.bestAlias()));
            if (count == 0) {
                total = null;
                best = null;
            }
            writeLoot(result, field, total, total == null ? null : rounded((double) total / count), best);
        }
        return result;
    }

    private void mergeLoot(JsonObject current, JsonObject incoming) {
        Long oldCount = optionalLong(current, "lootAttackCount");
        Long newCount = optionalLong(incoming, "lootAttackCount");
        if (oldCount == null || newCount == null || oldCount < 0 || newCount < 0) {
            clearLoot(current);
            return;
        }
        long count = oldCount + newCount;
        addLong(current, "lootAttackCount", count);
        if (current.has("lootKnownAttackCount")) addLong(current, "lootKnownAttackCount", count);
        for (LootField field : LOOT_FIELDS) {
            Long total = combine(optionalLong(current, field.total()), optionalLong(incoming, field.total()),
                    oldCount, newCount, false);
            Long best = combine(optionalLong(current, field.best()), optionalLong(incoming, field.best()),
                    oldCount, newCount, true);
            writeLoot(current, field, total, total == null || count == 0 ? null : rounded((double) total / count), best);
        }
    }

    private void writeLoot(JsonObject target, LootField field, Long total, Double average, Long best) {
        addLong(target, field.total(), total);
        addDecimal(target, field.average(), average);
        addLong(target, field.best(), best);
        if (target.has(field.averageAlias())) addDecimal(target, field.averageAlias(), average);
        if (target.has(field.bestAlias())) addLong(target, field.bestAlias(), best);
    }

    private void clearLoot(JsonObject target) {
        addLong(target, "lootAttackCount", null);
        if (target.has("lootKnownAttackCount")) addLong(target, "lootKnownAttackCount", null);
        for (LootField field : LOOT_FIELDS) writeLoot(target, field, null, null, null);
    }

    private Long combine(Long left, Long right, long leftCount, long rightCount, boolean maximum) {
        if (leftCount == 0 && rightCount == 0) return null;
        if (leftCount == 0) return right;
        if (rightCount == 0) return left;
        if (left == null || right == null) return null;
        return maximum ? Math.max(left, right) : left + right;
    }

    private Long valid(Long value) {
        return value == null || value < 0 ? null : value;
    }

    private Long optionalLong(JsonObject source, String field) {
        if (source == null || !source.has(field) || source.get(field).isJsonNull()) return null;
        try {
            return source.get(field).getAsLong();
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private Long optionalLong(JsonObject source, String field, String alias) {
        return source != null && source.has(field) ? optionalLong(source, field) : optionalLong(source, alias);
    }

    private long number(JsonObject source, String field) {
        if (source == null || !source.has(field) || source.get(field).isJsonNull()) return 0;
        try {
            return source.get(field).getAsLong();
        } catch (RuntimeException ignored) {
            return 0;
        }
    }

    private double decimal(JsonObject source, String field) {
        if (source == null || !source.has(field) || source.get(field).isJsonNull()) return 0;
        try {
            return source.get(field).getAsDouble();
        } catch (RuntimeException ignored) {
            return 0;
        }
    }

    private String text(JsonObject source, String field) {
        if (source == null || !source.has(field) || source.get(field).isJsonNull()) return "";
        try {
            return source.get(field).getAsString();
        } catch (RuntimeException ignored) {
            return "";
        }
    }

    private double weighted(JsonObject current, JsonObject incoming, String field,
                            long oldCount, long newCount) {
        long total = oldCount + newCount;
        if (total == 0) return 0;
        return rounded((decimal(current, field) * oldCount + decimal(incoming, field) * newCount) / total);
    }

    private double rounded(double value) {
        return Math.round(value * 100d) / 100d;
    }

    private void addLong(JsonObject target, String field, Long value) {
        AdvancedStatsCompactReadAggregator.addNullableLong(target, field, value);
    }

    private void addDecimal(JsonObject target, String field, Double value) {
        AdvancedStatsCompactReadAggregator.addNullableDecimal(target, field, value);
    }
}
