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

    /** Legacy Phase 1 identity kept for deterministic fingerprint regression coverage. */
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
            validateStars(stars);
            validateDestruction(destructionPercentage);
        }
    }

    /**
     * One entry observed in the player battle log.
     * battleTimestamp may be null because current battle-log responses do not
     * guarantee a timestamp field. observedAt is therefore always retained.
     * Available loot is retained as additional stable battle identity data.
     */
    public record BattleCandidate(
            String playerTag,
            Instant battleTimestamp,
            Instant observedAt,
            boolean attack,
            String battleType,
            String opponentPlayerTag,
            String opponentName,
            Integer opponentTownHall,
            Integer playerTownHall,
            Integer stars,
            Double destructionPercentage,
            String armyShareCode,
            long lootGold,
            long lootElixir,
            long lootDarkElixir,
            long availableGold,
            long availableElixir,
            long availableDarkElixir
    ) {
        public BattleCandidate {
            playerTag = CacheKeys.requireValidTag(playerTag);
            Objects.requireNonNull(observedAt, "observedAt");
            battleType = normalizeOptional(battleType);
            opponentPlayerTag = normalizeOptionalTag(opponentPlayerTag);
            opponentName = normalizeOptional(opponentName);
            armyShareCode = normalizeOptional(armyShareCode);
            if (opponentTownHall != null && opponentTownHall <= 0) {
                throw new IllegalArgumentException("opponentTownHall must be positive");
            }
            if (playerTownHall != null && playerTownHall <= 0) {
                throw new IllegalArgumentException("playerTownHall must be positive");
            }
            validateStars(stars);
            validateDestruction(destructionPercentage);
            if (lootGold < 0 || lootElixir < 0 || lootDarkElixir < 0
                    || availableGold < 0 || availableElixir < 0 || availableDarkElixir < 0) {
                throw new IllegalArgumentException("loot values cannot be negative");
            }
        }

        public Instant effectiveTimestamp() {
            return battleTimestamp == null ? observedAt : battleTimestamp;
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

    /** Parsed and deterministically normalized army payload. */
    public record ParsedArmy(
            List<UnitUsage> units,
            String normalizedArmyJson,
            String normalizedArmyHash,
            boolean armyDataAvailable
    ) {
        public ParsedArmy {
            units = units == null ? List.of() : List.copyOf(units);
            normalizedArmyJson = normalizeOptional(normalizedArmyJson);
            if (armyDataAvailable) {
                if (normalizedArmyJson.isBlank()) {
                    throw new IllegalArgumentException("normalizedArmyJson is required when army data is available");
                }
                normalizedArmyHash = requireSha256(normalizedArmyHash, "normalizedArmyHash");
            } else {
                normalizedArmyHash = normalizeOptional(normalizedArmyHash);
                if (!normalizedArmyHash.isBlank()) {
                    normalizedArmyHash = requireSha256(normalizedArmyHash, "normalizedArmyHash");
                }
            }
        }

        public static ParsedArmy unavailable() {
            return new ParsedArmy(List.of(), "", "", false);
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
            if (!Double.isFinite(destructionPercentage)
                    || destructionPercentage < 0 || destructionPercentage > 100) {
                throw new IllegalArgumentException("destructionPercentage must be finite and between 0 and 100");
            }
            units = units == null ? List.of() : List.copyOf(units);
            normalizedArmyHash = requireSha256(normalizedArmyHash, "normalizedArmyHash");
        }
    }

    public record SaveBattleResult(boolean inserted, UUID battleId) {
        public SaveBattleResult {
            if (inserted && battleId == null) {
                throw new IllegalArgumentException("battleId is required for an inserted battle");
            }
            if (!inserted && battleId != null) {
                throw new IllegalArgumentException("duplicate result cannot contain a battleId");
            }
        }

        public static SaveBattleResult duplicate() {
            return new SaveBattleResult(false, null);
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
            if (attacks < 0 || totalStars < 0 || !Double.isFinite(totalDestruction) || totalDestruction < 0
                    || threeStarAttacks < 0 || twoStarAttacks < 0
                    || oneStarAttacks < 0 || zeroStarAttacks < 0
                    || goldLooted < 0 || elixirLooted < 0 || darkElixirLooted < 0) {
                throw new IllegalArgumentException("aggregate values must be finite and non-negative");
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

    private static void validateStars(Integer stars) {
        if (stars != null && (stars < 0 || stars > 3)) {
            throw new IllegalArgumentException("stars must be between 0 and 3");
        }
    }

    private static void validateDestruction(Double destructionPercentage) {
        if (destructionPercentage != null
                && (!Double.isFinite(destructionPercentage)
                || destructionPercentage < 0 || destructionPercentage > 100)) {
            throw new IllegalArgumentException("destructionPercentage must be finite and between 0 and 100");
        }
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
