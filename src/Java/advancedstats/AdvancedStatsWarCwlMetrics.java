package Java.advancedstats;

import Java.performance.HistoricalAttack;
import Java.performance.HistoricalParticipation;
import Java.performance.MatchupDifficulty;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.time.DayOfWeek;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Pure aggregation of normalized war observations. */
final class AdvancedStatsWarCwlMetrics {
    private AdvancedStatsWarCwlMetrics() {}

    static AttackMetrics aggregate(
            List<HistoricalAttack> rawAttacks,
            List<HistoricalParticipation> rawParticipation,
            Instant from,
            Instant now,
            boolean allowUntimed
    ) {
        List<HistoricalAttack> attacks = rawAttacks == null ? List.of() : rawAttacks.stream()
                .filter(attack -> validAttack(attack, from, now, allowUntimed))
                .toList();
        List<HistoricalParticipation> participation = rawParticipation == null
                ? List.of() : rawParticipation.stream()
                .filter(item -> validParticipation(item, from, now, allowUntimed))
                .toList();
        List<String> unknown = new ArrayList<>();
        Integer available = null;
        Integer used = null;
        Integer missed = null;
        if (!participation.isEmpty()) {
            boolean reliable = participation.stream().allMatch(AdvancedStatsWarCwlMetrics::reliable);
            if (reliable) {
                available = participation.stream().mapToInt(item -> item.availableAttacks()).sum();
                used = participation.stream().mapToInt(item -> Math.min(
                        item.usedAttacks(), item.availableAttacks())).sum();
                missed = Math.max(0, available - used);
            } else {
                unknown.add("participation_incomplete");
            }
        } else if (!attacks.isEmpty()) {
            unknown.add("participation_unavailable");
        }

        Set<String> wars = new LinkedHashSet<>();
        attacks.forEach(attack -> addWarKey(wars, attack.warId(), attack.warEndTime()));
        participation.forEach(item -> addWarKey(wars, item.warId(), item.warEndTime()));
        StarBuckets stars = attacks.isEmpty() ? null : starBuckets(attacks);
        Matchups matchups = matchups(attacks, unknown);
        Trend trend = trend(attacks, from, now);
        if (attacks.isEmpty() && participation.isEmpty()) {
            return new AttackMetrics(
                    "no_data", null, available, used, missed, null, null, null,
                    stars, null, null, null, matchups, trend, List.copyOf(unknown)
            );
        }
        Double avgStars = averageStars(attacks);
        Double avgDestruction = averageDestruction(attacks);
        Integer attackCount = attacks.isEmpty() ? 0 : attacks.size();
        Double tripleRate = attacks.isEmpty() ? null : percentage(stars.three(), attacks.size());
        Double offensive = attacks.isEmpty() ? null : round(attacks.stream()
                .mapToDouble(MatchupDifficulty::adjustedAttackQuality).average().orElse(0), 1);
        unknown.add("defensive_performance_unavailable");
        return new AttackMetrics(
                "ready", nullableCount(wars.size()), available, used, missed, attackCount,
                avgStars, avgDestruction, stars, tripleRate, offensive, null, matchups, trend,
                List.copyOf(new LinkedHashSet<>(unknown))
        );
    }

    private static boolean validAttack(
            HistoricalAttack attack, Instant from, Instant now, boolean allowUntimed
    ) {
        if (attack == null || attack.stars() < 0 || attack.stars() > 3
                || attack.destruction() < 0 || attack.destruction() > 100) return false;
        return inWindow(attack.warEndTime(), from, now, allowUntimed);
    }

    private static boolean validParticipation(
            HistoricalParticipation item, Instant from, Instant now, boolean allowUntimed
    ) {
        if (item == null || item.availableAttacks() <= 0 || item.usedAttacks() < 0) return false;
        return inWindow(item.warEndTime(), from, now, allowUntimed);
    }

    private static boolean inWindow(Instant timestamp, Instant from, Instant now, boolean allowUntimed) {
        if (timestamp == null) return allowUntimed;
        if (from != null && timestamp.isBefore(from)) return false;
        return now == null || !timestamp.isAfter(now.plus(Duration.ofDays(1)));
    }

    private static boolean reliable(HistoricalParticipation item) {
        return item.reliable() && item.availableAttacks() > 0 && item.usedAttacks() >= 0;
    }

    private static void addWarKey(Set<String> wars, String warId, Instant timestamp) {
        if (warId != null && !warId.isBlank()) wars.add(warId);
        else if (timestamp != null) wars.add("at:" + timestamp);
    }

