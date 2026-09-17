package Java.advancedstats;

import Java.cache.CacheKeys;
import Java.performance.ClashKingHttpClient;
import Java.performance.HistoricalAttack;
import Java.performance.HistoricalWarType;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Player-scoped ClashKing CWL seasons; historical clan context comes from each season. */
public final class AdvancedStatsPlayerCwlHistory {
    @FunctionalInterface
    interface Fetcher { JsonObject get(String path) throws Exception; }

    private final Fetcher fetcher;
    private final Cache<String, JsonObject> cache = Caffeine.newBuilder()
            .maximumSize(2_000).expireAfterWrite(Duration.ofMinutes(10)).build();

    public AdvancedStatsPlayerCwlHistory(String baseUrl) {
        this(new ClashKingHttpClient(baseUrl, "ClashKing V2")::get);
    }

    AdvancedStatsPlayerCwlHistory(Fetcher fetcher) {
        this.fetcher = java.util.Objects.requireNonNull(fetcher, "fetcher");
    }

    List<AdvancedStatsWarCwlSeasonReader.SeasonData> seasons(String requestedTag, int requestedLimit)
            throws Exception {
        String tag = CacheKeys.requireValidTag(requestedTag);
        int limit = Math.max(1, Math.min(AdvancedStatsWarCwlService.MAX_CWL_SEASONS, requestedLimit));
        String key = tag + ":" + limit;
        JsonObject response = cache.getIfPresent(key);
        if (response == null) {
            String path = "/v2/player/" + URLEncoder.encode(tag, StandardCharsets.UTF_8)
                    + "/cwl/history?limit=" + limit;
            response = fetcher.get(path);
            if (response == null || !response.has("items") || !response.get("items").isJsonArray()) {
                throw new IllegalArgumentException("ClashKing CWL history response has no items");
            }
            cache.put(key, response);
        }
        return parse(tag, response.getAsJsonArray("items"), limit);
    }

    private static List<AdvancedStatsWarCwlSeasonReader.SeasonData> parse(
            String playerTag, JsonArray items, int limit) {
        Map<String, AdvancedStatsWarCwlSeasonReader.SeasonData> seasons = new LinkedHashMap<>();
        for (JsonElement element : items) {
            if (seasons.size() >= limit) break;
            if (!element.isJsonObject()) continue;
            JsonObject item = element.getAsJsonObject();
            String season = seasonOf(item);
            if (season == null || seasons.containsKey(season)) continue;
            seasons.put(season, parseSeason(playerTag, season, item));
        }
        return List.copyOf(seasons.values());
    }

    private static AdvancedStatsWarCwlSeasonReader.SeasonData parseSeason(
            String playerTag, String season, JsonObject item) {
        JsonObject clan = object(item, "clan");
        JsonObject league = object(clan, "warLeague");
        JsonObject placement = object(clan, "placement");
        JsonArray rows = array(item, "attacks");
        Integer reportedHall = integer(item, "townHallLevel", 0, 30);
        int townHall = reportedHall == null ? 0 : reportedHall;
        List<HistoricalAttack> attacks = new ArrayList<>();
        Map<Integer, List<HistoricalAttack>> rounds = new LinkedHashMap<>();
        List<String> unknown = new ArrayList<>();
        if (rows == null) unknown.add("cwl_attacks_unavailable");
        else for (JsonElement entry : rows) {
            HistoricalAttack attack = attackOf(playerTag, townHall, entry);
            if (attack == null) { unknown.add("cwl_attack_rows_invalid"); continue; }
            attacks.add(attack);
            Integer round = integer(entry.getAsJsonObject(), "round", 1, 7);
            if (round != null) rounds.computeIfAbsent(round, ignored -> new ArrayList<>()).add(attack);
        }
        var base = AdvancedStatsWarCwlMetrics.aggregate(attacks, List.of(), null, null, true);
        Integer missed = integer(item, "missedAttacks", 0, 100);
        Integer used = rows == null ? null : attacks.size();
        Integer available = missed == null || used == null || unknown.contains("cwl_attack_rows_invalid")
                ? null : used + missed;
        if (missed == null) unknown.add("cwl_missed_attacks_unavailable");
        String leagueName = string(league, "name");
        Integer position = integer(placement, "group", 1, 100);
        if (leagueName == null) unknown.add("cwl_league_unavailable");
        if (position == null) unknown.add("cwl_position_unavailable");
        var metrics = new AdvancedStatsWarCwlMetrics.AttackMetrics(
                base.status(), null, available, used, missed, base.attackCount(),
                base.avgStars(), base.avgDestruction(), base.starBuckets(), base.tripleRate(),
                base.offensivePerformance(), null, base.matchups(), base.trend(), base.unknown());
        unknown.add("cwl_participation_war_count_unavailable");
        List<AdvancedStatsWarCwlSeasonReader.RoundData> roundRows = rounds.entrySet().stream()
                .map(entry -> new AdvancedStatsWarCwlSeasonReader.RoundData(entry.getKey(),
                        AdvancedStatsWarCwlMetrics.aggregate(entry.getValue(), List.of(), null, null, true)))
                .toList();
        return new AdvancedStatsWarCwlSeasonReader.SeasonData(season, leagueName, position,
                "clashking_player_cwl_history", metrics, roundRows, unknown,
                string(clan, "name"));
    }

    private static HistoricalAttack attackOf(String playerTag, int townHall, JsonElement entry) {
        if (!entry.isJsonObject()) return null;
        JsonObject row = entry.getAsJsonObject();
        Integer stars = integer(row, "stars", 0, 3);
        Double destruction = decimal(row, "destructionPercentage", 0, 100);
        if (stars == null || destruction == null) return null;
        Integer defenderHall = integer(object(row, "defender"), "townHallLevel", 0, 30);
        return new HistoricalAttack(playerTag, HistoricalWarType.CWL, null, townHall,
                defenderHall == null ? 0 : defenderHall, stars, destruction,
                integer(row, "order", 0, 100), string(row, "warTag"));
    }

    private static String seasonOf(JsonObject item) {
        String raw = string(item, "season");
        if (raw == null || !raw.matches("\\d{4}-(0[1-9]|1[0-2])(?:-\\d{2})?")) return null;
        try { return YearMonth.parse(raw.substring(0, 7)).toString(); }
        catch (RuntimeException invalid) { return null; }
    }

    private static JsonObject object(JsonObject parent, String key) {
        return parent != null && parent.has(key) && parent.get(key).isJsonObject()
                ? parent.getAsJsonObject(key) : null;
    }

    private static JsonArray array(JsonObject parent, String key) {
        return parent != null && parent.has(key) && parent.get(key).isJsonArray()
                ? parent.getAsJsonArray(key) : null;
    }

    private static String string(JsonObject parent, String key) {
        if (parent == null || !parent.has(key) || !parent.get(key).isJsonPrimitive()) return null;
        try {
            String value = parent.get(key).getAsString().trim();
            return value.isBlank() ? null : value;
        } catch (RuntimeException invalid) { return null; }
    }

    private static Integer integer(JsonObject parent, String key, int minimum, int maximum) {
        Double value = decimal(parent, key, minimum, maximum);
        return value != null && value == Math.rint(value) ? value.intValue() : null;
    }

    private static Double decimal(JsonObject parent, String key, double minimum, double maximum) {
        if (parent == null || !parent.has(key) || !parent.get(key).isJsonPrimitive()) return null;
        try {
            double value = parent.get(key).getAsDouble();
            return Double.isFinite(value) && value >= minimum && value <= maximum ? value : null;
        } catch (RuntimeException invalid) { return null; }
    }
}
