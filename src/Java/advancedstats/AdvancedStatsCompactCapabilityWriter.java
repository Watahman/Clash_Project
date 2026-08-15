package Java.advancedstats;

import Java.SUPABASE_Client;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.util.UUID;

/** Persists explicit per-scope capability and source provenance through the DB contract. */
final class AdvancedStatsCompactCapabilityWriter {
    private AdvancedStatsCompactCapabilityWriter() {}

    static void record(String workerId, UUID trackingId, String playerTag, AdvancedStatsScope scope,
                       AdvancedStatsCapability capability, Instant now) throws Exception {
        record(workerId, trackingId, playerTag, scope, capability,
                new AdvancedStatsHistoryModels.Provenance(capability.sourceId(), "capability-v1", now,
                        capability.reason()),
                capability.status() == AdvancedStatsCapabilityStatus.UNSUPPORTED
                        ? AdvancedStatsHistoryModels.Coverage.UNAVAILABLE
                        : AdvancedStatsHistoryModels.Coverage.PARTIAL);
    }

    static void record(String workerId, UUID trackingId, String playerTag, AdvancedStatsScope scope,
                       AdvancedStatsCapability capability, AdvancedStatsHistoryModels.Provenance provenance,
                       AdvancedStatsHistoryModels.Coverage coverage) throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("p_tracking_id", trackingId.toString());
        body.addProperty("p_player_tag", playerTag);
        body.addProperty("p_scope", scope.apiValue().toUpperCase(java.util.Locale.ROOT));
        body.addProperty("p_worker_id", workerId);
        body.addProperty("p_capability_status", capability.status().name());
        body.addProperty("p_coverage_status", coverage.name());
        body.addProperty("p_source_id", provenance.sourceId());
        body.addProperty("p_adapter_version", provenance.adapterVersion());
        body.add("p_source_provenance", provenance(provenance, capability));
        body.addProperty("p_now", provenance.fetchedAt().toString());
        AdvancedStatsCompactRepositorySupport.parseObject(
                SUPABASE_Client.rpc("record_advanced_stats_scope_capability_v1", body.toString()));
    }

    private static JsonObject provenance(AdvancedStatsHistoryModels.Provenance source,
                                         AdvancedStatsCapability capability) {
        JsonObject json = new JsonObject();
        json.addProperty("sourceId", source.sourceId());
        json.addProperty("adapterVersion", source.adapterVersion());
        json.addProperty("capabilityStatus", capability.status().name());
        if (!source.note().isBlank()) json.addProperty("note", source.note());
        return json;
    }
}