    private static StarBuckets starBuckets(List<HistoricalAttack> attacks) {
        int zero = 0;
        int one = 0;
        int two = 0;
        int three = 0;
        for (HistoricalAttack attack : attacks) {
            switch (attack.stars()) {
                case 0 -> zero++;
                case 1 -> one++;
                case 2 -> two++;
                case 3 -> three++;
                default -> { }
            }
        }
        return new StarBuckets(zero, one, two, three);
    }

    private static Matchups matchups(List<HistoricalAttack> attacks, List<String> unknown) {
        int known = 0;
        int same = 0;
        int up = 0;
        int down = 0;
        for (HistoricalAttack attack : attacks) {
            if (attack.attackerTownHall() <= 0 || attack.defenderTownHall() <= 0) continue;
            known++;
            if (attack.attackerTownHall() == attack.defenderTownHall()) same++;
            else if (attack.attackerTownHall() < attack.defenderTownHall()) up++;
            else down++;
        }
        if (known == 0) {
            unknown.add("townhall_matchup_unavailable");
            return null;
        }
        return new Matchups(same, up, down);
    }

    private static Trend trend(List<HistoricalAttack> attacks, Instant from, Instant now) {
        LinkedHashMap<String, List<HistoricalAttack>> grouped = new LinkedHashMap<>();
        for (HistoricalAttack attack : attacks) {
            if (attack.warEndTime() == null) continue;
            String bucket = bucket(attack.warEndTime(), from, now);
            grouped.computeIfAbsent(bucket, ignored -> new ArrayList<>()).add(attack);
        }
        List<TrendPoint> points = new ArrayList<>();
        grouped.entrySet().stream().sorted(MapEntryComparator.INSTANCE).forEach(entry -> {
            List<HistoricalAttack> bucket = entry.getValue();
            points.add(new TrendPoint(
                    entry.getKey(), bucket.size(), averageStars(bucket), averageDestruction(bucket)
            ));
        });
        if (points.size() < 2) return new Trend("insufficient_data", null, List.copyOf(points));
        double delta = points.getLast().avgStars() - points.getFirst().avgStars();
        String direction = delta >= 0.25 ? "up" : delta <= -0.25 ? "down" : "stable";
        return new Trend(direction, round(delta, 2), List.copyOf(points));
    }

    private static String bucket(Instant timestamp, Instant from, Instant now) {
        LocalDate date = timestamp.atZone(ZoneOffset.UTC).toLocalDate();
        long days = from == null || now == null ? 180 : Math.max(1, Duration.between(from, now).toDays());
        if (days <= 31) return date.toString();
        if (days <= 100) return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).toString();
        return YearMonth.from(date).toString();
    }

    private static Double averageStars(List<HistoricalAttack> attacks) {
        return attacks.isEmpty() ? null : round(attacks.stream()
                .mapToInt(HistoricalAttack::stars).average().orElse(0), 2);
    }

    private static Double averageDestruction(List<HistoricalAttack> attacks) {
        return attacks.isEmpty() ? null : round(attacks.stream()
                .mapToDouble(HistoricalAttack::destruction).average().orElse(0), 1);
    }

    private static Double percentage(int value, int total) {
        return total == 0 ? null : round(100.0 * value / total, 1);
    }

    private static Integer nullableCount(int value) {
        return value == 0 ? null : value;
    }

    private static double round(double value, int places) {
        double factor = Math.pow(10, places);
        return Math.round(value * factor) / factor;
    }

    record AttackMetrics(
            String status,
            Integer warCount,
            Integer availableAttacks,
            Integer usedAttacks,
            Integer missedAttacks,
            Integer attackCount,
            Double avgStars,
            Double avgDestruction,
            StarBuckets starBuckets,
            Double tripleRate,
            Double offensivePerformance,
            Double defensivePerformance,
            Matchups matchups,
            Trend trend,
            List<String> unknown
    ) {}

    record StarBuckets(Integer zero, Integer one, Integer two, Integer three) {}

    record Matchups(Integer same, Integer up, Integer down) {}

    record Trend(String direction, Double deltaStarsPerAttack, List<TrendPoint> points) {}

    record TrendPoint(String bucket, int attackCount, Double avgStars, Double avgDestruction) {}

    private enum MapEntryComparator implements Comparator<java.util.Map.Entry<String, List<HistoricalAttack>>> {
        INSTANCE;

        @Override
        public int compare(
                java.util.Map.Entry<String, List<HistoricalAttack>> left,
                java.util.Map.Entry<String, List<HistoricalAttack>> right
        ) {
            return left.getKey().compareTo(right.getKey());
        }
    }
}
