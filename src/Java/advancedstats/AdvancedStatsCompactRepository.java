package Java.advancedstats;

import Java.SUPABASE_Client;
import Java.advancedstats.AdvancedStatsCollectionModels.BootstrapStatus;
import Java.advancedstats.AdvancedStatsCollectionModels.PageApplyResult;
import Java.advancedstats.AdvancedStatsCollectionModels.PageCommit;
import Java.advancedstats.AdvancedStatsCollectionModels.ScopeState;
import Java.advancedstats.AdvancedStatsHistoryModels.AttackObservation;
import Java.advancedstats.AdvancedStatsHistoryModels.Checkpoint;
import Java.advancedstats.AdvancedStatsHistoryModels.Provenance;
import Java.advancedstats.AdvancedStatsHistoryModels.UnitObservation;
import Java.cache.CacheKeys;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Supabase RPC adapter for compact scope state and derived Advanced Stats aggregates. */
public final class AdvancedStatsCompactRepository implements AdvancedStatsCollectionStore {
    private static final String STATE_TABLE = "advanced_stats_scope_state";
    private static final String TRACKING_TABLE = "advanced_stats_tracking";
    private final String workerId;

    public AdvancedStatsCompactRepository(String workerId) {
        if (workerId == null || workerId.isBlank()) throw new IllegalArgumentException("workerId is required");
        this.workerId = workerId.trim();
    }

    @Override
    public ScopeState load(UUID trackingId, AdvancedStatsScope scope) throws Exception {
        if (trackingId == null) throw new IllegalArgumentException("trackingId is required");
        String trackingQuery = "select=player_tag&id=" + SUPABASE_Client.eq(trackingId.toString()) + "&limit=1";
        JsonArray trackingRows = AdvancedStatsCompactRepositorySupport.parseArray(
                SUPABASE_Client.getWithBody(TRACKING_TABLE, trackingQuery));
        if (trackingRows.isEmpty()) throw new IllegalStateException("Advanced Stats tracking row is missing");
        String playerTag = CacheKeys.requireValidTag(AdvancedStatsCompactRepositorySupport.requiredString(
                trackingRows.get(0).getAsJsonObject(), "player_tag"));
        String query = "select=*&tracking_id=" + SUPABASE_Client.eq(trackingId.toString())
                + "&scope=" + SUPABASE_Client.eq(scopeName(scope)) + "&limit=1";
        JsonArray rows = AdvancedStatsCompactRepositorySupport.parseArray(SUPABASE_Client.getWithBody(STATE_TABLE, query));
        return rows.isEmpty() ? initialState(trackingId, playerTag, scope) : toState(trackingId, playerTag, scope,
                rows.get(0).getAsJsonObject());
    }

    @Override
    public void markBootstrapStarted(UUID trackingId, AdvancedStatsScope scope, Instant startedAt) throws Exception {
        ScopeState state = load(trackingId, scope);
        JsonObject body = bootstrapBody(trackingId, state.playerTag(), scope, "RUNNING",
                progress(state), state.observationsProcessed(), null, "", "", startedAt);
        rpc("update_advanced_stats_bootstrap_v1", body);
    }

    @Override
    public PageApplyResult applyPageAndAdvance(PageCommit commit) throws Exception {
        ScopeState state = load(commit.trackingId(), commit.scope());
        if (!state.checkpoint().equals(commit.expectedCheckpoint())) {
            throw new IllegalStateException("Advanced Stats scope checkpoint changed; retry with latest cursor");
        }
        long inserted = 0;
        long duplicates = 0;
        long skipped = 0;
        for (AttackObservation observation : commit.page().observations()) {
            if (!observation.attack()) {
                skipped++;
                continue;
            }
            SaveEventResult result = saveEvent(commit, observation);
            if (result.inserted()) inserted++;
            else if (result.duplicate()) duplicates++;
        }
        updatePoll(commit, state.playerTag());
        if (commit.operation() == AdvancedStatsCapabilityOperation.BOOTSTRAP) {
            updateBootstrapAfterPage(commit, state.observationsProcessed() + inserted);
        }
        return new PageApplyResult(load(commit.trackingId(), commit.scope()),
                Math.toIntExact(inserted), Math.toIntExact(duplicates), Math.toIntExact(skipped));
    }

