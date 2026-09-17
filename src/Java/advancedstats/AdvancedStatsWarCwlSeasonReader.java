package Java.advancedstats;

import Java.cache.CacheKeys;
import Java.cwlhistory.HistoricalCwlSeason;
import Java.cwlhistory.HistoricalCwlSeasonSummary;
import Java.performance.HistoricalAttack;
import Java.performance.HistoricalParticipation;
import Java.performance.HistoricalWarType;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.time.Duration;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Builds player-specific CWL season rows from normalized season or player history. */
final class AdvancedStatsWarCwlSeasonReader {
    private AdvancedStatsWarCwlSeasonReader() {}

    static Map<String, SeasonData> build(
            AdvancedStatsWarCwlProvider provider,
            String playerTag,
            String clanTag,
            List<HistoricalCwlSeasonSummary> summaries,
            List<HistoricalAttack> attacks,
            List<HistoricalParticipation> participation,
            Instant from,
            Instant now,
            List<String> unknown
    ) {
        Map<String, List<HistoricalAttack>> attackRows = groupAttacks(attacks, from, now);
        Map<String, List<HistoricalParticipation>> participationRows = groupParticipation(
                participation, from, now
        );
        Map<String, SeasonData> result = new LinkedHashMap<>();
        for (HistoricalCwlSeasonSummary summary : safeList(summaries)) {
            String season = validSeason(summary == null ? null : summary.season());
            if (season == null || !seasonInWindow(season, from, now)) continue;
            HistoricalCwlSeason detail = load(provider, clanTag, season, unknown);
            SeasonData row = detail == null
                    ? fallback(season, summary, attackRows, participationRows, from, now)
                    : detail(playerTag, season, summary, detail);
            if (row == null) row = fallback(season, summary, attackRows, participationRows, from, now);
            result.put(season, row);
        }
        addUnindexed(result, attackRows, participationRows, from, now);
        return result;
    }

    private static HistoricalCwlSeason load(
            AdvancedStatsWarCwlProvider provider,
            String clanTag,
            String season,
            List<String> unknown
    ) {
        if (clanTag == null) return null;
        try {
            return provider.cwlSeason(clanTag, season);
        } catch (Exception failure) {
            unknown.add("cwl_season_detail_unavailable");
            return null;
        }
    }

    private static SeasonData fallback(
            String season,
            HistoricalCwlSeasonSummary summary,
            Map<String, List<HistoricalAttack>> attacks,
            Map<String, List<HistoricalParticipation>> participation,
            Instant from,
            Instant now
    ) {
        AdvancedStatsWarCwlMetrics.AttackMetrics metrics = AdvancedStatsWarCwlMetrics.aggregate(
                attacks.getOrDefault(season, List.of()),
                participation.getOrDefault(season, List.of()), from, now, false
        );
        List<String> unknown = new ArrayList<>(metrics.unknown());
        unknown.add("round_performance_unavailable");
        unknown.add("cwl_season_detail_unavailable");
        return new SeasonData(
                season, leagueName(summary == null ? null : summary.league()),
                summary == null ? null : summary.position(),
                summary == null ? "observed_month" : "cwl_index",
                metrics, List.of(), unique(unknown)
        );
    }

    private static SeasonData detail(
            String playerTag,
            String season,
            HistoricalCwlSeasonSummary summary,
            HistoricalCwlSeason detail
    ) {
        List<HistoricalAttack> attacks = new ArrayList<>();
        List<HistoricalParticipation> participation = new ArrayList<>();
        List<RoundData> rounds = new ArrayList<>();
        List<String> unknown = new ArrayList<>();
        boolean memberSeen = false;
        for (HistoricalCwlSeason.War war : detail.wars()) {
            memberSeen |= addWarData(playerTag, season, war, attacks, participation, rounds, unknown);
        }
        if (!memberSeen) return null;
        AdvancedStatsWarCwlMetrics.AttackMetrics metrics = AdvancedStatsWarCwlMetrics.aggregate(
                attacks, participation, null, null, true
        );
        unknown.addAll(metrics.unknown());
        if (!detail.warDetailsComplete()) unknown.add("cwl_war_details_incomplete");
        HistoricalCwlSeason.League league = detail.league();
        String leagueName = leagueName(league);
        if (leagueName == null && summary != null) leagueName = leagueName(summary.league());
        Integer position = detail.position() == null
                ? summary == null ? null : summary.position() : detail.position();
        return new SeasonData(
                season, leagueName, position, "cwl_detail", metrics, rounds, unique(unknown)
        );
    }

    private static boolean addWarData(
            String playerTag,
            String season,
            HistoricalCwlSeason.War war,
            List<HistoricalAttack> attacks,
            List<HistoricalParticipation> participation,
            List<RoundData> rounds,
            List<String> unknown
    ) {
        if (war == null) return false;
        HistoricalCwlSeason.Member member = findMember(war.clan(), playerTag);
        if (member == null) return false;
        String warId = season + ":" + war.day() + ":" + safe(war.id());
        List<HistoricalAttack> roundAttacks = new ArrayList<>();
        for (HistoricalCwlSeason.Attack attack : member.attacks()) {
            HistoricalAttack normalized = new HistoricalAttack(
                    playerTag, HistoricalWarType.CWL, null,
                    attack.attackerTownHall(), attack.defenderTownHall(), attack.stars(),
                    attack.destruction(), attack.order(), warId
            );
            attacks.add(normalized);
            roundAttacks.add(normalized);
        }
        if (war.detailsComplete() && war.attacksPerMember() > 0) {
            participation.add(new HistoricalParticipation(
                    playerTag, HistoricalWarType.CWL, null,
                    war.attacksPerMember(), member.attacks().size(), warId, true
            ));
        } else {
            unknown.add("cwl_participation_incomplete");
        }
        rounds.add(new RoundData(war.day(), AdvancedStatsWarCwlMetrics.aggregate(
                roundAttacks, List.of(), null, null, true
        )));
        return true;
    }

