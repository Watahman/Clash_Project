package Java.advancedstats;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * Converts one fetched player battle log into durable Advanced Stats events.
 * Scheduling/fetch cadence belongs to Phase 4; this service is intentionally
 * deterministic around one supplied battle-log payload.
 */
public final class AdvancedStatsBattleIngestionService {
    public record IngestionSummary(
            int observed,
            int attacks,
            int inserted,
            int duplicates,
            int parserErrors,
            int ignoredDefenses
    ) {
        public IngestionSummary {
            if (observed < 0 || attacks < 0 || inserted < 0 || duplicates < 0
                    || parserErrors < 0 || ignoredDefenses < 0) {
                throw new IllegalArgumentException("ingestion counters cannot be negative");
            }
            if (attacks + ignoredDefenses != observed) {
                throw new IllegalArgumentException("attack/defense counters must cover observed battles");
            }
            if (inserted + duplicates + parserErrors != attacks) {
                throw new IllegalArgumentException("attack outcomes must cover all attacks");
            }
        }
    }

    private final AdvancedStatsBattleLogParser battleLogParser;
    private final AdvancedStatsBattleProcessor processor;
    private final Clock clock;

    public AdvancedStatsBattleIngestionService() {
        this(new AdvancedStatsBattleLogParser(), new AdvancedStatsBattleProcessor(), Clock.systemUTC());
    }

    AdvancedStatsBattleIngestionService(
            AdvancedStatsBattleLogParser battleLogParser,
            AdvancedStatsBattleProcessor processor,
            Clock clock
    ) {
        this.battleLogParser = Objects.requireNonNull(battleLogParser, "battleLogParser");
        this.processor = Objects.requireNonNull(processor, "processor");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public IngestionSummary ingest(
            AdvancedStatsModels.TrackingState tracking,
            String rawBattleLog,
            boolean bootstrapImport
    ) throws Exception {
        Objects.requireNonNull(tracking, "tracking");
        Instant observedAt = clock.instant();
        List<AdvancedStatsModels.BattleCandidate> battles = battleLogParser.parse(
                tracking.playerTag(),
                rawBattleLog,
                observedAt,
                tracking.townHallLevel()
        );

        int attacks = 0;
        int inserted = 0;
        int duplicates = 0;
        int parserErrors = 0;
        int ignoredDefenses = 0;

        for (AdvancedStatsModels.BattleCandidate battle : battles) {
            AdvancedStatsBattleProcessor.Result result = processor.process(tracking, battle, bootstrapImport);
            switch (result.outcome()) {
                case INSERTED -> {
                    attacks++;
                    inserted++;
                }
                case DUPLICATE -> {
                    attacks++;
                    duplicates++;
                }
                case PARSER_ERROR -> {
                    attacks++;
                    parserErrors++;
                }
                case IGNORED_DEFENSE -> ignoredDefenses++;
            }
        }

        return new IngestionSummary(
                battles.size(),
                attacks,
                inserted,
                duplicates,
                parserErrors,
                ignoredDefenses
        );
    }
}
