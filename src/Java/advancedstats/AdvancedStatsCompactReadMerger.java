package Java.advancedstats;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Combines scope aggregates without reintroducing raw attack history into the read path. */
final class AdvancedStatsCompactReadMerger {
    JsonObject overview(List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> snapshots) {
        List<JsonObject> units = mergeUnits(snapshots);
        List<JsonObject> armies = mergeArmies(snapshots);
        JsonObject result = new JsonObject();
        result.addProperty("scope", "ALL");
        result.addProperty("granularity", "UTC_DAY");
        result.add("tracking", mergedTracking(snapshots));
        result.add("summary", mergedSummary(snapshots));
        result.add("favorites", favorites(units, armies));
        return result;
    }

    JsonArray units(List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> snapshots) {
        JsonArray result = new JsonArray();
        for (JsonObject item : mergeUnits(snapshots)) result.add(item);
        return result;
    }

    JsonArray armies(List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> snapshots, int limit) {
        JsonArray result = new JsonArray();
        List<JsonObject> items = mergeArmies(snapshots);
        int bounded = Math.min(Math.max(limit, 1), 100);
        for (int i = 0; i < Math.min(items.size(), bounded); i++) result.add(items.get(i));
        return result;
    }

    JsonArray trends(List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> snapshots) {
        Map<String, JsonObject> merged = new LinkedHashMap<>();
        for (AdvancedStatsCompactReadAggregator.ScopeSnapshot snapshot : snapshots) {
            if (snapshot.trends() == null) continue;
            for (JsonElement value : snapshot.trends()) mergeTrend(merged, value);
        }
        List<JsonObject> items = new ArrayList<>(merged.values());
        items.sort(Comparator.comparing(item -> text(item, "date")));
        JsonArray result = new JsonArray();
        for (JsonObject item : items) result.add(item);
        return result;
    }

    private JsonObject mergedTracking(List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> snapshots) {
        JsonObject tracking = new JsonObject();
        JsonArray scopes = new JsonArray();
        for (AdvancedStatsCompactReadAggregator.ScopeSnapshot snapshot : snapshots) {
            JsonObject source = object(snapshot.overview(), "tracking");
            if (tracking.size() == 0 && source != null) tracking = source.deepCopy();
            JsonObject scope = new JsonObject();
            scope.addProperty("scope", snapshot.scope().apiValue());
            scope.add("tracking", source == null ? JsonNull.INSTANCE : source.deepCopy());
            JsonObject summary = object(snapshot.overview(), "summary");
            scope.add("summary", summary == null ? JsonNull.INSTANCE : summary.deepCopy());
            scopes.add(scope);
        }
        tracking.addProperty("scope", "ALL");
        tracking.add("scopes", scopes);
        return tracking;
    }

    private JsonObject mergedSummary(List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> snapshots) {
        long attacks = 0;
        long gold = 0;
        long elixir = 0;
        long darkElixir = 0;
        double stars = 0;
        double destruction = 0;
        double threeStars = 0;
        for (AdvancedStatsCompactReadAggregator.ScopeSnapshot snapshot : snapshots) {
            JsonObject summary = object(snapshot.overview(), "summary");
            if (summary == null) continue;
            long count = number(summary, "attacks");
            attacks += count;
            stars += decimal(summary, "averageStars") * count;
            destruction += decimal(summary, "averageDestruction") * count;
            threeStars += decimal(summary, "threeStarRate") * count;
            gold += number(summary, "goldLooted");
            elixir += number(summary, "elixirLooted");
            darkElixir += number(summary, "darkElixirLooted");
        }
        JsonObject result = new JsonObject();
        result.addProperty("attacks", attacks);
        result.addProperty("averageStars", rounded(attacks == 0 ? 0 : stars / attacks));
        result.addProperty("averageDestruction", rounded(attacks == 0 ? 0 : destruction / attacks));
        result.addProperty("threeStarRate", rounded(attacks == 0 ? 0 : threeStars / attacks));
        result.addProperty("goldLooted", gold);
        result.addProperty("elixirLooted", elixir);
        result.addProperty("darkElixirLooted", darkElixir);
        return result;
    }

    private JsonObject favorites(List<JsonObject> units, List<JsonObject> armies) {
        JsonObject result = new JsonObject();
        result.add("troop", favoriteUnit(units, "TROOP", "SUPER_TROOP"));
        result.add("spell", favoriteUnit(units, "SPELL"));
        result.add("siege", favoriteUnit(units, "SIEGE"));
        result.add("army", armies.isEmpty() ? JsonNull.INSTANCE : armies.get(0).deepCopy());
        return result;
    }

    private JsonElement favoriteUnit(List<JsonObject> units, String... categories) {
        List<String> accepted = List.of(categories);
        return units.stream()
                .filter(item -> accepted.contains(text(item, "category")))
                .min(Comparator.comparingLong((JsonObject item) -> number(item, "totalQuantity"))
                        .reversed()
                        .thenComparing(Comparator.comparingLong(
                                (JsonObject item) -> number(item, "battlesPresent")).reversed())
                        .thenComparing(item -> text(item, "key")))
                .map(item -> (JsonElement) item.deepCopy())
                .orElse(JsonNull.INSTANCE);
    }

