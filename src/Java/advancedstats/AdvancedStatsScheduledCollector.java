package Java.advancedstats;

import Java.HttpException;

import java.io.IOException;
import java.net.SocketTimeoutException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Bounded, lease-based collection pass for Advanced Stats.
 *
 * Cloud Scheduler (or another external scheduler) should trigger this service.
 * No in-memory timer is required for correctness.
 */
public final class AdvancedStatsScheduledCollector {
    public enum FailureReason {
        RATE_LIMIT("RATE_LIMIT"),
        API_OUTAGE("API_OUTAGE"),
        UNKNOWN("UNKNOWN");

        private final String databaseValue;

        FailureReason(String databaseValue) {
            this.databaseValue = databaseValue;
        }

        public String databaseValue() {
            return databaseValue;
        }
    }

    public record Settings(
            int batchSize,
            int leaseSeconds,
            Duration activePollDelay,
            Duration idlePollDelay,
            Duration rateLimitBackoffBase,
            Duration outageBackoffBase,
            Duration unknownBackoffBase,
            Duration maxBackoff,
            int degradedThreshold
    ) {
        public Settings {
            if (batchSize < 1 || batchSize > 500) throw new IllegalArgumentException("batchSize must be 1..500");
            if (leaseSeconds < 30 || leaseSeconds > 900) throw new IllegalArgumentException("leaseSeconds must be 30..900");
            activePollDelay = positive(activePollDelay, "activePollDelay");
            idlePollDelay = positive(idlePollDelay, "idlePollDelay");
            rateLimitBackoffBase = positive(rateLimitBackoffBase, "rateLimitBackoffBase");
            outageBackoffBase = positive(outageBackoffBase, "outageBackoffBase");
            unknownBackoffBase = positive(unknownBackoffBase, "unknownBackoffBase");
            maxBackoff = positive(maxBackoff, "maxBackoff");
            if (degradedThreshold < 2 || degradedThreshold > 20) {
                throw new IllegalArgumentException("degradedThreshold must be 2..20");
            }
        }

        public static Settings defaults() {
            return new Settings(
                    50,
                    120,
                    Duration.ofMinutes(15),
                    Duration.ofMinutes(30),
                    Duration.ofMinutes(30),
                    Duration.ofMinutes(10),
                    Duration.ofMinutes(15),
                    Duration.ofHours(4),
                    3
            );
        }

        private static Duration positive(Duration value, String field) {
            Objects.requireNonNull(value, field);
            if (value.isZero() || value.isNegative()) throw new IllegalArgumentException(field + " must be positive");
            return value;
        }
    }

    public record BatchSummary(
            int claimed,
            int succeeded,
            int failed,
            int insertedBattles,
            int duplicateBattles,
            int parserErrors,
            int rateLimited,
            int finalizeFailures
    ) {
        public BatchSummary {
            if (claimed < 0 || succeeded < 0 || failed < 0 || insertedBattles < 0
                    || duplicateBattles < 0 || parserErrors < 0 || rateLimited < 0
                    || finalizeFailures < 0) {
                throw new IllegalArgumentException("collector counters cannot be negative");
            }
            if (succeeded + failed != claimed) {
                throw new IllegalArgumentException("success/failure counters must cover claimed trackers");
            }
        }
    }

    public interface Store {
        List<AdvancedStatsModels.TrackingState> claimDue(
                String workerId,
                Instant now,
                int limit,
                int leaseSeconds
        ) throws Exception;

        void completeSuccess(
                UUID trackingId,
                String workerId,
                Instant now,
                Instant nextPollAt,
                boolean bootstrapCompleted
        ) throws Exception;

        void completeFailure(
                UUID trackingId,
                String workerId,
                Instant now,
                Instant nextPollAt,
                FailureReason reason,
                int degradedThreshold
        ) throws Exception;
    }

    @FunctionalInterface
    public interface BattleLogSource {
        String fetchFresh(String playerTag) throws Exception;
    }

    @FunctionalInterface
    public interface Ingestion {
        AdvancedStatsBattleIngestionService.IngestionSummary ingest(
                AdvancedStatsModels.TrackingState tracking,
                String rawBattleLog,
                boolean bootstrapImport
        ) throws Exception;
    }

    private final Store store;
    private final BattleLogSource source;
    private final Ingestion ingestion;
    private final Clock clock;
    private final Settings settings;

