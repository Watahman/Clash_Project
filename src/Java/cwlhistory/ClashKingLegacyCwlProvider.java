package Java.cwlhistory;

import Java.HttpException;
import Java.performance.ClashKingHttpClient;
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
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

public final class ClashKingLegacyCwlProvider implements HistoricalCwlDataProvider {
    private static final int SEASON_DISCOVERY_WINDOW = 48;
    private static final Duration MISSING_SEASON_TTL = Duration.ofMinutes(5);

    private final ClashKingHttpClient client;
    private final Cache<String, HistoricalCwlSeason> prefetchedSeasons;
    private final Cache<String, Boolean> missingSeasons;
    private final Cache<String, HistoryContext> historyContexts;

    public ClashKingLegacyCwlProvider(String baseUrl) {
        client = new ClashKingHttpClient(baseUrl, "ClashKing API");
        prefetchedSeasons = Caffeine.newBuilder()
                .maximumSize(500)
                .expireAfterWrite(Duration.ofMinutes(30))
                .build();
        missingSeasons = Caffeine.newBuilder()
                .maximumSize(2_000)
                .expireAfterWrite(MISSING_SEASON_TTL)
                .build();
        historyContexts = Caffeine.newBuilder()
                .maximumSize(500)
                .expireAfterWrite(Duration.ofMinutes(30))
                .build();
    }

    @Override
    public List<HistoricalCwlSeasonSummary> getAvailableSeasons(
            String clanTag,
            int limit
    ) throws Exception {
        HistoryContext context = historyContext(clanTag);
        JsonArray available = client.getArray(
                "/list/seasons?last=" + SEASON_DISCOVERY_WINDOW
        );
        List<String> candidates = seasonCandidates(available);
        return candidates.stream()
                .limit(Math.max(1, Math.min(
                        HistoricalCwlService.MAX_SEASON_LIMIT,
                        limit
                )))
                .map(season -> indexSummary(
                        season,
                        context.recordedLeagues()
                ))
                .toList();
    }

    @Override
    public List<HistoricalCwlSeason> enrichOverview(
            String clanTag,
            List<HistoricalCwlSeason> seasons
    ) throws Exception {
        if (seasons == null || seasons.isEmpty()) return List.of();
        HistoryContext context = historyContext(clanTag);
        List<HistoricalCwlSeason> newestFirst = seasons.stream()
                .sorted(Comparator.comparing(
                        HistoricalCwlSeason::season,
                        Comparator.reverseOrder()
                ))
                .toList();
        List<HistoricalCwlSeason> reconstructed =
                CwlLeagueHistoryReconstructor.reconstruct(
                        newestFirst,
                        context.currentLeague(),
                        context.recordedLeagues()
                );
        reconstructed.forEach(season -> prefetchedSeasons.put(
                cacheKey(clanTag, season.season()),
                season
        ));
        return reconstructed;
    }

    @Override
    public HistoricalCwlSeason getSeason(String clanTag, String season)
            throws Exception {
        String key = cacheKey(clanTag, season);
        HistoricalCwlSeason cached = prefetchedSeasons.getIfPresent(key);
        if (cached != null) return cached;
        if (missingSeasons.getIfPresent(key) != null) {
            throw missingSeason(clanTag, season);
        }
        try {
            HistoricalCwlSeason result = fetchSeason(clanTag, season);
            prefetchedSeasons.put(key, result);
            missingSeasons.invalidate(key);
            return result;
        } catch (HttpException failure) {
            if (isUpstreamNotFound(failure)) missingSeasons.put(key, true);
            throw failure;
        }
    }

    private HistoricalCwlSeason fetchSeason(String clanTag, String season)
            throws Exception {
        JsonObject response = client.get(
                "/cwl/" + encoded(clanTag) + "/" + encoded(season)
        );
        String responseSeason = CwlHistoryJson.string(response, "season");
        if (!responseSeason.isBlank() && !season.equals(responseSeason)) {
            throw HttpException.upstream(
                    502,
                    "{\"error\":\"ClashKing returned a different CWL season\"}",
                    "ClashKing API"
            );
        }
        return CwlHistoryNormalizer.normalizeSeason(
                clanTag, season, response, null, providerName()
        );
    }

