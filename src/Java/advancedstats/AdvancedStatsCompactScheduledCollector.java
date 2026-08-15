package Java.advancedstats;

import Java.advancedstats.AdvancedStatsCollectionCoordinator.RunResult;
import Java.advancedstats.AdvancedStatsCollectionModels.BootstrapStatus;
import Java.advancedstats.AdvancedStatsCollectionModels.ScopeState;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Lease-aware compact poll runner; the source payload exists only for the duration of one collection pass. */
public final class AdvancedStatsCompactScheduledCollector {
    @FunctionalInterface
    public interface SourceFactory {
        AdvancedStatsHistorySource create(String workerId) throws Exception;
    }

    public record Settings(int batchSize, int pageSize, int maxBootstrapPages, int leaseSeconds,
                           Duration activeDelay, Duration idleDelay) {
        public Settings {
            if (batchSize < 1 || batchSize > 500) throw new IllegalArgumentException("batchSize must be 1..500");
            if (pageSize < 1 || pageSize > 500) throw new IllegalArgumentException("pageSize must be 1..500");
            if (maxBootstrapPages < 1 || maxBootstrapPages > 1000) {
                throw new IllegalArgumentException("maxBootstrapPages must be 1..1000");
            }
            if (leaseSeconds < 30 || leaseSeconds > 900) throw new IllegalArgumentException("leaseSeconds must be 30..900");
            activeDelay = positive(activeDelay, "activeDelay");
            idleDelay = positive(idleDelay, "idleDelay");
        }

        public static Settings defaults() {
            return new Settings(25, 100, 20, 600, Duration.ofMinutes(15), Duration.ofMinutes(30));
        }

        private static Duration positive(Duration value, String field) {
            Objects.requireNonNull(value, field);
            if (value.isNegative() || value.isZero()) throw new IllegalArgumentException(field + " must be positive");
            return value;
        }
    }

    public record Summary(int claimed, int succeeded, int failed, int processed,
                          int inserted, int duplicates, int skipped, int partialScopes) {
        public Summary {
            if (claimed < 0 || succeeded < 0 || failed < 0 || processed < 0 || inserted < 0
                    || duplicates < 0 || skipped < 0 || partialScopes < 0
                    || inserted + duplicates + skipped > processed
                    || succeeded + failed != claimed) throw new IllegalArgumentException("invalid collector counters");
        }

        public Summary(int claimed, int succeeded, int failed, int processed, int partialScopes) {
            this(claimed, succeeded, failed, processed, 0, 0, 0, partialScopes);
        }
    }

    private final AdvancedStatsScheduledCollector.Store leaseStore;
    private final SourceFactory sourceFactory;
    private final Clock clock;
    private final Settings settings;

    public AdvancedStatsCompactScheduledCollector(AdvancedStatsScheduledCollector.Store leaseStore,
                                                   SourceFactory sourceFactory, Clock clock, Settings settings) {
        this.leaseStore = Objects.requireNonNull(leaseStore, "leaseStore");
        this.sourceFactory = Objects.requireNonNull(sourceFactory, "sourceFactory");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.settings = Objects.requireNonNull(settings, "settings");
    }

    public Summary runOnce() throws Exception {
        Instant claimedAt = clock.instant();
        String workerId = "advanced-stats-compact-" + UUID.randomUUID();
        List<AdvancedStatsModels.TrackingState> trackers = leaseStore.claimDue(
                workerId, claimedAt, settings.batchSize(), settings.leaseSeconds());
        int succeeded = 0;
        int failed = 0;
        int processed = 0;
        int inserted = 0;
        int duplicates = 0;
        int skipped = 0;
        int partial = 0;
        for (AdvancedStatsModels.TrackingState tracker : trackers) {
            try {
                RunResult result = collect(tracker, workerId);
                ensureNoFailedScopes(result);
                Instant finished = clock.instant();
                boolean terminal = result.terminal();
                leaseStore.completeSuccess(tracker.id(), workerId, finished,
                        finished.plus(result.complete() ? settings.activeDelay() : settings.idleDelay()), terminal);
                succeeded++;
                partial += (int) result.scopes().values().stream()
                        .filter(item -> item.status() == BootstrapStatus.PARTIAL
                                || item.status() == BootstrapStatus.UNSUPPORTED).count();
                processed += result.scopes().values().stream()
                        .mapToInt(item -> item.observationsSeen()).sum();
                inserted += result.scopes().values().stream()
                        .mapToInt(item -> item.inserted()).sum();
                duplicates += result.scopes().values().stream()
                        .mapToInt(item -> item.duplicates()).sum();
                skipped += result.scopes().values().stream()
                        .mapToInt(item -> item.skipped()).sum();
            } catch (Exception failure) {
                failed++;
                leaseStore.completeFailure(tracker.id(), workerId, clock.instant(),
                        clock.instant().plus(settings.idleDelay()),
                        AdvancedStatsScheduledCollector.classifyFailure(failure), 3);
            }
        }
        return new Summary(trackers.size(), succeeded, failed, processed, inserted, duplicates, skipped, partial);
    }

    private void ensureNoFailedScopes(RunResult result) {
        boolean failedScope = result.scopes().values().stream()
                .anyMatch(item -> item.status() == BootstrapStatus.FAILED);
        if (failedScope) throw new IllegalStateException("one or more compact scopes failed");
    }

    private RunResult collect(AdvancedStatsModels.TrackingState tracker, String workerId) throws Exception {
        AdvancedStatsHistorySource source = sourceFactory.create(workerId);
        AdvancedStatsCompactRepository compactStore = new AdvancedStatsCompactRepository(workerId);
        prepareRankedSeason(source, compactStore, tracker, workerId);
        AdvancedStatsCollectionCoordinator coordinator = new AdvancedStatsCollectionCoordinator(source, compactStore);
        if (needsBootstrap(compactStore, tracker.id())) {
            return coordinator.bootstrap(tracker.id(), tracker.playerTag(), settings.pageSize(),
                    settings.maxBootstrapPages(), clock.instant());
        }
        return coordinator.incremental(tracker.id(), tracker.playerTag(), settings.pageSize(), clock.instant());
    }

    private void prepareRankedSeason(AdvancedStatsHistorySource source,
                                     AdvancedStatsCompactRepository store,
                                     AdvancedStatsModels.TrackingState tracker,
                                     String workerId) throws Exception {
        String season = source.seasonKey(AdvancedStatsScope.RANKED);
        if (season == null || season.isBlank()) return;
        AdvancedStatsCollectionModels.ScopeState state = store.load(tracker.id(), AdvancedStatsScope.RANKED);
        String current = state == null ? "" : state.sourceSeasonKey();
        if (!season.equals(current)) {
            store.switchRankedSeason(tracker.id(), tracker.playerTag(), workerId, current, season, clock.instant());
        }
    }

    private boolean needsBootstrap(AdvancedStatsCompactRepository store, UUID trackingId) throws Exception {
        for (AdvancedStatsScope scope : EnumSet.allOf(AdvancedStatsScope.class)) {
            ScopeState state = store.load(trackingId, scope);
            if (state == null || !state.bootstrapped()) return true;
        }
        return false;
    }
}
