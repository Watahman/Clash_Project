package Java.advancedstats;

import Java.SUPABASE_Client;
import Java.advancedstats.AdvancedStatsCollectionModels.PageApplyResult;
import Java.advancedstats.AdvancedStatsCollectionModels.PageCommit;
import Java.advancedstats.AdvancedStatsCollectionModels.ScopeState;
import Java.advancedstats.AdvancedStatsHistoryModels.AttackObservation;
import Java.advancedstats.AdvancedStatsHistoryModels.Checkpoint;
import Java.advancedstats.AdvancedStatsHistoryModels.Provenance;
import Java.advancedstats.AdvancedStatsHistoryModels.UnitObservation;
import com.google.gson.JsonArray;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.time.Instant;
import java.util.UUID;

/**
 * Network-efficient compact repository.
 *
 * A ClashKing page is persisted through one Supabase RPC instead of one HTTP
 * round-trip per attack. The database function keeps receipt de-duplication,
 * aggregate updates, checkpoint advancement and bootstrap progress in one
 * transaction.
 */
public final class AdvancedStatsBatchedCompactRepository implements AdvancedStatsCollectionStore {
    private static final String PAGE_RPC = "save_advanced_stats_compact_page_v1";

    private final String workerId;
    private final AdvancedStatsCompactRepository delegate;

    public AdvancedStatsBatchedCompactRepository(String workerId) {
        if (workerId == null || workerId.isBlank()) throw new IllegalArgumentException("workerId is required");
        this.workerId = workerId.trim();
        this.delegate = new AdvancedStatsCompactRepository(this.workerId);
    }

    @Override
    public ScopeState load(UUID trackingId, AdvancedStatsScope scope) throws Exception {
        return delegate.load(trackingId, scope);
    }

    @Override
    public void markBootstrapStarted(UUID trackingId, AdvancedStatsScope scope, Instant startedAt) throws Exception {
        delegate.markBootstrapStarted(trackingId, scope, startedAt);
    }

    @Override
    public PageApplyResult applyPageAndAdvance(PageCommit commit) throws Exception {
        ScopeState state = delegate.load(commit.trackingId(), commit.scope());
        if (!state.checkpoint().equals(commit.expectedCheckpoint())) {
            throw new IllegalStateException("Advanced Stats scope checkpoint changed; retry with latest cursor");
        }

        JsonArray events = new JsonArray();
        int skipped = 0;
        for (AttackObservation observation : commit.page().observations()) {
            if (!observation.attack()) {
                skipped++;
                continue;
            }
            events.add(eventJson(observation));
        }

        AdvancedStatsCompactCapabilityWriter.record(
                workerId,
                commit.trackingId(),
                commit.playerTag(),
                commit.scope(),
                commit.capability(),
                commit.page().provenance(),
                commit.page().coverage()
        );

        JsonObject body = new JsonObject();
        body.addProperty("p_tracking_id", commit.trackingId().toString());
        body.addProperty("p_player_tag", commit.playerTag());
        body.addProperty("p_scope", scopeName(commit.scope()));
        body.add("p_events", events);
        body.addProperty("p_observed_at", commit.committedAt().toString());
        addExpectedCheckpoint(body, commit.expectedCheckpoint());
        addCheckpoint(body, commit.page().nextCheckpoint());
        body.add("p_source_provenance", provenanceJson(commit.page().provenance()));
        body.addProperty("p_bootstrap_import", commit.operation() == AdvancedStatsCapabilityOperation.BOOTSTRAP);
        body.addProperty("p_has_more", commit.page().hasMore());
        body.addProperty("p_worker_id", workerId);

        JsonObject result = AdvancedStatsCompactRepositorySupport.parseObject(
                SUPABASE_Client.rpc(PAGE_RPC, body.toString())
        );
        int inserted = Math.toIntExact(AdvancedStatsCompactRepositorySupport.optionalLong(result, "inserted", 0));
        int duplicates = Math.toIntExact(AdvancedStatsCompactRepositorySupport.optionalLong(result, "duplicates", 0));

        return new PageApplyResult(
                delegate.load(commit.trackingId(), commit.scope()),
                inserted,
                duplicates,
                skipped
        );
    }

    @Override
    public void switchRankedSeason(UUID trackingId, String playerTag, String workerId,
                                   String expectedSeasonKey, String newSeasonKey, Instant now) throws Exception {
        delegate.switchRankedSeason(trackingId, playerTag, workerId, expectedSeasonKey, newSeasonKey, now);
    }

    @Override
    public void markCapabilityUnavailable(UUID trackingId, AdvancedStatsScope scope,
                                          AdvancedStatsCapability capability, Instant observedAt) throws Exception {
        delegate.markCapabilityUnavailable(trackingId, scope, capability, observedAt);
    }

    @Override
    public void markFailure(UUID trackingId, AdvancedStatsScope scope, String message, Instant failedAt) throws Exception {
        delegate.markFailure(trackingId, scope, message, failedAt);
    }

    private JsonObject eventJson(AttackObservation observation) {
        AdvancedStatsCompactEventFingerprint.NormalizedArmy army =
                AdvancedStatsCompactEventFingerprint.normalizedArmy(observation);
        JsonObject event = new JsonObject();
        event.addProperty("eventFingerprint", AdvancedStatsCompactEventFingerprint.forObservation(observation));
        event.addProperty("eventAt", observation.occurredAt().toString());
        AdvancedStatsCompactRepositorySupport.addInteger(event, "stars", observation.stars());
        AdvancedStatsCompactRepositorySupport.addDouble(event, "destructionPercentage", observation.destructionPercentage());
        event.addProperty("lootGold", observation.goldLooted());
        event.addProperty("lootElixir", observation.elixirLooted());
        event.addProperty("lootDarkElixir", observation.darkElixirLooted());
        event.add("units", unitsJson(observation));
        if (army.available()) {
            event.addProperty("armyHash", army.hash());
            event.add("normalizedArmyJson", JsonParser.parseString(army.json()));
        } else {
            event.add("armyHash", JsonNull.INSTANCE);
            event.add("normalizedArmyJson", JsonNull.INSTANCE);
        }
        return event;
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

    private static String scopeName(AdvancedStatsScope scope) {
        return scope.apiValue().toUpperCase(java.util.Locale.ROOT);
    }
}