    @Override
    public void markCapabilityUnavailable(UUID trackingId, AdvancedStatsScope scope,
                                          AdvancedStatsCapability capability, Instant observedAt) throws Exception {
        ScopeState state = load(trackingId, scope);
        AdvancedStatsCompactCapabilityWriter.record(workerId, trackingId, state.playerTag(), scope,
                capability, observedAt);
        String code = capability.status() == AdvancedStatsCapabilityStatus.PARTIAL
                ? "CAPABILITY_PARTIAL" : "CAPABILITY_UNSUPPORTED";
        updatePollFailure(trackingId, state.playerTag(), scope, state.checkpoint(), observedAt,
                code, capability.reason());
        String bootstrapStatus = capability.status() == AdvancedStatsCapabilityStatus.UNSUPPORTED
                ? "UNSUPPORTED" : "PARTIAL";
        JsonObject body = bootstrapBody(trackingId, state.playerTag(), scope, bootstrapStatus, 0,
                state.observationsProcessed(), null, code, capability.reason(), observedAt);
        rpc("update_advanced_stats_bootstrap_v1", body);
    }

    @Override
    public void markFailure(UUID trackingId, AdvancedStatsScope scope, String message, Instant failedAt) throws Exception {
        ScopeState state = load(trackingId, scope);
        updatePollFailure(trackingId, state.playerTag(), scope, state.checkpoint(), failedAt,
                "COLLECTION_FAILED", message);
        if (state.bootstrapStatus() == BootstrapStatus.RUNNING) {
            JsonObject body = bootstrapBody(trackingId, state.playerTag(), scope, "FAILED", progress(state),
                    state.observationsProcessed(), null, "COLLECTION_FAILED", message, failedAt);
            rpc("update_advanced_stats_bootstrap_v1", body);
        }
    }

