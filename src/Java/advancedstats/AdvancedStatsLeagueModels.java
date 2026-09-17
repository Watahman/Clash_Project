package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.AttackObservation;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/** Small transient value types shared by the Legends and Ranked read path. */
public final class AdvancedStatsLeagueModels {
    private AdvancedStatsLeagueModels() {}

    public enum Status {
        COMPLETE,
        PARTIAL,
        NO_DATA,
        UNAVAILABLE
    }

    public record SeasonRef(String seasonId, Instant observedAt) {
        public SeasonRef {
            seasonId = requireText(seasonId, "seasonId");
            Objects.requireNonNull(observedAt, "observedAt");
        }
    }

    public record Coverage(
            int sourceRows,
            int validRows,
            int invalidRows,
            Instant oldest,
            Instant newest
    ) {
        public Coverage {
            if (sourceRows < 0 || validRows < 0 || invalidRows < 0) {
                throw new IllegalArgumentException("coverage counts cannot be negative");
            }
            if (validRows > sourceRows || invalidRows > sourceRows) {
                throw new IllegalArgumentException("coverage counts exceed source rows");
            }
        }

        public static Coverage empty() {
            return new Coverage(0, 0, 0, null, null);
        }
    }

    public record ParsedAttacks(
            List<AttackObservation> observations,
            Coverage coverage
    ) {
        public ParsedAttacks {
            observations = observations == null ? List.of() : List.copyOf(observations);
            Objects.requireNonNull(coverage, "coverage");
        }
    }

    private static String requireText(String value, String field) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isBlank()) throw new IllegalArgumentException(field + " is required");
        return normalized;
    }
}
