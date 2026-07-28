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
    private static final int SEASON_DISCOVERY_WINDOW = 24;

    private final ClashKingHttpClient client;
    private final Cache<String, HistoricalCwlSeason> prefetchedSeasons;

    public ClashKingLegacyCwlProvider(String baseUrl) {
        client = new ClashKingHttpClient(baseUrl, "ClashKing API");
        prefetchedSeasons = Caffeine.newBuilder()
                .maximumSize(500)
                .expireAfterWrite(Duration.ofMinutes(30))
                .build();
    }

    @Override
    public List<HistoricalCwlSeasonSummary> getAvailableSeasons(
            String clanTag,
            int limit
    ) throws Exception {
        JsonObject basic;
        try {
            basic = client.get(
                    "/clan/" + encoded(clanTag) + "/basic"
            );
        } catch (HttpException notFound) {
            if (notFound.getStatusCode() == 404) basic = new JsonObject();
            else throw notFound;
        }
        List<HistoricalCwlSeasonSummary> leagueChanges =
                CwlHistoryIndexNormalizer.normalizeLegacy(
                        basic, HistoricalCwlService.MAX_SEASON_LIMIT,
                        providerName()
                );
        JsonArray available = client.getArray(
                "/list/seasons?last=" + SEASON_DISCOVERY_WINDOW
        );
        List<String> candidates = seasonCandidates(available);
        List<HistoricalCwlSeasonSummary> result = new ArrayList<>();
        for (String season : candidates) {
            if (result.size() >= limit) break;
            HistoricalCwlSeason detail;
            try {
                detail = fetchSeason(clanTag, season);
            } catch (HttpException unavailable) {
                if (unavailable.getStatusCode() == 404) continue;
                throw unavailable;
            }
            if (!completed(detail.state())) continue;
            HistoricalCwlSeason.League league = leagueForSeason(
                    leagueChanges, season
            );
            HistoricalCwlSeason enriched = withLeague(detail, league);
            prefetchedSeasons.put(cacheKey(clanTag, season), enriched);
            result.add(summary(enriched));
        }
        return List.copyOf(result);
    }

    @Override
    public HistoricalCwlSeason getSeason(String clanTag, String season)
            throws Exception {
        HistoricalCwlSeason cached = prefetchedSeasons.getIfPresent(
                cacheKey(clanTag, season)
        );
        if (cached != null) return cached;
        HistoricalCwlSeason result = fetchSeason(clanTag, season);
        prefetchedSeasons.put(cacheKey(clanTag, season), result);
        return result;
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

    private static HistoricalCwlSeason.League leagueForSeason(
            List<HistoricalCwlSeasonSummary> changes,
            String season
    ) {
        return changes.stream()
                .filter(change -> change.season().compareTo(season) <= 0)
                .max(Comparator.comparing(HistoricalCwlSeasonSummary::season))
                .map(HistoricalCwlSeasonSummary::league)
                .orElse(null);
    }

    private static HistoricalCwlSeason withLeague(
            HistoricalCwlSeason season,
            HistoricalCwlSeason.League inferred
    ) {
        HistoricalCwlSeason.League current = season.league();
        HistoricalCwlSeason.League league =
                current != null && current.name() != null
                        && !current.name().isBlank()
                ? current : inferred != null ? inferred : current;
        return new HistoricalCwlSeason(
                season.season(),
                season.clan(),
                league,
                season.position(),
                season.record(),
                season.standings(),
                season.wars(),
                season.roster(),
                season.state(),
                season.source(),
                season.dataQuality(),
                season.warDetailsComplete()
        );
    }

    private HistoricalCwlSeasonSummary summary(HistoricalCwlSeason season) {
        HistoricalCwlSeason.Record record = season.record();
        return new HistoricalCwlSeasonSummary(
                season.season(),
                season.league(),
                season.position(),
                record == null ? 0 : record.wins(),
                record == null ? 0 : record.losses(),
                record == null ? 0 : record.draws(),
                0,
                null,
                season.state(),
                providerName(),
                season.dataQuality()
        );
    }

    private static boolean completed(String state) {
        return switch (String.valueOf(state).trim().toLowerCase()) {
            case "ended", "warended", "complete", "completed" -> true;
            default -> false;
        };
    }

    private static String cacheKey(String clanTag, String season) {
        return Objects.toString(clanTag, "") + ":" + season;
    }
}