    @Override
    public void switchRankedSeason(UUID trackingId, String playerTag, String workerId,
                                   String expectedSeasonKey, String newSeasonKey, Instant now) throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("p_tracking_id", trackingId.toString());
        body.addProperty("p_player_tag", playerTag);
        body.addProperty("p_worker_id", workerId);
        body.addProperty("p_expected_season_key", expectedSeasonKey == null ? "" : expectedSeasonKey);
        body.addProperty("p_new_season_key", newSeasonKey);
        body.addProperty("p_now", now.toString());
        rpc("switch_advanced_stats_ranked_season_v1", body);
    }

    private SaveEventResult saveEvent(PageCommit commit, AttackObservation observation) throws Exception {
        AdvancedStatsCompactEventFingerprint.NormalizedArmy army =
                AdvancedStatsCompactEventFingerprint.normalizedArmy(observation);
        JsonObject body = new JsonObject();
        body.addProperty("p_tracking_id", commit.trackingId().toString());
        body.addProperty("p_player_tag", commit.playerTag());
        body.addProperty("p_scope", scopeName(commit.scope()));
        body.addProperty("p_event_fingerprint", AdvancedStatsCompactEventFingerprint.forObservation(observation));
        body.addProperty("p_event_at", observation.occurredAt().toString());
        body.addProperty("p_observed_at", commit.committedAt().toString());
        AdvancedStatsCompactRepositorySupport.addInteger(body, "p_stars", observation.stars());
        AdvancedStatsCompactRepositorySupport.addDouble(body, "p_destruction_percentage", observation.destructionPercentage());
        body.addProperty("p_loot_gold", observation.goldLooted());
        body.addProperty("p_loot_elixir", observation.elixirLooted());
        body.addProperty("p_loot_dark_elixir", observation.darkElixirLooted());
        body.add("p_units", unitsJson(observation));
        if (army.available()) {
            body.addProperty("p_army_hash", army.hash());
            body.add("p_normalized_army_json", JsonParser.parseString(army.json()));
        } else {
            body.add("p_army_hash", JsonNull.INSTANCE);
            body.add("p_normalized_army_json", JsonNull.INSTANCE);
        }
        addExpectedCheckpoint(body, commit.expectedCheckpoint());
        addCheckpoint(body, commit.page().nextCheckpoint());
        body.add("p_source_provenance", provenanceJson(commit.page().provenance()));
        body.addProperty("p_bootstrap_import", commit.operation() == AdvancedStatsCapabilityOperation.BOOTSTRAP);
        body.addProperty("p_worker_id", workerId);
        JsonObject result = rpc("save_advanced_stats_compact_event_v1", body);
        return new SaveEventResult(
                AdvancedStatsCompactRepositorySupport.booleanValue(result, "inserted", false),
                AdvancedStatsCompactRepositorySupport.booleanValue(result, "duplicate", false));
    }

    private void updatePoll(PageCommit commit, String playerTag) throws Exception {
        Checkpoint checkpoint = commit.page().nextCheckpoint();
        AdvancedStatsCompactCapabilityWriter.record(workerId, commit.trackingId(), playerTag, commit.scope(),
                commit.capability(), commit.page().provenance(), commit.page().coverage());
        JsonObject body = new JsonObject();
        body.addProperty("p_tracking_id", commit.trackingId().toString());
        body.addProperty("p_player_tag", playerTag);
        body.addProperty("p_scope", scopeName(commit.scope()));
        body.addProperty("p_worker_id", workerId);
        body.addProperty("p_now", commit.committedAt().toString());
        body.addProperty("p_success", true);
        addExpectedCheckpoint(body, commit.expectedCheckpoint());
        addCheckpoint(body, checkpoint);
        body.add("p_source_provenance", provenanceJson(commit.page().provenance()));
        body.add("p_error_code", JsonNull.INSTANCE);
        body.add("p_error_message", JsonNull.INSTANCE);
        rpc("update_advanced_stats_scope_poll_v1", body);
    }

    private void updatePollFailure(UUID trackingId, String playerTag, AdvancedStatsScope scope,
                                   Checkpoint expected, Instant now, String code, String message) throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("p_tracking_id", trackingId.toString());
        body.addProperty("p_player_tag", playerTag);
        body.addProperty("p_scope", scopeName(scope));
        body.addProperty("p_worker_id", workerId);
        body.addProperty("p_now", now.toString());
        body.addProperty("p_success", false);
        addExpectedCheckpoint(body, expected);
        body.add("p_source_cursor", JsonNull.INSTANCE);
        body.add("p_source_watermark_at", JsonNull.INSTANCE);
        body.add("p_source_watermark_key", JsonNull.INSTANCE);
        body.add("p_source_provenance", new JsonObject());
        body.addProperty("p_error_code", code);
        body.addProperty("p_error_message", safeMessage(message));
        rpc("update_advanced_stats_scope_poll_v1", body);
    }

    private void updateBootstrapAfterPage(PageCommit commit, long processed) throws Exception {
        String status = commit.capability().status() == AdvancedStatsCapabilityStatus.PARTIAL
                || commit.page().coverage() == AdvancedStatsHistoryModels.Coverage.PARTIAL ? "PARTIAL"
                : commit.page().hasMore() ? "RUNNING" : "COMPLETE";
        int progress = "COMPLETE".equals(status) ? 100 : 0;
        ScopeState state = load(commit.trackingId(), commit.scope());
        JsonObject body = bootstrapBody(commit.trackingId(), state.playerTag(), commit.scope(), status,
                progress, processed, null, "", "", commit.committedAt());
        rpc("update_advanced_stats_bootstrap_v1", body);
    }

    private JsonObject bootstrapBody(UUID trackingId, String playerTag, AdvancedStatsScope scope, String status,
                                     int progress, long processed, Long total, String errorCode,
                                     String errorMessage, Instant now) {
        JsonObject body = new JsonObject();
        body.addProperty("p_tracking_id", trackingId.toString());
        body.addProperty("p_player_tag", playerTag);
        body.addProperty("p_scope", scopeName(scope));
        body.addProperty("p_worker_id", workerId);
        body.addProperty("p_status", status);
        body.addProperty("p_progress", progress);
        body.addProperty("p_processed", processed);
        AdvancedStatsCompactRepositorySupport.addLong(body, "p_total", total);
        body.addProperty("p_error_code", errorCode == null ? "" : errorCode);
        body.addProperty("p_error_message", safeMessage(errorMessage));
        body.addProperty("p_now", now.toString());
        return body;
    }

    private ScopeState initialState(UUID id, String playerTag, AdvancedStatsScope scope) {
        return new ScopeState(id, playerTag, scope, BootstrapStatus.PENDING, Checkpoint.initial(),
                AdvancedStatsCapabilityStatus.SUPPORTED, "CLASHKING", 0, null, null, "");
    }

    private ScopeState toState(UUID id, String playerTag, AdvancedStatsScope scope, JsonObject row) {
        String errorCode = AdvancedStatsCompactRepositorySupport.optionalString(row, "last_error_code");
        AdvancedStatsCapabilityStatus capability = capabilityStatus(row, errorCode);
        String sourceId = AdvancedStatsCompactRepositorySupport.optionalString(row, "source_id");
        if (sourceId == null || sourceId.isBlank()) {
            sourceId = AdvancedStatsCompactRepositorySupport.optionalString(row, "source_provider");
        }
        return new ScopeState(id, playerTag, scope,
                bootstrapStatus(AdvancedStatsCompactRepositorySupport.optionalString(row, "bootstrap_status")),
                new Checkpoint(AdvancedStatsCompactRepositorySupport.optionalString(row, "source_cursor"),
                        AdvancedStatsCompactRepositorySupport.optionalInstant(row, "source_watermark_at"),
                        AdvancedStatsCompactRepositorySupport.optionalString(row, "source_watermark_key")), capability,
                AdvancedStatsCompactRepositorySupport.optionalString(row, "source_season_key"),
                sourceId,
                AdvancedStatsCompactRepositorySupport.optionalLong(row, "bootstrap_processed", 0),
                AdvancedStatsCompactRepositorySupport.optionalInstant(row, "last_attempted_poll_at"),
                AdvancedStatsCompactRepositorySupport.optionalInstant(row, "last_successful_poll_at"),
                AdvancedStatsCompactRepositorySupport.optionalString(row, "last_error_message"));
    }

    private AdvancedStatsCapabilityStatus capabilityStatus(JsonObject row, String errorCode) {
        if ("CAPABILITY_UNSUPPORTED".equals(errorCode)) return AdvancedStatsCapabilityStatus.UNSUPPORTED;
        if ("CAPABILITY_PARTIAL".equals(errorCode)) return AdvancedStatsCapabilityStatus.PARTIAL;
        String value = AdvancedStatsCompactRepositorySupport.optionalString(row, "capability_status");
        if (value != null && !value.isBlank()) {
            try {
                return AdvancedStatsCapabilityStatus.valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
            } catch (IllegalArgumentException ignored) {
                // Fall back to the legacy error marker below.
            }
        }
        return AdvancedStatsCapabilityStatus.SUPPORTED;
    }

    private JsonArray unitsJson(AttackObservation observation) {
        JsonArray units = new JsonArray();
        for (UnitObservation unit : observation.units()) {
            JsonObject item = new JsonObject();
            item.addProperty("unit_key", unit.unitKey());
            item.addProperty("unit_name", unit.unitName());
            item.addProperty("category", unit.category().name());
            item.addProperty("quantity", unit.quantity());
            units.add(item);
        }
        return units;
    }

    private JsonObject provenanceJson(Provenance provenance) {
        JsonObject json = new JsonObject();
        json.addProperty("sourceId", provenance.sourceId());
        json.addProperty("adapterVersion", provenance.adapterVersion());
        if (!provenance.rankedSeasonKey().isBlank()) {
            json.addProperty("rankedSeasonKey", provenance.rankedSeasonKey());
        }
        if (!provenance.note().isBlank()) json.addProperty("note", provenance.note());
        return json;
    }

    private void addCheckpoint(JsonObject body, Checkpoint checkpoint) {
        if (checkpoint.cursor().isBlank()) body.add("p_source_cursor", JsonNull.INSTANCE);
        else body.addProperty("p_source_cursor", checkpoint.cursor());
        if (checkpoint.watermark() == null) body.add("p_source_watermark_at", JsonNull.INSTANCE);
        else body.addProperty("p_source_watermark_at", checkpoint.watermark().toString());
        if (checkpoint.watermarkKey().isBlank()) body.add("p_source_watermark_key", JsonNull.INSTANCE);
        else body.addProperty("p_source_watermark_key", checkpoint.watermarkKey());
    }

    private void addExpectedCheckpoint(JsonObject body, Checkpoint checkpoint) {
        if (checkpoint.cursor().isBlank()) body.add("p_expected_cursor", JsonNull.INSTANCE);
        else body.addProperty("p_expected_cursor", checkpoint.cursor());
        if (checkpoint.watermark() == null) body.add("p_expected_watermark_at", JsonNull.INSTANCE);
        else body.addProperty("p_expected_watermark_at", checkpoint.watermark().toString());
        if (checkpoint.watermarkKey().isBlank()) body.add("p_expected_watermark_key", JsonNull.INSTANCE);
        else body.addProperty("p_expected_watermark_key", checkpoint.watermarkKey());
    }

    private JsonObject rpc(String function, JsonObject body) throws Exception {
        return AdvancedStatsCompactRepositorySupport.parseObject(SUPABASE_Client.rpc(function, body.toString()));
    }

    private static String scopeName(AdvancedStatsScope scope) {
        return scope.apiValue().toUpperCase(java.util.Locale.ROOT);
    }

    private BootstrapStatus bootstrapStatus(String value) {
        if (value == null || value.isBlank() || "NOT_STARTED".equalsIgnoreCase(value)) return BootstrapStatus.PENDING;
        return BootstrapStatus.valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
    }

    private int progress(ScopeState state) {
        return state.bootstrapStatus() == BootstrapStatus.COMPLETE ? 100 : 0;
    }

    private String safeMessage(String value) {
        return value == null || value.isBlank() ? "" : value.trim().substring(0, Math.min(2048, value.trim().length()));
    }

    private record SaveEventResult(boolean inserted, boolean duplicate) {}

}
