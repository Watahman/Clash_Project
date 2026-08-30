package Java.advancedstats;

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
            JsonArray trends
    ) {}

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

    private List<ScopeSnapshot> readOverviewSnapshots(UUID trackingId, Instant from) throws Exception {
        List<ScopeSnapshot> snapshots = new ArrayList<>();
        for (AdvancedStatsScope scope : AdvancedStatsScope.values()) {
            snapshots.add(new ScopeSnapshot(
                    scope,
                    reader.overview(trackingId, scope, from),
                    asArray(reader.units(trackingId, scope, from, null), "units"),
                    asArray(reader.armies(trackingId, scope, from, 100), "armies"),
                    null
            ));
        }
        return snapshots;
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
            snapshots.add(new ScopeSnapshot(
                    scope,
                    reader.overview(trackingId, scope, from),
                    asArray(reader.units(trackingId, scope, from, category), "units"),
                    null,
                    null
            ));
        }
        return snapshots;
    }

    private List<ScopeSnapshot> readArmySnapshots(UUID trackingId, Instant from) throws Exception {
        List<ScopeSnapshot> snapshots = new ArrayList<>();
        for (AdvancedStatsScope scope : AdvancedStatsScope.values()) {
            snapshots.add(new ScopeSnapshot(
                    scope,
                    null,
                    null,
                    asArray(reader.armies(trackingId, scope, from, 100), "armies"),
                    null
            ));
        }
        return snapshots;
    }

    private List<ScopeSnapshot> readTrendSnapshots(UUID trackingId, Instant from) throws Exception {
        List<ScopeSnapshot> snapshots = new ArrayList<>();
        for (AdvancedStatsScope scope : AdvancedStatsScope.values()) {
            snapshots.add(new ScopeSnapshot(
                    scope,
                    null,
                    null,
                    null,
                    asArray(reader.trends(trackingId, scope, from), "trends")
            ));
        }
        return snapshots;
    }

    private JsonArray asArray(JsonElement value, String field) {
        if (value == null || value.isJsonNull()) return new JsonArray();
        if (!value.isJsonArray()) {
            throw new IllegalStateException("Advanced Stats compact " + field + " must return an array");
        }
        return value.getAsJsonArray();
    }
}
