package Java.advancedstats;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static Java.advancedstats.AdvancedStatsCompactReadFailureSupport.read;

/** Reads a caller-selected set of scopes and delegates aggregation to the merger. */
final class AdvancedStatsCompactReadSelection {
    private final AdvancedStatsCompactReadAggregator.ScopeReader reader;
    private final AdvancedStatsCompactReadMerger merger;

    AdvancedStatsCompactReadSelection(
            AdvancedStatsCompactReadAggregator.ScopeReader reader,
            AdvancedStatsCompactReadMerger merger
    ) {
        this.reader = reader;
        this.merger = merger;
    }

    JsonObject overview(UUID trackingId, Instant from, AdvancedStatsScopeSelection selection)
            throws Exception {
        if (selection == null || selection.isAll()) {
            return merger.overview(readOverviewSnapshots(trackingId, from));
        }
        return merger.overview(
                readOverviewSnapshots(trackingId, from, selection.scopes()), selection.apiValue());
    }

    JsonElement units(UUID trackingId, Instant from, AdvancedStatsUnitCategory category,
                      AdvancedStatsScopeSelection selection) throws Exception {
        if (selection == null || selection.isAll()) {
            return merger.units(readUnitSnapshots(trackingId, from, category));
        }
        if (selection.isSingleScope()) {
            return reader.units(trackingId, selection.singleScope(), from, category);
        }
        return merger.units(readUnitSnapshots(trackingId, from, category, selection.scopes()));
    }

    JsonElement armies(UUID trackingId, Instant from, int limit,
                       AdvancedStatsScopeSelection selection) throws Exception {
        if (selection == null || selection.isAll()) {
            return merger.armies(readArmySnapshots(trackingId, from), limit);
        }
        if (selection.isSingleScope()) {
            return reader.armies(trackingId, selection.singleScope(), from, limit);
        }
        return merger.armies(readArmySnapshots(trackingId, from, selection.scopes()), limit);
    }

    JsonElement trends(UUID trackingId, Instant from, AdvancedStatsScopeSelection selection)
            throws Exception {
        if (selection == null || selection.isAll()) {
            return merger.trends(readTrendSnapshots(trackingId, from));
        }
        if (selection.isSingleScope()) {
            return reader.trends(trackingId, selection.singleScope(), from);
        }
        // A trends array has no place for per-scope failure metadata. Fail the
        // selected read instead of returning a deceptively complete-looking array.
        return merger.trends(readTrendSnapshots(trackingId, from, selection.scopes()));
    }

    private List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> readOverviewSnapshots(
            UUID trackingId, Instant from) {
        return readOverviewSnapshots(trackingId, from, List.of(AdvancedStatsScope.values()));
    }

    private List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> readOverviewSnapshots(
            UUID trackingId, Instant from, List<AdvancedStatsScope> scopes) {
        List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> snapshots = new ArrayList<>();
        for (AdvancedStatsScope scope : scopes) {
            snapshots.add(readOverviewSnapshot(trackingId, from, scope));
        }
        return snapshots;
    }

    private AdvancedStatsCompactReadAggregator.ScopeSnapshot readOverviewSnapshot(
            UUID trackingId, Instant from, AdvancedStatsScope scope) {
        List<AdvancedStatsCompactReadAggregator.ReadFailure> failures = new ArrayList<>();
        JsonObject overview = read(() -> reader.overview(trackingId, scope, from),
                scope, "overview", null, failures);
        JsonArray units = read(() -> asArray(reader.units(trackingId, scope, from, null), "units"),
                scope, "units", new JsonArray(), failures);
        JsonArray armies = read(() -> asArray(reader.armies(trackingId, scope, from, 100), "armies"),
                scope, "armies", new JsonArray(), failures);
        return new AdvancedStatsCompactReadAggregator.ScopeSnapshot(
                scope, overview, units, armies, null, failures);
    }

    private List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> readUnitSnapshots(
            UUID trackingId, Instant from, AdvancedStatsUnitCategory category) throws Exception {
        List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> snapshots = new ArrayList<>();
        for (AdvancedStatsScope scope : List.of(AdvancedStatsScope.NORMAL, AdvancedStatsScope.RANKED)) {
            JsonObject overview = reader.overview(trackingId, scope, from);
            JsonArray units = asArray(reader.units(trackingId, scope, from, category), "units");
            snapshots.add(new AdvancedStatsCompactReadAggregator.ScopeSnapshot(
                    scope, overview, units, null, null));
        }
        return snapshots;
    }

    private List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> readUnitSnapshots(
            UUID trackingId, Instant from, AdvancedStatsUnitCategory category,
            List<AdvancedStatsScope> scopes) {
        List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> snapshots = new ArrayList<>();
        for (AdvancedStatsScope scope : scopes) {
            List<AdvancedStatsCompactReadAggregator.ReadFailure> failures = new ArrayList<>();
            JsonObject overview = read(() -> reader.overview(trackingId, scope, from),
                    scope, "overview", null, failures);
            JsonArray units = read(() -> asArray(reader.units(trackingId, scope, from, category), "units"),
                    scope, "units", new JsonArray(), failures);
            snapshots.add(new AdvancedStatsCompactReadAggregator.ScopeSnapshot(
                    scope, overview, units, null, null, failures));
        }
        return snapshots;
    }

    private List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> readArmySnapshots(
            UUID trackingId, Instant from) throws Exception {
        return readArmySnapshots(trackingId, from, List.of(AdvancedStatsScope.values()), false);
    }

    private List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> readArmySnapshots(
            UUID trackingId, Instant from, List<AdvancedStatsScope> scopes) throws Exception {
        return readArmySnapshots(trackingId, from, scopes, true);
    }

    private List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> readArmySnapshots(
            UUID trackingId, Instant from, List<AdvancedStatsScope> scopes, boolean tolerateFailure)
            throws Exception {
        List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> snapshots = new ArrayList<>();
        for (AdvancedStatsScope scope : scopes) {
            List<AdvancedStatsCompactReadAggregator.ReadFailure> failures = new ArrayList<>();
            JsonArray armies = tolerateFailure
                    ? read(() -> asArray(reader.armies(trackingId, scope, from, 100), "armies"),
                    scope, "armies", new JsonArray(), failures)
                    : asArray(reader.armies(trackingId, scope, from, 100), "armies");
            snapshots.add(new AdvancedStatsCompactReadAggregator.ScopeSnapshot(
                    scope, null, null, armies, null, failures));
        }
        return snapshots;
    }

    private List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> readTrendSnapshots(
            UUID trackingId, Instant from) throws Exception {
        return readTrendSnapshots(trackingId, from, List.of(AdvancedStatsScope.values()));
    }

    private List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> readTrendSnapshots(
            UUID trackingId, Instant from, List<AdvancedStatsScope> scopes) throws Exception {
        List<AdvancedStatsCompactReadAggregator.ScopeSnapshot> snapshots = new ArrayList<>();
        for (AdvancedStatsScope scope : scopes) {
            JsonArray trends = asArray(reader.trends(trackingId, scope, from), "trends");
            snapshots.add(new AdvancedStatsCompactReadAggregator.ScopeSnapshot(
                    scope, null, null, null, trends));
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