    private List<JsonObject> mergeUnits(List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> snapshots) {
        Map<String, JsonObject> merged = new LinkedHashMap<>();
        long attacks = totalAttacks(snapshots);
        for (AdvancedStatsCompactReadAggregator.ScopeSnapshot snapshot : snapshots) {
            if (snapshot.units() == null) continue;
            for (JsonElement value : snapshot.units()) {
                if (!value.isJsonObject()) continue;
                JsonObject incoming = value.getAsJsonObject();
                String identity = text(incoming, "key") + "\u0000" + text(incoming, "category");
                JsonObject item = merged.get(identity);
                if (item == null) {
                    item = incoming.deepCopy();
                    merged.put(identity, item);
                } else {
                    item.addProperty("totalQuantity", number(item, "totalQuantity")
                            + number(incoming, "totalQuantity"));
                    item.addProperty("battlesPresent", number(item, "battlesPresent")
                            + number(incoming, "battlesPresent"));
                    item.addProperty("firstSeenAt", earliest(text(item, "firstSeenAt"), text(incoming, "firstSeenAt")));
                    item.addProperty("lastSeenAt", latest(text(item, "lastSeenAt"), text(incoming, "lastSeenAt")));
                }
                long present = number(item, "battlesPresent");
                item.addProperty("usageRate", rounded(attacks == 0 ? 0 : 100d * present / attacks));
            }
        }
        List<JsonObject> result = new ArrayList<>(merged.values());
        result.sort(Comparator.comparingLong((JsonObject item) -> number(item, "totalQuantity"))
                .reversed()
                .thenComparing(Comparator.comparingLong(
                        (JsonObject item) -> number(item, "battlesPresent")).reversed())
                .thenComparing(item -> text(item, "key")));
        return result;
    }

    private List<JsonObject> mergeArmies(List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> snapshots) {
        Map<String, JsonObject> merged = new LinkedHashMap<>();
        for (AdvancedStatsCompactReadAggregator.ScopeSnapshot snapshot : snapshots) {
            if (snapshot.armies() == null) continue;
            for (JsonElement value : snapshot.armies()) {
                if (!value.isJsonObject()) continue;
                JsonObject incoming = value.getAsJsonObject();
                String identity = text(incoming, "armyHash");
                if (identity.isBlank()) continue;
                JsonObject item = merged.get(identity);
                if (item == null) {
                    merged.put(identity, incoming.deepCopy());
                    continue;
                }
                long oldCount = number(item, "battleCount");
                long newCount = number(incoming, "battleCount");
                item.addProperty("battleCount", oldCount + newCount);
                item.addProperty("averageStars", weighted(item, incoming, "averageStars", oldCount, newCount));
                item.addProperty("averageDestruction",
                        weighted(item, incoming, "averageDestruction", oldCount, newCount));
                item.addProperty("firstSeenAt", earliest(text(item, "firstSeenAt"), text(incoming, "firstSeenAt")));
                item.addProperty("lastSeenAt", latest(text(item, "lastSeenAt"), text(incoming, "lastSeenAt")));
            }
        }
        List<JsonObject> result = new ArrayList<>(merged.values());
        result.sort(Comparator.comparingLong((JsonObject item) -> number(item, "battleCount"))
                .reversed()
                .thenComparing(item -> text(item, "armyHash")));
        return result;
    }

    private void mergeTrend(Map<String, JsonObject> merged, JsonElement value) {
        if (!value.isJsonObject()) return;
        JsonObject incoming = value.getAsJsonObject();
        String date = text(incoming, "date");
        if (date.isBlank()) return;
        JsonObject item = merged.get(date);
        if (item == null) {
            merged.put(date, incoming.deepCopy());
            return;
        }
        long oldCount = number(item, "attacks");
        long newCount = number(incoming, "attacks");
        item.addProperty("attacks", oldCount + newCount);
        item.addProperty("averageStars", weighted(item, incoming, "averageStars", oldCount, newCount));
        item.addProperty("averageDestruction",
                weighted(item, incoming, "averageDestruction", oldCount, newCount));
        item.addProperty("threeStarRate", weighted(item, incoming, "threeStarRate", oldCount, newCount));
        item.addProperty("goldLooted", number(item, "goldLooted") + number(incoming, "goldLooted"));
        item.addProperty("elixirLooted", number(item, "elixirLooted") + number(incoming, "elixirLooted"));
        item.addProperty("darkElixirLooted", number(item, "darkElixirLooted") + number(incoming, "darkElixirLooted"));
    }

    private long totalAttacks(List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> snapshots) {
        long total = 0;
        for (AdvancedStatsCompactReadAggregator.ScopeSnapshot snapshot : snapshots) {
            JsonObject summary = object(snapshot.overview(), "summary");
            if (summary != null) total += number(summary, "attacks");
        }
        return total;
    }

    private double weighted(JsonObject current, JsonObject incoming, String field, long oldCount, long newCount) {
        long total = oldCount + newCount;
        if (total == 0) return 0;
        return rounded((decimal(current, field) * oldCount + decimal(incoming, field) * newCount) / total);
    }

    private JsonObject object(JsonObject source, String field) {
        if (source == null || !source.has(field) || !source.get(field).isJsonObject()) return null;
        return source.getAsJsonObject(field);
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

    private String earliest(String left, String right) {
        if (left.isBlank()) return right;
        if (right.isBlank()) return left;
        return left.compareTo(right) <= 0 ? left : right;
    }

    private String latest(String left, String right) {
        if (left.isBlank()) return right;
        if (right.isBlank()) return left;
        return left.compareTo(right) >= 0 ? left : right;
    }

    private double rounded(double value) {
        return Math.round(value * 100d) / 100d;
    }
}
