package Java.advancedstats;

import Java.cache.CacheKeys;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public final class AdvancedStatsModels {
    private AdvancedStatsModels() {}

    public record TrackingState(
            UUID id,
            UUID userId,
            String playerTag,
            String playerName,
            Integer townHallLevel,
            AdvancedStatsTrackingStatus status,
            Instant trackingStartedAt,
            Instant bootstrapCompletedAt,
            Instant lastPollAt,
            Instant lastSuccessfulPollAt,
            Instant nextPollAt,
            int consecutiveFailures,
            Instant gapStartedAt,
            Instant dataCompleteSince,
            long battlesProcessed
    ) {
        public TrackingState {
            Objects.requireNonNull(id, "id");
            Objects.requireNonNull(userId, "userId");
            playerTag = CacheKeys.requireValidTag(playerTag);
            Objects.requireNonNull(status, "status");
            Objects.requireNonNull(trackingStartedAt, "trackingStartedAt");
            if (townHallLevel != null && townHallLevel <= 0) {
                throw new IllegalArgumentException("townHallLevel must be positive");
            }
            if (consecutiveFailures < 0) {
                throw new IllegalArgumentException("consecutiveFailures cannot be negative");
            }
            if (battlesProcessed < 0) {
                throw new IllegalArgumentException("battlesProcessed cannot be negative");
            }
        }
    }

    public record BattleIdentity(
            String playerTag,
            String battleTimestamp,
            boolean attack,
            String battleType,
            String opponentPlayerTag,
            Integer stars,
            Double destructionPercentage,
            String armyShareCode
    ) {
        public BattleIdentity {
            playerTag = CacheKeys.requireValidTag(playerTag);
            battleTimestamp = normalizeRequired(battleTimestamp, "battleTimestamp");
            battleType = normalizeOptional(battleType);
            opponentPlayerTag = normalizeOptionalTag(opponentPlayerTag);
            armyShareCode = normalizeOptional(armyShareCode);
            if (stars != null && (stars < 0 || stars > 3)) {
                throw new IllegalArgumentException("stars must be between 0 and 3");
            }
            if (destructionPercentage != null
                    && (destructionPercentage < 0 || destructionPercentage > 100)) {
                throw new IllegalArgumentException("destructionPercentage must be between 0 and 100");
            }
        }
    }

    public record UnitUsage(
            String unitKey,
            String unitName,
            AdvancedStatsUnitCategory category,
            int quantity,
            Integer unitLevel
    ) {
        public UnitUsage {
            unitKey = normalizeRequired(unitKey, "unitKey");
            unitName = normalizeRequired(unitName, "unitName");
            Objects.requireNonNull(category, "category");
            if (quantity <= 0) throw new IllegalArgumentException("quantity must be positive");
            if (unitLevel != null && unitLevel < 0) {
                throw new IllegalArgumentException("unitLevel cannot be negative");
            }
        }
    }

    public record ProcessedBattleDelta(
            String fingerprint,
            Instant battleTimestamp,
            String battleType,
            int stars,
            double destructionPercentage,
            List<UnitUsage> units,
            String normalizedArmyHash,
            boolean bootstrapImport
    ) {
        public ProcessedBattleDelta {
            fingerprint = requireSha256(fingerprint, "fingerprint");
            Objects.requireNonNull(battleTimestamp, "battleTimestamp");
            battleType = normalizeOptional(battleType);
            if (stars < 0 || stars > 3) throw new IllegalArgumentException("stars must be between 0 and 3");
            if (destructionPercentage < 0 || destructionPercentage > 100) {
                throw new IllegalArgumentException("destructionPercentage must be between 0 and 100");
            }
            units = units == null ? List.of() : List.copyOf(units);
            normalizedArmyHash = requireSha256(normalizedArmyHash, "normalizedArmyHash");
        }
    }

    public record DailyAggregate(
            LocalDate date,
            int attacks,
            int totalStars,
            double totalDestruction,
            int threeStarAttacks,
            int twoStarAttacks,
            int oneStarAttacks,
            int zeroStarAttacks,
            long goldLooted,
            long elixirLooted,
            long darkElixirLooted
    ) {
        public DailyAggregate {
            Objects.requireNonNull(date, "date");
            if (attacks < 0 || totalStars < 0 || totalDestruction < 0
                    || threeStarAttacks < 0 || twoStarAttacks < 0
                    || oneStarAttacks < 0 || zeroStarAttacks < 0
                    || goldLooted < 0 || elixirLooted < 0 || darkElixirLooted < 0) {
                throw new IllegalArgumentException("aggregate values cannot be negative");
            }
            int categorized = threeStarAttacks + twoStarAttacks + oneStarAttacks + zeroStarAttacks;
            if (categorized > attacks) {
                throw new IllegalArgumentException("star buckets cannot exceed attacks");
            }
        }
    }

    static String requireSha256(String value, String field) {
        String normalized = normalizeRequired(value, field).toLowerCase();
        if (!normalized.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException(field + " must be a SHA-256 hex string");
        }
        return normalized;
    }

    private static String normalizeOptionalTag(String value) {
        if (value == null || value.isBlank()) return "";
        return CacheKeys.requireValidTag(value);
    }

    static String normalizeRequired(String value, String field) {
        String normalized = normalizeOptional(value);
        if (normalized.isEmpty()) throw new IllegalArgumentException(field + " is required");
        return normalized;
    }

    static String normalizeOptional(String value) {
        return value == null ? "" : value.trim();
    }
}
