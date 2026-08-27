package Java.cwlhistory;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class CwlHistoryIndexNormalizer {
    private static final List<String> LEAGUES = List.of(
            "Unranked",
            "Bronze League III", "Bronze League II", "Bronze League I",
            "Silver League III", "Silver League II", "Silver League I",
            "Gold League III", "Gold League II", "Gold League I",
            "Crystal League III", "Crystal League II", "Crystal League I",
            "Master League III", "Master League II", "Master League I",
            "Champion League III", "Champion League II", "Champion League I",
            "Titan League III", "Titan League II", "Titan League I",
            "Legend League"
    );

    private CwlHistoryIndexNormalizer() {}

    static List<HistoricalCwlSeasonSummary> normalizeV2(
            JsonObject response,
            int limit,
            String source
    ) {
        JsonArray items = CwlHistoryJson.array(response, "items", "seasons");
        if (items == null) return List.of();
        Map<String, HistoricalCwlSeasonSummary> result = new LinkedHashMap<>();
        for (JsonElement item : items) {
            if (!item.isJsonObject()) continue;
            JsonObject value = item.getAsJsonObject();
            String rawSeason = CwlHistoryJson.string(value, "season");
            String season = normalizedSeason(rawSeason);
            if (season.isBlank()) continue;
            JsonObject standing = CwlHistoryJson.object(value, "standing");
            JsonObject league = CwlHistoryJson.object(
                    value, "warLeague", "league"
            );
            JsonObject rounds = CwlHistoryJson.object(
                    value, "rounds", "record"
            );
            int leagueId = CwlHistoryJson.integer(
                    value,
                    CwlHistoryJson.integer(
                            league,
                            CwlHistoryJson.integer(standing, 0, "cwlLeagueId"),
                            "id"
                    ),
                    "cwlLeagueId", "leagueId"
            );
            String leagueName = CwlHistoryJson.string(league, "name");
            if (leagueName.isBlank()) leagueName = leagueName(leagueId);
            HistoricalCwlSeasonSummary summary = new HistoricalCwlSeasonSummary(
                    season,
                    new HistoricalCwlSeason.League(
                            leagueId > 0 ? leagueId : null,
                            leagueName
                    ),
                    firstPositive(value, standing, "rank", "groupRank", "position"),
                    firstInteger(value, rounds, standing, "won", "wins"),
                    firstInteger(value, rounds, standing, "lost", "losses"),
                    firstInteger(value, rounds, standing, "tied", "ties", "draws"),
                    firstInteger(value, null, standing, "stars"),
                    firstDecimal(value, standing, "destruction"),
                    CwlHistoryJson.string(value, "state", "status"),
                    source,
                    "Partial history"
            );
            if (rawSeason.equals(season) || !result.containsKey(season)) {
                result.put(season, summary);
            }
        }
        return newestFirst(new ArrayList<>(result.values()), limit);
    }

    private static List<HistoricalCwlSeasonSummary> newestFirst(
            List<HistoricalCwlSeasonSummary> source,
            int limit
    ) {
        return source.stream()
                .sorted(Comparator.comparing(
                        HistoricalCwlSeasonSummary::season
                ).reversed())
                .limit(Math.max(1, Math.min(HistoricalCwlService.MAX_SEASON_LIMIT, limit)))
                .toList();
    }

    static String leagueName(int id) {
        int index = id - 48_000_000;
        return index >= 0 && index < LEAGUES.size() ? LEAGUES.get(index) : "";
    }

    static String normalizedSeason(String season) {
        if (season == null) return "";
        String value = season.trim();
        if (value.matches("^20\\d{2}-(0[1-9]|1[0-2])$")) return value;
        if (value.matches("^20\\d{2}-(0[1-9]|1[0-2])-\\d{2}$")) {
            return value.substring(0, 7);
        }
        return "";
    }

    private static Integer positive(JsonObject value, String... keys) {
        int number = CwlHistoryJson.integer(value, 0, keys);
        return number > 0 ? number : null;
    }

    private static Integer firstPositive(
            JsonObject primary,
            JsonObject secondary,
            String... keys
    ) {
        Integer value = positive(primary, keys);
        return value != null ? value : positive(secondary, keys);
    }

    private static int firstInteger(
            JsonObject primary,
            JsonObject secondary,
            JsonObject tertiary,
            String... keys
    ) {
        int value = CwlHistoryJson.integer(primary, Integer.MIN_VALUE, keys);
        if (value != Integer.MIN_VALUE) return value;
        value = CwlHistoryJson.integer(secondary, Integer.MIN_VALUE, keys);
        if (value != Integer.MIN_VALUE) return value;
        return CwlHistoryJson.integer(tertiary, 0, keys);
    }

    private static Double firstDecimal(
            JsonObject primary,
            JsonObject secondary,
            String... keys
    ) {
        Double value = decimal(primary, keys);
        return value != null ? value : decimal(secondary, keys);
    }

    private static Double decimal(JsonObject value, String... keys) {
        if (value == null) return null;
        double number = CwlHistoryJson.decimal(value, Double.NaN, keys);
        return Double.isFinite(number) ? number : null;
    }
}