    private static HistoricalCwlSeason.Member findMember(
            HistoricalCwlSeason.WarSide side, String playerTag
    ) {
        if (side == null) return null;
        return side.members().stream()
                .filter(member -> sameTag(member.tag(), playerTag))
                .findFirst().orElse(null);
    }

    private static void addUnindexed(
            Map<String, SeasonData> result,
            Map<String, List<HistoricalAttack>> attacks,
            Map<String, List<HistoricalParticipation>> participation,
            Instant from,
            Instant now
    ) {
        Set<String> keys = new LinkedHashSet<>();
        keys.addAll(attacks.keySet());
        keys.addAll(participation.keySet());
        for (String season : keys) {
            if (result.containsKey(season) || !seasonInWindow(season, from, now)) continue;
            result.put(season, fallback(season, null, attacks, participation, from, now));
        }
    }

    private static Map<String, List<HistoricalAttack>> groupAttacks(
            List<HistoricalAttack> attacks, Instant from, Instant now
    ) {
        Map<String, List<HistoricalAttack>> result = new LinkedHashMap<>();
        for (HistoricalAttack attack : attacks) {
            if (attack == null || attack.warEndTime() == null
                    || !inWindow(attack.warEndTime(), from, now)) continue;
            String season = YearMonth.from(attack.warEndTime().atZone(ZoneOffset.UTC)).toString();
            result.computeIfAbsent(season, ignored -> new ArrayList<>()).add(attack);
        }
        return result;
    }

    private static Map<String, List<HistoricalParticipation>> groupParticipation(
            List<HistoricalParticipation> items, Instant from, Instant now
    ) {
        Map<String, List<HistoricalParticipation>> result = new LinkedHashMap<>();
        for (HistoricalParticipation item : items) {
            if (item == null || item.warEndTime() == null
                    || !inWindow(item.warEndTime(), from, now)) continue;
            String season = YearMonth.from(item.warEndTime().atZone(ZoneOffset.UTC)).toString();
            result.computeIfAbsent(season, ignored -> new ArrayList<>()).add(item);
        }
        return result;
    }

    private static boolean inWindow(Instant timestamp, Instant from, Instant now) {
        return (from == null || !timestamp.isBefore(from))
                && !timestamp.isAfter(now.plus(Duration.ofDays(1)));
    }

    private static boolean seasonInWindow(String season, Instant from, Instant now) {
        try {
            YearMonth month = YearMonth.parse(season);
            YearMonth start = from == null ? null : YearMonth.from(from.atZone(ZoneOffset.UTC));
            YearMonth end = YearMonth.from(now.atZone(ZoneOffset.UTC));
            return (start == null || !month.isBefore(start)) && !month.isAfter(end);
        } catch (RuntimeException invalid) {
            return false;
        }
    }

    private static String validSeason(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return YearMonth.parse(value).toString();
        } catch (RuntimeException invalid) {
            return null;
        }
    }

    private static String leagueName(HistoricalCwlSeason.League league) {
        return league == null || league.name() == null || league.name().isBlank()
                ? null : league.name();
    }

    private static boolean sameTag(String left, String right) {
        return CacheKeys.normalizeTag(left).equals(CacheKeys.normalizeTag(right));
    }

    private static List<String> unique(List<String> values) {
        return new ArrayList<>(new LinkedHashSet<>(values));
    }

    private static String safe(String value) {
        return value == null || value.isBlank() ? "unknown" : value;
    }

    private static <T> List<T> safeList(List<T> values) {
        return values == null ? List.of() : values;
    }

    record RoundData(int round, AdvancedStatsWarCwlMetrics.AttackMetrics metrics) {}

    record SeasonData(
            String season,
            String league,
            Integer position,
            String seasonBasis,
            AdvancedStatsWarCwlMetrics.AttackMetrics metrics,
            List<RoundData> rounds,
            List<String> unknown
    ) {
        SeasonData {
            rounds = rounds == null ? List.of() : List.copyOf(rounds);
            unknown = unknown == null ? List.of() : List.copyOf(unknown);
        }

        JsonObject json() {
            JsonObject result = AdvancedStatsWarCwlJson.metrics(metrics);
            result.addProperty("season", season);
            AdvancedStatsWarCwlJson.addNullable(result, "league", league);
            AdvancedStatsWarCwlJson.addNullable(result, "position", position);
            result.addProperty("seasonBasis", seasonBasis);
            JsonArray roundRows = new JsonArray();
            rounds.stream().sorted(java.util.Comparator.comparingInt(RoundData::round)).forEach(round -> {
                JsonObject row = AdvancedStatsWarCwlJson.metrics(round.metrics());
                row.addProperty("round", round.round());
                roundRows.add(row);
            });
            result.add("rounds", roundRows);
            List<String> merged = new ArrayList<>(metrics.unknown());
            merged.addAll(unknown);
            AdvancedStatsWarCwlJson.addUnknown(result, unique(merged));
            return result;
        }
    }
}
