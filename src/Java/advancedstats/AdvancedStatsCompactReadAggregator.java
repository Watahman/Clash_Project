package Java.advancedstats;

import Java.HttpException;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Reads each compact scope and delegates shape-preserving aggregation to the merger. */
final class AdvancedStatsCompactReadAggregator {
    interface ScopeReader {
        JsonObject overview(UUID trackingId, AdvancedStatsScope scope, Instant from) throws Exception;

        JsonElement units(UUID trackingId, AdvancedStatsScope scope, Instant from,
                          AdvancedStatsUnitCategory category) throws Exception;

        JsonElement armies(UUID trackingId, AdvancedStatsScope scope, Instant from, int limit) throws Exception;

        JsonElement trends(UUID trackingId, AdvancedStatsScope scope, Instant from) throws Exception;
    }

    record ScopeSnapshot(
            AdvancedStatsScope scope,
            JsonObject overview,
            JsonArray units,
            JsonArray armies,
            JsonArray trends,
            List<ReadFailure> failures
    ) {
        ScopeSnapshot(AdvancedStatsScope scope, JsonObject overview, JsonArray units,
                      JsonArray armies, JsonArray trends) {
            this(scope, overview, units, armies, trends, List.of());
        }

        ScopeSnapshot {
            failures = failures == null ? List.of() : List.copyOf(failures);
        }
    }

    record ReadFailure(AdvancedStatsScope scope, String operation, String code) {}

    record LootTotals(
            Long attackCount,
            Long gold,
            Long elixir,
            Long darkElixir,
            Double averageGold,
            Double averageElixir,
            Double averageDarkElixir,
            Long bestGold,
            Long bestElixir,
            Long bestDarkElixir
    ) {}

    @FunctionalInterface
    private interface ReadCall<T> {
        T execute() throws Exception;
    }

    private final ScopeReader reader;
    private final AdvancedStatsCompactReadMerger merger;

    AdvancedStatsCompactReadAggregator(ScopeReader reader) {
        this.reader = reader;
        this.merger = new AdvancedStatsCompactReadMerger();
    }

    JsonObject overview(UUID trackingId, Instant from) throws Exception {
        return merger.overview(readOverviewSnapshots(trackingId, from));
    }

    JsonElement units(UUID trackingId, Instant from, AdvancedStatsUnitCategory category) throws Exception {
        return merger.units(readUnitSnapshots(trackingId, from, category));
    }

    JsonElement armies(UUID trackingId, Instant from, int limit) throws Exception {
        return merger.armies(readArmySnapshots(trackingId, from), limit);
    }

    JsonElement trends(UUID trackingId, Instant from) throws Exception {
        return merger.trends(readTrendSnapshots(trackingId, from));
    }

    private List<ScopeSnapshot> readOverviewSnapshots(UUID trackingId, Instant from) {
        List<ScopeSnapshot> snapshots = new ArrayList<>();
        for (AdvancedStatsScope scope : AdvancedStatsScope.values()) {
            snapshots.add(readOverviewSnapshot(trackingId, from, scope));
        }
        return snapshots;
    }

    private ScopeSnapshot readOverviewSnapshot(UUID trackingId, Instant from, AdvancedStatsScope scope) {
        List<ReadFailure> failures = new ArrayList<>();
        JsonObject overview = read(() -> reader.overview(trackingId, scope, from),
                scope, "overview", null, failures);
        JsonArray units = read(() -> asArray(reader.units(trackingId, scope, from, null), "units"),
                scope, "units", new JsonArray(), failures);
        JsonArray armies = read(() -> asArray(reader.armies(trackingId, scope, from, 100), "armies"),
                scope, "armies", new JsonArray(), failures);
        return new ScopeSnapshot(scope, overview, units, armies, null, failures);
    }

    private List<ScopeSnapshot> readUnitSnapshots(
            UUID trackingId,
            Instant from,
            AdvancedStatsUnitCategory category
    ) throws Exception {
        List<ScopeSnapshot> snapshots = new ArrayList<>();
        // Unit/army composition is only available for multiplayer history. War/CWL remains
        // part of the other Advanced Stats views, but must not dilute Unit Usage rates.
        for (AdvancedStatsScope scope : List.of(AdvancedStatsScope.NORMAL, AdvancedStatsScope.RANKED)) {
            JsonObject overview = reader.overview(trackingId, scope, from);
            JsonArray units = asArray(reader.units(trackingId, scope, from, category), "units");
            snapshots.add(new ScopeSnapshot(scope, overview, units, null, null));
        }
        return snapshots;
    }

    private List<ScopeSnapshot> readArmySnapshots(UUID trackingId, Instant from) throws Exception {
        List<ScopeSnapshot> snapshots = new ArrayList<>();
        for (AdvancedStatsScope scope : AdvancedStatsScope.values()) {
            JsonArray armies = asArray(reader.armies(trackingId, scope, from, 100), "armies");
            snapshots.add(new ScopeSnapshot(scope, null, null, armies, null));
        }
        return snapshots;
    }

    private List<ScopeSnapshot> readTrendSnapshots(UUID trackingId, Instant from) throws Exception {
        List<ScopeSnapshot> snapshots = new ArrayList<>();
        for (AdvancedStatsScope scope : AdvancedStatsScope.values()) {
            JsonArray trends = asArray(reader.trends(trackingId, scope, from), "trends");
            snapshots.add(new ScopeSnapshot(scope, null, null, null, trends));
        }
        return snapshots;
    }

    private <T> T read(ReadCall<T> call, AdvancedStatsScope scope, String operation,
                       T fallback, List<ReadFailure> failures) {
        try {
            return call.execute();
        } catch (Exception failure) {
            failures.add(new ReadFailure(scope, operation, failureCode(failure)));
            return fallback;
        }
    }

