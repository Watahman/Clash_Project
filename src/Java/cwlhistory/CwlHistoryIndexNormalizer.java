package Java.cwlhistory;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.Comparator;
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
            "Champion League III", "Champion League II", "Champion League I"
    );

    private CwlHistoryIndexNormalizer() {}

    static List<HistoricalCwlSeasonSummary> normalizeV2(
            JsonObject response,
            int limit,
            String source
    ) {
        JsonArray items = CwlHistoryJson.array(response, "items", "seasons");
        if (items == null) return List.of();
        List<HistoricalCwlSeasonSummary> result = new ArrayList<>();
        for (JsonElement item : items) {
            if (!item.isJsonObject()) continue;
            JsonObject value = item.getAsJsonObject();
            String season = CwlHistoryJson.string(value, "season");
            if (!validSeason(season)) continue;
            JsonObject standing = CwlHistoryJson.object(value, "standing");
            int leagueId = CwlHistoryJson.integer(
                    value, CwlHistoryJson.integer(standing, 0, "cwlLeagueId"),
                    "cwlLeagueId", "leagueId"
            );
            result.add(new HistoricalCwlSeasonSummary(
                    season,
                    new HistoricalCwlSeason.League(
                            leagueId > 0 ? leagueId : null,
                            leagueName(leagueId)
                    ),
                    positive(standing, "groupRank", "rank", "position"),
                    CwlHistoryJson.integer(standing, 0, "wins"),
                    CwlHistoryJson.integer(standing, 0, "losses"),
                    CwlHistoryJson.integer(standing, 0, "ties", "draws"),
                    CwlHistoryJson.integer(standing, 0, "stars"),
                    decimal(standing, "destruction"),
                    CwlHistoryJson.string(value, "state", "status"),
                    source,
                    standing == null ? "Insufficient data" : "Partial history"
            ));
        }
        return newestFirst(result, limit);
    }

    static List<HistoricalCwlSeasonSummary> normalizeLegacy(
            JsonObject response,
            int limit,
            String source
    ) {
        JsonObject root = unwrap(response);
        JsonObject changes = CwlHistoryJson.object(root, "changes");
        JsonObject leagues = CwlHistoryJson.object(
                changes, "clanWarLeague", "clan_war_league", "warLeague"
        );
        if (leagues == null) {
            leagues = CwlHistoryJson.object(root, "clanWarLeague", "cwl");
        }
        if (leagues == null) return List.of();
        List<HistoricalCwlSeasonSummary> result = new ArrayList<>();
        for (Map.Entry<String, JsonElement> entry : leagues.entrySet()) {
            if (!validSeason(entry.getKey())) continue;
            JsonObject value = entry.getValue().isJsonObject()
                    ? entry.getValue().getAsJsonObject()
                    : null;
            String league = value == null
                    ? entry.getValue().getAsString()
                    : CwlHistoryJson.string(value, "league", "name", "warLeague");
            result.add(new HistoricalCwlSeasonSummary(
                    entry.getKey(),
                    new HistoricalCwlSeason.League(null, league),
                    null, 0, 0, 0, 0, null, "completed", source,
                    "Partial history"
            ));
        }
        return newestFirst(result, limit);
    }

    private static JsonObject unwrap(JsonObject response) {
        if (response == null) return new JsonObject();
        JsonObject data = CwlHistoryJson.object(response, "data");
        return data == null ? response : data;
    }

    private static List<HistoricalCwlSeasonSummary> newestFirst(
            List<HistoricalCwlSeasonSummary> source,
            int limit
    ) {
        return source.stream()
                .sorted(Comparator.comparing(
                        HistoricalCwlSeasonSummary::season
                ).reversed())
                .limit(Math.max(1, Math.min(12, limit)))
                .toList();
    }

    static String leagueName(int id) {
        int index = id - 48_000_000;
        return index >= 0 && index < LEAGUES.size() ? LEAGUES.get(index) : "";
    }

    private static boolean validSeason(String season) {
        return season != null
                && season.matches("^20\\d{2}-(0[1-9]|1[0-2])$");
    }

    private static Integer positive(JsonObject value, String... keys) {
        int number = CwlHistoryJson.integer(value, 0, keys);
        return number > 0 ? number : null;
    }

    private static Double decimal(JsonObject value, String... keys) {
        if (value == null) return null;
        double number = CwlHistoryJson.decimal(value, Double.NaN, keys);
        return Double.isFinite(number) ? number : null;
    }
}
