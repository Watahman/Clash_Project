package Java.advancedstats;

import java.util.Objects;
import java.util.UUID;

/**
 * Turns one observed battle-log entry into one durable Advanced Stats event.
 * The Store implementation owns the transaction and the database unique
 * fingerprint remains the final concurrency/deduplication guard.
 */
public final class AdvancedStatsBattleProcessor {
    public static final int PARSER_VERSION = 1;

    public interface Store {
        AdvancedStatsModels.SaveBattleResult saveProcessedBattle(
                UUID trackingId,
                AdvancedStatsModels.BattleCandidate battle,
                String fingerprint,
                AdvancedStatsModels.ParsedArmy army,
                boolean bootstrapImport,
                int parserVersion
        ) throws Exception;

        boolean recordParserError(
                UUID trackingId,
                AdvancedStatsModels.BattleCandidate battle,
                String fingerprint,
                boolean bootstrapImport,
                int parserVersion
        ) throws Exception;

        default AdvancedStatsModels.SaveBattleResult saveProcessedBattleWithLease(
                UUID trackingId, AdvancedStatsModels.BattleCandidate battle, String fingerprint,
                AdvancedStatsModels.ParsedArmy army, boolean bootstrapImport, int parserVersion,
                String workerId
        ) throws Exception {
            return saveProcessedBattle(trackingId, battle, fingerprint, army, bootstrapImport, parserVersion);
        }

        default boolean recordParserErrorWithLease(
                UUID trackingId, AdvancedStatsModels.BattleCandidate battle, String fingerprint,
                boolean bootstrapImport, int parserVersion, String workerId
        ) throws Exception {
            return recordParserError(trackingId, battle, fingerprint, bootstrapImport, parserVersion);
        }
    }

    public enum Outcome {
        INSERTED,
        DUPLICATE,
        PARSER_ERROR,
        IGNORED_DEFENSE
    }

    public record Result(Outcome outcome, String fingerprint, UUID battleId) {
        public Result {
            Objects.requireNonNull(outcome, "outcome");
            fingerprint = fingerprint == null ? "" : fingerprint;
            if (outcome == Outcome.INSERTED && battleId == null) {
                throw new IllegalArgumentException("inserted result requires battleId");
            }
        }
    }

    private final Store store;
    private final ArmyShareCodeParser armyParser;

    public AdvancedStatsBattleProcessor() {
        this(new AdvancedStatsRepository(), new ArmyShareCodeParser());
    }

    AdvancedStatsBattleProcessor(Store store, ArmyShareCodeParser armyParser) {
        this.store = Objects.requireNonNull(store, "store");
        this.armyParser = Objects.requireNonNull(armyParser, "armyParser");
    }

    public Result process(
            AdvancedStatsModels.TrackingState tracking,
            AdvancedStatsModels.BattleCandidate battle,
            boolean bootstrapImport
    ) throws Exception {
        return process(tracking, battle, bootstrapImport, null);
    }

    public Result process(
            AdvancedStatsModels.TrackingState tracking,
            AdvancedStatsModels.BattleCandidate battle,
            boolean bootstrapImport,
            String workerId
    ) throws Exception {
        Objects.requireNonNull(tracking, "tracking");
        Objects.requireNonNull(battle, "battle");
        if (!tracking.playerTag().equals(battle.playerTag())) {
            throw new IllegalArgumentException("Battle player does not match tracking player");
        }
        if (!battle.attack()) {
            return new Result(Outcome.IGNORED_DEFENSE, "", null);
        }

        String fingerprint = BattleFingerprint.from(battle);
        AdvancedStatsModels.ParsedArmy army;
        if (battle.armyShareCode().isBlank()) {
            army = AdvancedStatsModels.ParsedArmy.unavailable();
        } else {
            try {
                army = armyParser.parse(battle.armyShareCode());
            } catch (ArmyShareCodeParser.ArmyParseException parseFailure) {
                store.recordParserErrorWithLease(
                        tracking.id(),
                        battle,
                        fingerprint,
                        bootstrapImport,
                        PARSER_VERSION,
                        workerId
                );
                System.err.printf(
                        "[advanced-stats] parser_error tracking=%s fingerprint=%s parser=%d%n",
                        tracking.id(),
                        fingerprint,
                        PARSER_VERSION
                );
                return new Result(Outcome.PARSER_ERROR, fingerprint, null);
            }
        }

        AdvancedStatsModels.SaveBattleResult saved = store.saveProcessedBattleWithLease(
                tracking.id(),
                battle,
                fingerprint,
                army,
                bootstrapImport,
                PARSER_VERSION,
                workerId
        );
        if (!saved.inserted()) {
            return new Result(Outcome.DUPLICATE, fingerprint, null);
        }
        return new Result(Outcome.INSERTED, fingerprint, saved.battleId());
    }
}