    private String failureCode(Exception failure) {
        if (failure instanceof HttpException http) {
            return switch (http.getStatusCode()) {
                case 408, 429, 500, 502, 503, 504 -> "UPSTREAM_UNAVAILABLE";
                case 404 -> "READ_FUNCTION_UNAVAILABLE";
                default -> "READ_FAILED";
            };
        }
        if (failure instanceof IllegalStateException) return "MALFORMED_RESPONSE";
        return "READ_FAILED";
    }

    static LootTotals lootTotals(List<ScopeSnapshot> snapshots) {
        long count = 0;
        Long gold = 0L;
        Long elixir = 0L;
        Long darkElixir = 0L;
        Long bestGold = 0L;
        Long bestElixir = 0L;
        Long bestDarkElixir = 0L;
        boolean complete = true;
        boolean goldKnown = true;
        boolean elixirKnown = true;
        boolean darkElixirKnown = true;
        boolean bestGoldKnown = true;
        boolean bestElixirKnown = true;
        boolean bestDarkElixirKnown = true;
        for (ScopeSnapshot snapshot : snapshots) {
            JsonObject summary = object(snapshot.overview(), "summary");
            if (summary == null) {
                complete = false;
                continue;
            }
            Long scopeCount = optionalLong(summary, "lootAttackCount");
            if (scopeCount == null || scopeCount < 0) {
                complete = false;
                continue;
            }
            count += scopeCount;
            if (scopeCount == 0) continue;
            Long scopeGold = optionalLong(summary, "goldLooted");
            Long scopeElixir = optionalLong(summary, "elixirLooted");
            Long scopeDarkElixir = optionalLong(summary, "darkElixirLooted");
            goldKnown &= scopeGold != null;
            elixirKnown &= scopeElixir != null;
            darkElixirKnown &= scopeDarkElixir != null;
            if (scopeGold != null) gold += scopeGold;
            if (scopeElixir != null) elixir += scopeElixir;
            if (scopeDarkElixir != null) darkElixir += scopeDarkElixir;
            Long scopeBestGold = optionalLong(summary, "bestGoldLooted");
            Long scopeBestElixir = optionalLong(summary, "bestElixirLooted");
            Long scopeBestDarkElixir = optionalLong(summary, "bestDarkElixirLooted");
            bestGoldKnown &= scopeBestGold != null;
            bestElixirKnown &= scopeBestElixir != null;
            bestDarkElixirKnown &= scopeBestDarkElixir != null;
            if (scopeBestGold != null) bestGold = Math.max(bestGold, scopeBestGold);
            if (scopeBestElixir != null) bestElixir = Math.max(bestElixir, scopeBestElixir);
            if (scopeBestDarkElixir != null) bestDarkElixir = Math.max(bestDarkElixir, scopeBestDarkElixir);
        }
        if (!complete) return unknownLoot();
        return new LootTotals(count,
                count == 0 || !goldKnown ? null : gold,
                count == 0 || !elixirKnown ? null : elixir,
                count == 0 || !darkElixirKnown ? null : darkElixir,
                count == 0 || !goldKnown ? null : rounded((double) gold / count),
                count == 0 || !elixirKnown ? null : rounded((double) elixir / count),
                count == 0 || !darkElixirKnown ? null : rounded((double) darkElixir / count),
                count == 0 || !bestGoldKnown ? null : bestGold,
                count == 0 || !bestElixirKnown ? null : bestElixir,
                count == 0 || !bestDarkElixirKnown ? null : bestDarkElixir);
    }

    static JsonArray failures(List<ScopeSnapshot> snapshots) {
        JsonArray result = new JsonArray();
        for (ScopeSnapshot snapshot : snapshots) {
            for (ReadFailure failure : snapshot.failures()) {
                JsonObject item = new JsonObject();
                item.addProperty("scope", failure.scope().apiValue());
                item.addProperty("operation", failure.operation());
                item.addProperty("code", failure.code());
                result.add(item);
            }
        }
        return result;
    }

    static void addNullableLong(JsonObject target, String field, Long value) {
        if (value == null) target.add(field, com.google.gson.JsonNull.INSTANCE);
        else target.addProperty(field, value);
    }

    static void addNullableDecimal(JsonObject target, String field, Double value) {
        if (value == null) target.add(field, com.google.gson.JsonNull.INSTANCE);
        else target.addProperty(field, value);
    }

    private static LootTotals unknownLoot() {
        return new LootTotals(null, null, null, null, null, null, null, null, null, null);
    }

    private static Long optionalLong(JsonObject source, String field) {
        if (source == null) return null;
        String key = source.has(field) ? field : lootAlias(field);
        if (key == null || !source.has(key) || source.get(key).isJsonNull()) return null;
        try {
            return source.get(key).getAsLong();
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static String lootAlias(String field) {
        return switch (field) {
            case "lootAttackCount" -> "lootKnownAttackCount";
            case "bestGoldLooted" -> "goldLootBest";
            case "bestElixirLooted" -> "elixirLootBest";
            case "bestDarkElixirLooted" -> "darkElixirLootBest";
            default -> null;
        };
    }

    private static JsonObject object(JsonObject source, String field) {
        if (source == null || !source.has(field) || !source.get(field).isJsonObject()) return null;
        return source.getAsJsonObject(field);
    }

    private static double rounded(double value) {
        return Math.round(value * 100d) / 100d;
    }

    private JsonArray asArray(JsonElement value, String field) {
        if (value == null || value.isJsonNull()) return new JsonArray();
        if (!value.isJsonArray()) {
            throw new IllegalStateException("Advanced Stats compact " + field + " must return an array");
        }
        return value.getAsJsonArray();
    }
}