    @Override
    public String providerName() {
        return "api";
    }

    private HistoryContext historyContext(String clanTag) throws Exception {
        String key = Objects.toString(clanTag, "");
        HistoryContext cached = historyContexts.getIfPresent(key);
        if (cached != null) return cached;

        JsonObject basic;
        try {
            basic = client.getNullableObject(
                    "/clan/" + encoded(clanTag) + "/basic"
            );
            if (basic == null) basic = new JsonObject();
        } catch (HttpException notFound) {
            if (notFound.getStatusCode() == 404) basic = new JsonObject();
            else throw notFound;
        }
        HistoryContext context = new HistoryContext(
                currentLeague(basic),
                CwlHistoryIndexNormalizer.normalizeLegacy(
                        basic,
                        HistoricalCwlService.MAX_SEASON_LIMIT,
                        providerName()
                )
        );
        historyContexts.put(key, context);
        return context;
    }

    private static HistoricalCwlSeason.League currentLeague(JsonObject basic) {
        JsonObject data = CwlHistoryJson.object(basic, "data");
        JsonObject root = data == null ? basic : data;
        JsonObject value = CwlHistoryJson.object(
                root, "warLeague", "clanWarLeague"
        );
        int id = CwlHistoryJson.integer(value, 0, "id");
        String name = CwlHistoryJson.string(
                root, "warLeague", "clanWarLeague"
        );
        if (name.isBlank()) name = CwlHistoryJson.string(value, "name");
        if (name.isBlank()) name = CwlHistoryIndexNormalizer.leagueName(id);
        return new HistoricalCwlSeason.League(
                id > 0 ? id : null,
                name
        );
    }

    private static String encoded(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static List<String> seasonCandidates(JsonArray available) {
        List<String> result = new ArrayList<>();
        for (JsonElement item : available) {
            if (!item.isJsonPrimitive()) continue;
            String season = item.getAsString();
            if (season.matches("^20\\d{2}-(0[1-9]|1[0-2])$")) {
                result.add(season);
            }
        }
        result.stream()
                .map(YearMonth::parse)
                .max(Comparator.naturalOrder())
                .ifPresent(newest -> {
                    for (int offset = 0;
                         offset < SEASON_DISCOVERY_WINDOW;
                         offset++) {
                        result.add(newest.minusMonths(offset).toString());
                    }
                });
        return result.stream()
                .distinct()
                .sorted(Comparator.reverseOrder())
                .toList();
    }

    private HistoricalCwlSeasonSummary indexSummary(
            String season,
            List<HistoricalCwlSeasonSummary> leagueChanges
    ) {
        HistoricalCwlSeasonSummary recorded = leagueChanges.stream()
                .filter(item -> season.equals(item.season()))
                .findFirst()
                .orElse(null);
        HistoricalCwlSeason.League league = recorded == null
                ? new HistoricalCwlSeason.League(null, "")
                : recorded.league();
        return new HistoricalCwlSeasonSummary(
                season,
                league,
                null,
                0,
                0,
                0,
                0,
                null,
                "unknown",
                providerName(),
                recorded == null ? "Season index" : "Partial history"
        );
    }

    private static String cacheKey(String clanTag, String season) {
        return Objects.toString(clanTag, "") + ":" + season;
    }

    private static boolean isUpstreamNotFound(HttpException failure) {
        return failure.getStatusCode() == 404
                && !failure.isSafeToExpose()
                && !failure.getUpstream().isBlank();
    }

    private static HttpException missingSeason(String clanTag, String season) {
        return HttpException.upstream(
                404,
                "{\"error\":\"CWL season not found\",\"clanTag\":\""
                        + Objects.toString(clanTag, "")
                        + "\",\"season\":\"" + Objects.toString(season, "") + "\"}",
                "ClashKing API"
        );
    }

    private record HistoryContext(
            HistoricalCwlSeason.League currentLeague,
            List<HistoricalCwlSeasonSummary> recordedLeagues
    ) {}
}
