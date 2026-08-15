package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.AttackObservation;
import Java.advancedstats.AdvancedStatsHistoryModels.Checkpoint;
import Java.advancedstats.AdvancedStatsHistoryModels.Coverage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryPage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;
import Java.advancedstats.AdvancedStatsHistoryModels.Provenance;
import Java.advancedstats.AdvancedStatsHistoryModels.UnitObservation;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Converts the rolling CoC battle-log proxy into partial normal-scope observations. */
public final class AdvancedStatsBattleLogHistorySource implements AdvancedStatsHistorySource {
    @FunctionalInterface
    public interface Fetcher {
        String fetch(String playerTag) throws Exception;
    }

    private final Fetcher fetcher;
    private final AdvancedStatsBattleLogParser parser;
    private final ArmyShareCodeParser armyParser;
    private final AdvancedStatsSourceCapabilities capabilities;

    public AdvancedStatsBattleLogHistorySource(Fetcher fetcher) {
        this(fetcher, new AdvancedStatsBattleLogParser(), new ArmyShareCodeParser());
    }

    AdvancedStatsBattleLogHistorySource(Fetcher fetcher, AdvancedStatsBattleLogParser parser,
                                        ArmyShareCodeParser armyParser) {
        this.fetcher = java.util.Objects.requireNonNull(fetcher, "fetcher");
        this.parser = java.util.Objects.requireNonNull(parser, "parser");
        this.armyParser = java.util.Objects.requireNonNull(armyParser, "armyParser");
        this.capabilities = new AdvancedStatsSourceCapabilities(List.of(
                capability(AdvancedStatsScope.NORMAL, AdvancedStatsCapabilityOperation.BOOTSTRAP),
                capability(AdvancedStatsScope.NORMAL, AdvancedStatsCapabilityOperation.INCREMENTAL),
                unsupported(AdvancedStatsScope.WAR, AdvancedStatsCapabilityOperation.BOOTSTRAP,
                        "battlelog proxy is not a war-history source"),
                unsupported(AdvancedStatsScope.WAR, AdvancedStatsCapabilityOperation.INCREMENTAL,
                        "battlelog proxy is not a war-history source"),
                unsupported(AdvancedStatsScope.RANKED, AdvancedStatsCapabilityOperation.BOOTSTRAP,
                        "battlelog proxy does not expose ranked attack history"),
                unsupported(AdvancedStatsScope.RANKED, AdvancedStatsCapabilityOperation.INCREMENTAL,
                        "battlelog proxy does not expose ranked attack history")
        ));
    }

    @Override
    public String sourceId() {
        return "coc-battlelog";
    }

    @Override
    public AdvancedStatsSourceCapabilities capabilities() {
        return capabilities;
    }

    @Override
    public HistoryPage fetch(HistoryRequest request) throws Exception {
        if (request.scope() != AdvancedStatsScope.NORMAL) {
            throw new UnsupportedOperationException("battlelog source only supports normal observations");
        }
        String raw = fetcher.fetch(request.playerTag());
        List<AdvancedStatsModels.BattleCandidate> candidates = parser.parse(
                request.playerTag(), raw, request.requestedAt(), null);
        List<AttackObservation> observations = new ArrayList<>();
        for (AdvancedStatsModels.BattleCandidate candidate : candidates) {
            AttackObservation observation = toObservation(candidate);
            if (afterCheckpoint(observation, request.checkpoint())) observations.add(observation);
        }
        Checkpoint next = nextCheckpoint(observations, request.checkpoint());
        return new HistoryPage(observations, next, false, Coverage.PARTIAL,
                new Provenance(sourceId(), "battlelog-proxy-v1", request.requestedAt(),
                        "rolling battlelog; absence of upstream history is reported as PARTIAL"));
    }

    private AttackObservation toObservation(AdvancedStatsModels.BattleCandidate candidate) {
        List<UnitObservation> units = parseUnits(candidate.armyShareCode());
        return new AttackObservation(BattleFingerprint.from(candidate), AdvancedStatsScope.NORMAL,
                candidate.effectiveTimestamp(), candidate.attack(), candidate.battleType(),
                candidate.opponentPlayerTag(), candidate.playerTownHall(), candidate.opponentTownHall(),
                candidate.stars(), candidate.destructionPercentage(), units, candidate.lootGold(),
                candidate.lootElixir(), candidate.lootDarkElixir());
    }

    private List<UnitObservation> parseUnits(String armyShareCode) {
        if (armyShareCode == null || armyShareCode.isBlank()) return List.of();
        try {
            return armyParser.parse(armyShareCode).units().stream()
                    .map(unit -> new UnitObservation(unit.unitKey(), unit.unitName(), unit.category(),
                            unit.quantity(), unit.unitLevel()))
                    .toList();
        } catch (Exception invalidArmy) {
            return List.of();
        }
    }

    private Checkpoint nextCheckpoint(List<AttackObservation> observations, Checkpoint fallback) {
        return observations.stream()
                .max(Comparator.comparing(AttackObservation::occurredAt).thenComparing(AttackObservation::eventKey))
                .map(last -> new Checkpoint("", last.occurredAt(), last.eventKey()))
                .orElse(fallback);
    }

    private boolean afterCheckpoint(AttackObservation observation, Checkpoint checkpoint) {
        if (checkpoint == null || !checkpoint.present() || checkpoint.watermark() == null) return true;
        int time = observation.occurredAt().compareTo(checkpoint.watermark());
        return time > 0 || (time == 0 && observation.eventKey().compareTo(checkpoint.watermarkKey()) > 0);
    }

    private AdvancedStatsCapability capability(AdvancedStatsScope scope,
                                               AdvancedStatsCapabilityOperation operation) {
        return new AdvancedStatsCapability(scope, operation, AdvancedStatsCapabilityStatus.PARTIAL,
                sourceId(), "rolling source has no complete historical coverage guarantee");
    }

    private AdvancedStatsCapability unsupported(AdvancedStatsScope scope,
                                                AdvancedStatsCapabilityOperation operation, String reason) {
        return new AdvancedStatsCapability(scope, operation, AdvancedStatsCapabilityStatus.UNSUPPORTED,
                sourceId(), reason);
    }
}