    public AdvancedStatsScheduledCollector(
            Store store,
            BattleLogSource source,
            Ingestion ingestion,
            Clock clock,
            Settings settings
    ) {
        this.store = Objects.requireNonNull(store, "store");
        this.source = Objects.requireNonNull(source, "source");
        this.ingestion = Objects.requireNonNull(ingestion, "ingestion");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.settings = Objects.requireNonNull(settings, "settings");
    }

    public BatchSummary runOnce() throws Exception {
        Instant claimTime = clock.instant();
        String workerId = "advanced-stats-" + UUID.randomUUID();
        List<AdvancedStatsModels.TrackingState> claimed = store.claimDue(
                workerId,
                claimTime,
                settings.batchSize(),
                settings.leaseSeconds()
        );

        int succeeded = 0;
        int failed = 0;
        int inserted = 0;
        int duplicates = 0;
        int parserErrors = 0;
        int rateLimited = 0;
        int finalizeFailures = 0;

        for (AdvancedStatsModels.TrackingState tracking : claimed) {
            try {
                String rawBattleLog = source.fetchFresh(tracking.playerTag());
                boolean bootstrap = tracking.bootstrapCompletedAt() == null;
                AdvancedStatsBattleIngestionService.IngestionSummary result = ingestion.ingest(
                        tracking,
                        rawBattleLog,
                        bootstrap
                );

                Instant completedAt = clock.instant();
                Duration delay = result.inserted() > 0
                        ? settings.activePollDelay()
                        : settings.idlePollDelay();
                store.completeSuccess(
                        tracking.id(),
                        workerId,
                        completedAt,
                        completedAt.plus(delay),
                        bootstrap
                );

                succeeded++;
                inserted += result.inserted();
                duplicates += result.duplicates();
                parserErrors += result.parserErrors();
            } catch (Exception failure) {
                failed++;
                FailureReason reason = classifyFailure(failure);
                if (reason == FailureReason.RATE_LIMIT) rateLimited++;

                int failureNumber = Math.max(1, tracking.consecutiveFailures() + 1);
                Instant failedAt = clock.instant();
                Duration backoff = failureBackoff(reason, failureNumber, settings);
                try {
                    store.completeFailure(
                            tracking.id(),
                            workerId,
                            failedAt,
                            failedAt.plus(backoff),
                            reason,
                            settings.degradedThreshold()
                    );
                } catch (Exception finalizeFailure) {
                    finalizeFailures++;
                    System.err.printf(
                            "advanced_stats_poll_finalize_failed tracking=%s error=%s%n",
                            tracking.id(),
                            finalizeFailure.getClass().getSimpleName()
                    );
                }

                System.err.printf(
                        "advanced_stats_poll_failed tracking=%s reason=%s error=%s%n",
                        tracking.id(),
                        reason.databaseValue(),
                        failure.getClass().getSimpleName()
                );
            }
        }

        return new BatchSummary(
                claimed.size(),
                succeeded,
                failed,
                inserted,
                duplicates,
                parserErrors,
                rateLimited,
                finalizeFailures
        );
    }

    static FailureReason classifyFailure(Exception failure) {
        Throwable current = failure;
        while (current != null) {
            if (current instanceof HttpException http) {
                boolean clash = "Clash API".equalsIgnoreCase(http.getUpstream());
                if (clash && http.getStatusCode() == 429) return FailureReason.RATE_LIMIT;
                if (clash && http.getStatusCode() >= 500) return FailureReason.API_OUTAGE;
                if (clash && (http.getStatusCode() == 401 || http.getStatusCode() == 403)) {
                    return FailureReason.API_OUTAGE;
                }
            }
            if (current instanceof SocketTimeoutException || current instanceof IOException) {
                return FailureReason.API_OUTAGE;
            }
            current = current.getCause();
        }
        return FailureReason.UNKNOWN;
    }

    static Duration failureBackoff(FailureReason reason, int failureNumber, Settings settings) {
        Duration base = switch (reason) {
            case RATE_LIMIT -> settings.rateLimitBackoffBase();
            case API_OUTAGE -> settings.outageBackoffBase();
            case UNKNOWN -> settings.unknownBackoffBase();
        };

        int exponent = Math.max(0, Math.min(failureNumber - 1, 8));
        long multiplier = 1L << exponent;
        Duration candidate;
        try {
            candidate = base.multipliedBy(multiplier);
        } catch (ArithmeticException overflow) {
            candidate = settings.maxBackoff();
        }
        return candidate.compareTo(settings.maxBackoff()) > 0
                ? settings.maxBackoff()
                : candidate;
    }
}
