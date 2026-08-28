package Java.performance;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class PlayerPerformanceCalculator {
    static final int MIN_CWL_ATTACKS = 5;
    static final double HALF_LIFE_DAYS = 45;
    private static final int BASELINE_DAYS = 90;
    private static final int RECENT_ATTACKS = 10;

    private final Clock clock;

    public PlayerPerformanceCalculator() {
        this(Clock.systemUTC());
    }

    PlayerPerformanceCalculator(Clock clock) {
        this.clock = clock;
    }

    public PlayerPerformanceResult calculate(HistoricalPlayerData data) {
        Instant now = clock.instant();
        List<HistoricalAttack> valid = data.attacks().stream()
                .filter(this::hasReliableAttackFields)
                .filter(attack -> !attack.warEndTime().isAfter(now.plus(1, ChronoUnit.DAYS)))
                .sorted(Comparator.comparing(HistoricalAttack::warEndTime).reversed())
                .toList();
        Instant cutoff = now.minus(BASELINE_DAYS, ChronoUnit.DAYS);
        List<HistoricalAttack> recent = valid.stream()
                .filter(attack -> !attack.warEndTime().isBefore(cutoff))
                .toList();
        List<HistoricalAttack> cwl = recent.stream()
                .filter(attack -> attack.warType() == HistoricalWarType.CWL)
                .toList();
        boolean useCwl = cwl.size() >= MIN_CWL_ATTACKS;
        String scope = useCwl ? "CWL" : "All wars";
        List<HistoricalAttack> baseline = useCwl ? cwl : recent;

        if (!data.available() || baseline.isEmpty()) {
            return emptyResult(data, scope, data.available() ? "not_enough_data" : "unavailable");
        }

        double rawPerformance = weightedPerformance(baseline, now);
        double performance = clamp(rawPerformance, 0, 100);
        PlayerPerformanceResult.Form form = calculateForm(baseline, rawPerformance, now);
        Reliability reliability = calculateReliability(data, useCwl, cutoff, now);
        long triples = baseline.stream().filter(attack -> attack.stars() == 3).count();
        long twoStars = baseline.stream().filter(attack -> attack.stars() == 2).count();
        long lowStars = baseline.stream().filter(attack -> attack.stars() <= 1).count();
        int same = 0;
        int up = 0;
        int down = 0;
        for (HistoricalAttack attack : baseline) {
            if (attack.attackerTownHall() == attack.defenderTownHall()) same++;
            else if (attack.attackerTownHall() < attack.defenderTownHall()) up++;
            else down++;
        }

        Instant oldest = baseline.stream().map(HistoricalAttack::warEndTime).min(Instant::compareTo).orElse(now);
        Instant newest = baseline.stream().map(HistoricalAttack::warEndTime).max(Instant::compareTo).orElse(now);
        int coverageDays = Math.max(1, (int) Duration.between(oldest, newest).toDays() + 1);
        int count = baseline.size();
        return new PlayerPerformanceResult(
                data.playerTag(),
                "ready",
                scope,
                round(performance, 1),
                form,
                reliability.percentage,
                reliability.used,
                reliability.available,
                reliability.message,
                round(baseline.stream().mapToInt(HistoricalAttack::stars).average().orElse(0), 2),
                round(baseline.stream().mapToDouble(HistoricalAttack::destruction).average().orElse(0), 1),
                percentage(triples, count),
                percentage(twoStars, count),
                percentage(lowStars, count),
                count,
                same,
                up,
                down,
                confidence(count),
                new PlayerPerformanceResult.Coverage(
                        count, coverageDays, oldest.toString(), newest.toString()
                ),
                data.source()
        );
    }

    private boolean hasReliableAttackFields(HistoricalAttack attack) {
        return attack != null
                && attack.warEndTime() != null
                && attack.stars() >= 0 && attack.stars() <= 3
                && attack.destruction() >= 0 && attack.destruction() <= 100;
    }

    private double weightedPerformance(List<HistoricalAttack> attacks, Instant now) {
        double weightedTotal = 0;
        double weightTotal = 0;
        for (HistoricalAttack attack : attacks) {
            double weight = recencyWeight(attack.warEndTime(), now);
            weightedTotal += MatchupDifficulty.adjustedAttackQuality(attack) * weight;
            weightTotal += weight;
        }
        return weightTotal == 0 ? 0 : weightedTotal / weightTotal;
    }

    private PlayerPerformanceResult.Form calculateForm(
            List<HistoricalAttack> baseline,
            double baselinePerformance,
            Instant now
    ) {
        if (baseline.size() < 5) return new PlayerPerformanceResult.Form(null, "not_enough_data");
        List<HistoricalAttack> recent = new ArrayList<>(
                baseline.subList(0, Math.min(RECENT_ATTACKS, baseline.size()))
        );
        double delta = weightedPerformance(recent, now) - baselinePerformance;
        String trend = delta >= 8 ? "strong" : delta <= -8 ? "declining" : "stable";
        return new PlayerPerformanceResult.Form(round(delta, 1), trend);
    }

    private Reliability calculateReliability(
            HistoricalPlayerData data,
            boolean cwlOnly,
            Instant cutoff,
            Instant now
    ) {
        List<HistoricalParticipation> entries = data.participation().stream()
                .filter(HistoricalParticipation::reliable)
                .filter(item -> item.warEndTime() != null && !item.warEndTime().isBefore(cutoff))
                .filter(item -> !cwlOnly || item.warType() == HistoricalWarType.CWL)
                .filter(item -> item.availableAttacks() > 0 && item.usedAttacks() >= 0)
                .toList();
        if (entries.isEmpty()) {
            return new Reliability(null, null, null, "insufficient_tracked_participation");
        }

        double weightedUsed = 0;
        double weightedAvailable = 0;
        int used = 0;
        int available = 0;
        for (HistoricalParticipation entry : entries) {
            double weight = recencyWeight(entry.warEndTime(), now);
            weightedUsed += Math.min(entry.usedAttacks(), entry.availableAttacks()) * weight;
            weightedAvailable += entry.availableAttacks() * weight;
            used += Math.min(entry.usedAttacks(), entry.availableAttacks());
            available += entry.availableAttacks();
        }
        Double percentage = weightedAvailable == 0
                ? null
                : round(100 * weightedUsed / weightedAvailable, 1);
        return new Reliability(percentage, used, available, percentage == null ? "insufficient_tracked_participation" : "");
    }

    private double recencyWeight(Instant timestamp, Instant now) {
        double daysAgo = Math.max(0, Duration.between(timestamp, now).toHours() / 24.0);
        return Math.pow(0.5, daysAgo / HALF_LIFE_DAYS);
    }

    private PlayerPerformanceResult emptyResult(HistoricalPlayerData data, String scope, String status) {
        return new PlayerPerformanceResult(
                data.playerTag(), status, scope, null,
                new PlayerPerformanceResult.Form(null, "not_enough_data"),
                null, null, null, "insufficient_tracked_participation",
                null, null, null, null, null, 0, 0, 0, 0,
                "Low", new PlayerPerformanceResult.Coverage(0, 0, null, null), data.source()
        );
    }

    private static String confidence(int attacks) {
        if (attacks >= 15) return "High";
        if (attacks >= 5) return "Medium";
        return "Low";
    }

    private static Double percentage(long value, long total) {
        return total == 0 ? null : round(100.0 * value / total, 1);
    }

    private static double round(double value, int places) {
        double factor = Math.pow(10, places);
        return Math.round(value * factor) / factor;
    }

    private static double clamp(double value, double minimum, double maximum) {
        return Math.min(maximum, Math.max(minimum, value));
    }

    private record Reliability(Double percentage, Integer used, Integer available, String message) {}
}
