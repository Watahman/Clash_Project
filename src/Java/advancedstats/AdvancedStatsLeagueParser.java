package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.AttackObservation;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;
import Java.advancedstats.AdvancedStatsHistoryModels.UnitObservation;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.array;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.instant;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.integer;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.percentage;

/** Validates and aggregates offensive rows without inventing missing metrics. */
public final class AdvancedStatsLeagueParser {
    private static final UUID TRANSIENT_TRACKING_ID =
            UUID.fromString("00000000-0000-0000-0000-000000000000");

    private AdvancedStatsLeagueParser() {}

    public static AdvancedStatsLeagueModels.ParsedAttacks ranked(
            JsonObject response, String seasonId, String playerTag, Instant requestedAt
    ) {
        JsonObject normalized = ClashKingV2AdvancedStatsRoutes.normalizeRanked(response);
        return parse(array(normalized, "attacks"), "ranked", seasonId, "", playerTag, requestedAt);
    }

    public static AdvancedStatsLeagueModels.ParsedAttacks legend(
            JsonObject response, String seasonId, String day, String playerTag, Instant requestedAt
    ) {
        return parse(array(response, "attacks"), "legend", seasonId, day, playerTag, requestedAt);
    }

    public static JsonObject aggregate(List<AttackObservation> observations) {
        List<AttackObservation> rows = observations == null ? List.of() : List.copyOf(observations);
        JsonObject result = new JsonObject();
        int stars = rows.stream().mapToInt(AttackObservation::stars).sum();
        double destruction = rows.stream().mapToDouble(AttackObservation::destructionPercentage).sum();
        result.addProperty("attacks", rows.size());
        result.addProperty("sampleSize", rows.size());
        result.addProperty("stars", stars);
        result.addProperty("destruction", round(destruction));
        result.addProperty("starsPerAttack", average(stars, rows.size()));
        result.addProperty("averageDestruction", average(destruction, rows.size()));
        result.add("starDistribution", distribution(rows));
        result.add("army", army(rows));
        return result;
    }

    public static JsonObject coverage(AdvancedStatsLeagueModels.Coverage coverage) {
        JsonObject result = new JsonObject();
        result.addProperty("sourceRows", coverage.sourceRows());
        result.addProperty("validRows", coverage.validRows());
        result.addProperty("invalidRows", coverage.invalidRows());
        if (coverage.oldest() == null) result.add("oldest", com.google.gson.JsonNull.INSTANCE);
        else result.addProperty("oldest", coverage.oldest().toString());
        if (coverage.newest() == null) result.add("newest", com.google.gson.JsonNull.INSTANCE);
        else result.addProperty("newest", coverage.newest().toString());
        return result;
    }

    private static AdvancedStatsLeagueModels.ParsedAttacks parse(
            JsonArray rows, String type, String seasonId, String day,
            String playerTag, Instant requestedAt
    ) {
        Instant now = requestedAt == null ? Instant.now() : requestedAt;
        List<AttackObservation> observations = new ArrayList<>();
        int invalid = 0;
        for (JsonElement element : rows) {
            if (!element.isJsonObject() || !isScoredAttack(element.getAsJsonObject(), now)) {
                invalid++;
                continue;
            }
            AttackObservation observation = ClashKingV2AdvancedStatsParserMapping.leagueObservation(
                    element.getAsJsonObject(), type, seasonId, request(playerTag, now));
            if (observation.occurredAt() == null || observation.stars() == null
                    || observation.destructionPercentage() == null) invalid++;
            else observations.add(observation);
        }
        observations.sort(Comparator.comparing(AttackObservation::occurredAt));
        Instant oldest = observations.stream().map(AttackObservation::occurredAt)
                .min(Comparator.naturalOrder()).orElse(null);
        Instant newest = observations.stream().map(AttackObservation::occurredAt)
                .max(Comparator.naturalOrder()).orElse(null);
        return new AdvancedStatsLeagueModels.ParsedAttacks(
                observations,
                new AdvancedStatsLeagueModels.Coverage(rows.size(), observations.size(), invalid,
                        oldest, newest)
        );
    }

    private static boolean isScoredAttack(JsonObject row, Instant fallback) {
        Instant at = instant(row, null, "time", "battleTime", "timestamp", "date");
        Integer stars = integer(row, "stars");
        Double destruction = percentage(row, "destructionPercentage", "destruction_percentage", "destruction");
        return at != null && at.isBefore(fallback.plusSeconds(1))
                && ClashKingV2AdvancedStatsParserIdentity.isAttack(row, true)
                && stars != null && stars >= 0 && stars <= 3 && destruction != null;
    }

    private static HistoryRequest request(String playerTag, Instant requestedAt) {
        return new HistoryRequest(
                TRANSIENT_TRACKING_ID,
                playerTag,
                AdvancedStatsScope.RANKED,
                AdvancedStatsCapabilityOperation.BOOTSTRAP,
                AdvancedStatsHistoryModels.Checkpoint.initial(),
                500,
                requestedAt
        );
    }

    private static JsonObject distribution(List<AttackObservation> rows) {
        int[] counts = new int[4];
        for (AttackObservation row : rows) counts[row.stars()]++;
        JsonObject result = new JsonObject();
        for (int stars = 0; stars <= 3; stars++) result.addProperty(Integer.toString(stars), counts[stars]);
        return result;
    }

    private static JsonObject army(List<AttackObservation> rows) {
        JsonObject result = new JsonObject();
        if (rows.isEmpty()) {
            result.addProperty("status", "NO_DATA");
            result.addProperty("reason", "no_verified_attack_rows");
            result.add("items", new JsonArray());
            return result;
        }
        Map<String, Item> items = new HashMap<>();
        int rowsWithArmy = 0;
        for (AttackObservation row : rows) {
            if (!row.units().isEmpty()) rowsWithArmy++;
            for (UnitObservation unit : row.units()) {
                String key = unit.category().name() + ":" + unit.unitKey();
                Item item = items.computeIfAbsent(key,
                        ignored -> new Item(unit.unitKey(), unit.unitName(), unit.category().name()));
                item.attacks++;
                item.quantity += unit.quantity();
                item.stars += row.stars();
            }
        }
        if (items.isEmpty()) {
            result.addProperty("status", "UNAVAILABLE");
            result.addProperty("reason", "source_did_not_supply_verified_army_items");
            result.add("items", new JsonArray());
            return result;
        }
        result.addProperty("status", rowsWithArmy == rows.size() ? "COMPLETE" : "PARTIAL");
        result.addProperty("sampleSize", rowsWithArmy);
        JsonArray values = new JsonArray();
        items.values().stream().sorted(Comparator.comparing(Item::key)).forEach(item -> {
            JsonObject value = new JsonObject();
            value.addProperty("key", item.key());
            value.addProperty("name", item.name());
            value.addProperty("category", item.category());
            value.addProperty("attacks", item.attacks);
            value.addProperty("quantity", item.quantity);
            value.addProperty("averageStars", average(item.stars, item.attacks));
            values.add(value);
        });
        result.add("items", values);
        return result;
    }

    private static double average(double value, int count) {
        return count == 0 ? 0d : round(value / count);
    }

    private static double round(double value) {
        return Math.round(value * 100.0d) / 100.0d;
    }

    private static final class Item {
        private final String key;
        private final String name;
        private final String category;
        private int attacks;
        private long quantity;
        private int stars;

        private Item(String key, String name, String category) {
            this.key = key;
            this.name = name;
            this.category = category;
        }

        private String key() { return key; }
        private String name() { return name; }
        private String category() { return category; }
    }
}
