package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.AttackObservation;
import Java.advancedstats.AdvancedStatsHistoryModels.Checkpoint;
import Java.advancedstats.AdvancedStatsHistoryModels.Coverage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryPage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;
import Java.advancedstats.AdvancedStatsHistoryModels.Provenance;
import Java.performance.HistoricalAttack;
import Java.performance.HistoricalPlayerData;
import Java.performance.HistoricalPlayerDataProvider;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/** Adapts the existing provider contract to compact war observations without persisting provider payloads. */
public final class HistoricalPlayerDataAdvancedStatsSource implements AdvancedStatsHistorySource {
    private final HistoricalPlayerDataProvider provider;
    private final AdvancedStatsSourceCapabilities capabilities;

    public HistoricalPlayerDataAdvancedStatsSource(HistoricalPlayerDataProvider provider) {
        this.provider = java.util.Objects.requireNonNull(provider, "provider");
        this.capabilities = new AdvancedStatsSourceCapabilities(List.of(
                capability(AdvancedStatsScope.WAR, AdvancedStatsCapabilityOperation.BOOTSTRAP),
                capability(AdvancedStatsScope.WAR, AdvancedStatsCapabilityOperation.INCREMENTAL),
                unsupported(AdvancedStatsScope.NORMAL, AdvancedStatsCapabilityOperation.BOOTSTRAP,
                        "provider has no normal multiplayer history contract"),
                unsupported(AdvancedStatsScope.NORMAL, AdvancedStatsCapabilityOperation.INCREMENTAL,
                        "provider has no normal incremental cursor"),
                unsupported(AdvancedStatsScope.RANKED, AdvancedStatsCapabilityOperation.BOOTSTRAP,
                        "provider has no ranked attack-event contract"),
                unsupported(AdvancedStatsScope.RANKED, AdvancedStatsCapabilityOperation.INCREMENTAL,
                        "provider has no ranked incremental cursor")
        ));
    }

    @Override
    public String sourceId() {
        return provider.providerName();
    }

    @Override
    public AdvancedStatsSourceCapabilities capabilities() {
        return capabilities;
    }

    @Override
    public HistoryPage fetch(HistoryRequest request) throws Exception {
        if (request.scope() != AdvancedStatsScope.WAR) {
            throw new UnsupportedOperationException("historical provider only supports war observations");
        }
        Map<String, HistoricalPlayerData> data = provider.getPlayerWarHistory(List.of(request.playerTag()));
        HistoricalPlayerData player = data.get(request.playerTag());
        Provenance provenance = new Provenance(sourceId(), "historical-provider-v1", request.requestedAt(),
                "war endpoint has no upstream cursor; local watermark and receipts provide overlap safety");
        if (player == null || !player.available()) {
            return new HistoryPage(List.of(), request.checkpoint(), false, Coverage.UNAVAILABLE, provenance);
        }
        List<AttackObservation> observations = observations(player.attacks(), request);
        Checkpoint next = nextCheckpoint(observations, request.checkpoint());
        return new HistoryPage(observations, next, false, Coverage.PARTIAL, provenance);
    }

    private List<AttackObservation> observations(List<HistoricalAttack> attacks, HistoryRequest request) {
        List<AttackObservation> result = new ArrayList<>();
        for (int index = 0; index < attacks.size(); index++) {
            HistoricalAttack attack = attacks.get(index);
            Instant occurredAt = attack.warEndTime() == null ? request.requestedAt() : attack.warEndTime();
            String eventKey = eventKey(attack, index);
            if (!afterCheckpoint(occurredAt, eventKey, request.checkpoint())) continue;
            result.add(new AttackObservation(eventKey, AdvancedStatsScope.WAR, occurredAt, true, "war", "",
                    positiveOrNull(attack.attackerTownHall()), positiveOrNull(attack.defenderTownHall()),
                    attack.stars(), attack.destruction(), List.of(), 0, 0, 0));
        }
        return List.copyOf(result);
    }

    private Checkpoint nextCheckpoint(List<AttackObservation> observations, Checkpoint fallback) {
        return observations.stream()
                .max(Comparator.comparing(AttackObservation::occurredAt).thenComparing(AttackObservation::eventKey))
                .map(last -> new Checkpoint("", last.occurredAt(), last.eventKey()))
                .orElse(fallback);
    }

    private boolean afterCheckpoint(Instant occurredAt, String eventKey, Checkpoint checkpoint) {
        if (checkpoint == null || !checkpoint.present() || checkpoint.watermark() == null) return true;
        int time = occurredAt.compareTo(checkpoint.watermark());
        return time > 0 || (time == 0 && eventKey.compareTo(checkpoint.watermarkKey()) > 0);
    }

    private String eventKey(HistoricalAttack attack, int index) {
        String war = attack.warId() == null || attack.warId().isBlank() ? "unknown" : attack.warId();
        String order = attack.attackOrder() == null ? String.format("%08d", index)
                : String.format("%08d", attack.attackOrder());
        return "war:" + war + ":attack:" + order;
    }

    private Integer positiveOrNull(int value) {
        return value > 0 ? value : null;
    }

    private AdvancedStatsCapability capability(AdvancedStatsScope scope,
                                               AdvancedStatsCapabilityOperation operation) {
        return new AdvancedStatsCapability(scope, operation, AdvancedStatsCapabilityStatus.PARTIAL,
                sourceId(), "provider history has no upstream cursor or complete coverage guarantee");
    }

    private AdvancedStatsCapability unsupported(AdvancedStatsScope scope,
                                                AdvancedStatsCapabilityOperation operation, String reason) {
        return new AdvancedStatsCapability(scope, operation, AdvancedStatsCapabilityStatus.UNSUPPORTED, sourceId(), reason);
    }
}
