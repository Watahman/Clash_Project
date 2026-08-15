package Java.advancedstats;

import Java.SUPABASE_Client;
import Java.advancedstats.AdvancedStatsCollectionModels.BootstrapStatus;
import Java.advancedstats.AdvancedStatsHistoryModels.Checkpoint;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.EnumMap;
import java.util.Map;
import java.util.UUID;

/** Read-only compact bootstrap/provenance status for authenticated tracking responses. */
public final class AdvancedStatsCompactStatusRepository {
    private static final String TRACKING_TABLE = "advanced_stats_tracking";
    private static final String SCOPE_TABLE = "advanced_stats_scope_state";

    public TrackingStatus find(UUID trackingId) throws Exception {
        if (trackingId == null) throw new IllegalArgumentException("trackingId is required");
        JsonArray trackingRows = rows(TRACKING_TABLE, "select=*" + "&id=" + SUPABASE_Client.eq(trackingId.toString()));
        if (trackingRows.isEmpty()) throw new IllegalStateException("Advanced Stats tracking row is missing");
        JsonObject tracking = trackingRows.get(0).getAsJsonObject();
        JsonArray scopeRows = rows(SCOPE_TABLE, "select=*&tracking_id=" + SUPABASE_Client.eq(trackingId.toString()));
        EnumMap<AdvancedStatsScope, ScopeStatus> scopes = new EnumMap<>(AdvancedStatsScope.class);
        for (JsonElement row : scopeRows) {
            ScopeStatus scope = scopeStatus(row.getAsJsonObject());
            scopes.put(scope.scope(), scope);
        }
        for (AdvancedStatsScope scope : AdvancedStatsScope.values()) {
            scopes.putIfAbsent(scope, pendingScope(scope));
        }
        return new TrackingStatus(
                UUID.fromString(required(tracking, "id")),
                phase(tracking, scopes),
                integer(tracking, "bootstrap_progress", 0),
                longValue(tracking, "bootstrap_processed", 0),
                nullableLong(tracking, "bootstrap_total"),
                bootstrapStatus(string(tracking, "bootstrap_status")),
                string(tracking, "bootstrap_error_code"),
                string(tracking, "bootstrap_error_message"),
                scopes
        );
    }

    private ScopeStatus scopeStatus(JsonObject row) {
        AdvancedStatsScope scope = AdvancedStatsScope.parse(required(row, "scope"));
        String errorCode = string(row, "last_error_code");
        AdvancedStatsCapabilityStatus capability = capabilityStatus(row, errorCode);
        JsonObject provenance = object(row, "source_provenance");
        return new ScopeStatus(scope, bootstrapStatus(string(row, "bootstrap_status")), capability,
                coverageStatus(row, capability), string(row, "source_season_key"),
                integer(row, "bootstrap_progress", 0),
                longValue(row, "bootstrap_processed", 0),
                nullableLong(row, "bootstrap_total"), sourceId(row, provenance),
                new Checkpoint(string(row, "source_cursor"), instant(row, "source_watermark_at"),
                        string(row, "source_watermark_key")), provenance,
                instant(row, "last_successful_poll_at"),
                string(row, "last_error_code"), string(row, "last_error_message"));
    }

    private String sourceId(JsonObject row, JsonObject provenance) {
        String reported = string(provenance, "sourceId");
        if (!reported.isBlank()) return reported;
        String sourceId = string(row, "source_id");
        return sourceId.isBlank() ? string(row, "source_provider") : sourceId;
    }

    private AdvancedStatsCapabilityStatus capabilityStatus(JsonObject row, String errorCode) {
        if ("CAPABILITY_UNSUPPORTED".equals(errorCode)) return AdvancedStatsCapabilityStatus.UNSUPPORTED;
        if ("CAPABILITY_PARTIAL".equals(errorCode)) return AdvancedStatsCapabilityStatus.PARTIAL;
        String value = string(row, "capability_status");
        if (!value.isBlank()) {
            try {
                return AdvancedStatsCapabilityStatus.valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
            } catch (IllegalArgumentException ignored) {
                // Keep compatibility with rows written before capability_status existed.
            }
        }
        return AdvancedStatsCapabilityStatus.SUPPORTED;
    }

    private ScopeStatus pendingScope(AdvancedStatsScope scope) {
        return new ScopeStatus(scope, BootstrapStatus.PENDING, AdvancedStatsCapabilityStatus.UNKNOWN,
                "PENDING", "", 0, 0, null, "", Checkpoint.initial(), new JsonObject(), null, "", "");
    }

    private String coverageStatus(JsonObject row, AdvancedStatsCapabilityStatus capability) {
        String value = string(row, "coverage_status");
        if (!value.isBlank()) return value.toUpperCase(java.util.Locale.ROOT);
        if (capability == AdvancedStatsCapabilityStatus.UNSUPPORTED) return "UNAVAILABLE";
        return "PENDING";
    }

    private String phase(JsonObject tracking, Map<AdvancedStatsScope, ScopeStatus> scopes) {
        if (scopes.values().stream().anyMatch(scope -> scope.bootstrapStatus() == BootstrapStatus.RUNNING)) {
            return "BOOTSTRAPPING";
        }
        if (scopes.values().stream().anyMatch(scope -> scope.bootstrapStatus() == BootstrapStatus.PENDING)) {
            return "NOT_STARTED";
        }
        if (scopes.values().stream().anyMatch(scope -> scope.bootstrapStatus() == BootstrapStatus.FAILED)) return "FAILED";
        if (scopes.values().stream().anyMatch(scope -> scope.bootstrapStatus() == BootstrapStatus.PARTIAL
                || scope.bootstrapStatus() == BootstrapStatus.UNSUPPORTED
                || scope.capabilityStatus() == AdvancedStatsCapabilityStatus.UNSUPPORTED)) return "PARTIAL";
        String global = string(tracking, "bootstrap_status");
        if ("COMPLETE".equalsIgnoreCase(global)
                || (!scopes.isEmpty() && scopes.values().stream().allMatch(scope -> scope.bootstrapStatus() == BootstrapStatus.COMPLETE))) {
            return "INCREMENTAL";
        }
        return "NOT_STARTED";
    }

