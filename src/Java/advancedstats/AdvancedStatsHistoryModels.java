package Java.advancedstats;

import Java.cache.CacheKeys;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/** Transient source and collection values. None of these models is a persistence model. */
public final class AdvancedStatsHistoryModels {
    private AdvancedStatsHistoryModels() {}

    public record Checkpoint(String cursor, Instant watermark, String watermarkKey) {
        public Checkpoint(String cursor, Instant watermark) {
            this(cursor, watermark, "");
        }

        public Checkpoint {
            cursor = normalize(cursor);
            watermarkKey = normalize(watermarkKey);
        }

        public static Checkpoint initial() {
            return new Checkpoint("", null, "");
        }

        public boolean present() {
            return !cursor.isBlank() || watermark != null;
        }
    }

    public record HistoryRequest(
            UUID trackingId,
            String playerTag,
            AdvancedStatsScope scope,
            AdvancedStatsCapabilityOperation operation,
            Checkpoint checkpoint,
            int pageSize,
            Instant requestedAt
    ) {
        public HistoryRequest {
            Objects.requireNonNull(trackingId, "trackingId");
            playerTag = CacheKeys.requireValidTag(playerTag);
            Objects.requireNonNull(scope, "scope");
            Objects.requireNonNull(operation, "operation");
            checkpoint = checkpoint == null ? Checkpoint.initial() : checkpoint;
            if (pageSize < 1 || pageSize > 500) throw new IllegalArgumentException("pageSize must be 1..500");
            Objects.requireNonNull(requestedAt, "requestedAt");
        }
    }

    public record UnitObservation(
            String unitKey,
            String unitName,
            AdvancedStatsUnitCategory category,
            int quantity,
            Integer level
    ) {
        public UnitObservation(String unitKey, int quantity, Integer level) {
            this(unitKey, unitKey, AdvancedStatsUnitCategory.TROOP, quantity, level);
        }

        public UnitObservation {
            unitKey = requireText(unitKey, "unitKey");
            unitName = requireText(unitName, "unitName");
            Objects.requireNonNull(category, "category");
            if (quantity <= 0) throw new IllegalArgumentException("quantity must be positive");
            if (level != null && level < 0) throw new IllegalArgumentException("level cannot be negative");
        }
    }

    public record AttackObservation(
            String eventKey,
            AdvancedStatsScope scope,
            Instant occurredAt,
            boolean attack,
            String battleType,
            String opponentTag,
            Integer playerTownHall,
            Integer opponentTownHall,
            Integer stars,
            Double destructionPercentage,
            List<UnitObservation> units,
            long goldLooted,
            long elixirLooted,
            long darkElixirLooted
    ) {
        public AttackObservation {
            eventKey = requireText(eventKey, "eventKey");
            if (eventKey.length() > 256) throw new IllegalArgumentException("eventKey is too long");
            Objects.requireNonNull(scope, "scope");
            Objects.requireNonNull(occurredAt, "occurredAt");
            battleType = normalize(battleType);
            opponentTag = normalize(opponentTag);
            validateTownHall(playerTownHall, "playerTownHall");
            validateTownHall(opponentTownHall, "opponentTownHall");
            if (stars != null && (stars < 0 || stars > 3)) throw new IllegalArgumentException("stars must be 0..3");
            if (destructionPercentage != null && (!Double.isFinite(destructionPercentage)
                    || destructionPercentage < 0 || destructionPercentage > 100)) {
                throw new IllegalArgumentException("destructionPercentage must be 0..100");
            }
            units = units == null ? List.of() : List.copyOf(units);
            if (goldLooted < 0 || elixirLooted < 0 || darkElixirLooted < 0) {
                throw new IllegalArgumentException("loot values cannot be negative");
            }
        }

        private static void validateTownHall(Integer value, String field) {
            if (value != null && value <= 0) throw new IllegalArgumentException(field + " must be positive");
        }
    }

    public enum Coverage {
        COMPLETE,
        PARTIAL,
        UNAVAILABLE
    }

    public record Provenance(String sourceId, String adapterVersion, Instant fetchedAt,
                             String note, String rankedSeasonKey) {
        public Provenance(String sourceId, String adapterVersion, Instant fetchedAt, String note) {
            this(sourceId, adapterVersion, fetchedAt, note, "");
        }

        public Provenance {
            sourceId = requireText(sourceId, "sourceId");
            adapterVersion = requireText(adapterVersion, "adapterVersion");
            Objects.requireNonNull(fetchedAt, "fetchedAt");
            note = normalize(note);
            rankedSeasonKey = normalize(rankedSeasonKey);
            if (!rankedSeasonKey.isBlank() && !rankedSeasonKey.matches("[1-9][0-9]{0,18}")) {
                throw new IllegalArgumentException("rankedSeasonKey must be positive Unix seconds");
            }
        }
    }

    public record HistoryPage(
            List<AttackObservation> observations,
            Checkpoint nextCheckpoint,
            boolean hasMore,
            Coverage coverage,
            Provenance provenance
    ) {
        public HistoryPage {
            observations = observations == null ? List.of() : List.copyOf(observations);
            nextCheckpoint = nextCheckpoint == null ? Checkpoint.initial() : nextCheckpoint;
            Objects.requireNonNull(coverage, "coverage");
            Objects.requireNonNull(provenance, "provenance");
            if (hasMore && !nextCheckpoint.present()) {
                throw new IllegalArgumentException("nextCheckpoint is required when hasMore is true");
            }
        }

        public boolean partial() {
            return coverage == Coverage.PARTIAL;
        }
    }

    private static String requireText(String value, String field) {
        String normalized = normalize(value);
        if (normalized.isBlank()) throw new IllegalArgumentException(field + " is required");
        return normalized;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