    private BootstrapStatus bootstrapStatus(String value) {
        if (value == null || value.isBlank() || "NOT_STARTED".equalsIgnoreCase(value)) return BootstrapStatus.PENDING;
        return BootstrapStatus.valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
    }

    private JsonArray rows(String table, String query) throws Exception {
        JsonElement value = JsonParser.parseString(SUPABASE_Client.getWithBody(table, query));
        if (!value.isJsonArray()) throw new IllegalStateException("Advanced Stats status response must be an array");
        return value.getAsJsonArray();
    }

    private String required(JsonObject row, String field) {
        String value = string(row, field);
        if (value == null || value.isBlank()) throw new IllegalStateException("Missing status field: " + field);
        return value;
    }

    private String string(JsonObject row, String field) {
        JsonElement value = row.get(field);
        return value == null || value.isJsonNull() ? "" : value.getAsString();
    }

    private int integer(JsonObject row, String field, int fallback) {
        JsonElement value = row.get(field);
        return value == null || value.isJsonNull() ? fallback : value.getAsInt();
    }

    private long longValue(JsonObject row, String field, long fallback) {
        JsonElement value = row.get(field);
        return value == null || value.isJsonNull() ? fallback : value.getAsLong();
    }

    private Long nullableLong(JsonObject row, String field) {
        JsonElement value = row.get(field);
        return value == null || value.isJsonNull() ? null : value.getAsLong();
    }

    private JsonObject object(JsonObject row, String field) {
        JsonElement value = row.get(field);
        return value != null && value.isJsonObject() ? value.getAsJsonObject().deepCopy() : new JsonObject();
    }

    private Instant instant(JsonObject row, String field) {
        String value = string(row, field);
        if (value.isBlank()) return null;
        try {
            return Instant.parse(value);
        } catch (RuntimeException ignored) {
            return OffsetDateTime.parse(value).toInstant();
        }
    }

    public record TrackingStatus(
            UUID trackingId,
            String analysisPhase,
            int progress,
            long processed,
            Long total,
            BootstrapStatus bootstrapStatus,
            String errorCode,
            String errorMessage,
            Map<AdvancedStatsScope, ScopeStatus> scopes
    ) {
        public TrackingStatus {
            if (trackingId == null || analysisPhase == null || progress < 0 || progress > 100
                    || processed < 0 || bootstrapStatus == null) throw new IllegalArgumentException("invalid status");
            scopes = scopes == null ? Map.of() : Map.copyOf(scopes);
            errorCode = errorCode == null ? "" : errorCode;
            errorMessage = errorMessage == null ? "" : errorMessage;
        }
    }

    public record ScopeStatus(
            AdvancedStatsScope scope,
            BootstrapStatus bootstrapStatus,
            AdvancedStatsCapabilityStatus capabilityStatus,
            String coverageStatus,
            String seasonKey,
            int progress,
            long processed,
            Long total,
            String sourceId,
            Checkpoint checkpoint,
            JsonObject provenance,
            Instant lastSuccessfulPollAt,
            String errorCode,
            String errorMessage
    ) {
        public ScopeStatus(AdvancedStatsScope scope, BootstrapStatus bootstrapStatus,
                           AdvancedStatsCapabilityStatus capabilityStatus, int progress, long processed,
                           Long total, String sourceId, Checkpoint checkpoint, JsonObject provenance,
                           Instant lastSuccessfulPollAt, String errorCode, String errorMessage) {
            this(scope, bootstrapStatus, capabilityStatus, "", "", progress, processed, total, sourceId,
                    checkpoint, provenance, lastSuccessfulPollAt, errorCode, errorMessage);
        }

        public ScopeStatus {
            if (scope == null || bootstrapStatus == null || capabilityStatus == null
                    || progress < 0 || progress > 100 || processed < 0) {
                throw new IllegalArgumentException("invalid scope status");
            }
            coverageStatus = coverageStatus == null ? "" : coverageStatus.trim().toUpperCase(java.util.Locale.ROOT);
            seasonKey = seasonKey == null ? "" : seasonKey.trim();
            sourceId = sourceId == null ? "" : sourceId;
            checkpoint = checkpoint == null ? Checkpoint.initial() : checkpoint;
            provenance = provenance == null ? new JsonObject() : provenance.deepCopy();
            errorCode = errorCode == null ? "" : errorCode;
            errorMessage = errorMessage == null ? "" : errorMessage;
        }

        public String coverage() {
            if (capabilityStatus == AdvancedStatsCapabilityStatus.UNSUPPORTED) return "UNSUPPORTED";
            if (bootstrapStatus == BootstrapStatus.PENDING || bootstrapStatus == BootstrapStatus.RUNNING) {
                return "PENDING";
            }
            if ("UNAVAILABLE".equals(coverageStatus)) return "UNAVAILABLE";
            if ("PARTIAL".equals(coverageStatus)) return "PARTIAL";
            if (bootstrapStatus == BootstrapStatus.FAILED) return "UNAVAILABLE";
            if (bootstrapStatus == BootstrapStatus.PARTIAL || capabilityStatus == AdvancedStatsCapabilityStatus.PARTIAL) {
                return "PARTIAL";
            }
            if (bootstrapStatus == BootstrapStatus.COMPLETE) return "COMPLETE";
            return "PENDING";
        }
    }
}
