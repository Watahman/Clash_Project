package Java.cwlhistory;

import Java.HttpException;
import Java.performance.ClashKingHttpClient;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public final class ClashKingV2CwlProvider implements HistoricalCwlDataProvider {
    private final ClashKingHttpClient client;
    private final Map<String, String> upstreamSeasons = new ConcurrentHashMap<>();

    public ClashKingV2CwlProvider(String baseUrl) {
        client = new ClashKingHttpClient(baseUrl, "ClashKing V2");
    }

    @Override
    public List<HistoricalCwlSeasonSummary> getAvailableSeasons(
            String clanTag,
            int limit
    ) throws Exception {
        JsonObject response = client.get(
                "/v2/cwl/" + encoded(clanTag) + "/seasons?limit=" + limit
        );
        rememberUpstreamSeasons(clanTag, response);
        return CwlHistoryIndexNormalizer.normalizeV2(
                response, limit, providerName()
        );
    }

    @Override
    public HistoricalCwlSeason getSeason(String clanTag, String season)
            throws Exception {
        YearMonth.parse(season);
        String upstreamSeason = upstreamSeason(clanTag, season);
        JsonObject group = client.get(groupPath(clanTag, upstreamSeason));
        String responseSeason = CwlHistoryJson.string(group, "season");
        String normalizedResponse = CwlHistoryIndexNormalizer.normalizedSeason(
                responseSeason
        );
        if (!responseSeason.isBlank() && !season.equals(normalizedResponse)) {
            throw HttpException.upstream(
                    502,
                    "{\"error\":\"ClashKing returned a different CWL season\"}",
                    "ClashKing V2"
            );
        }
        return CwlHistoryNormalizer.normalizeSeason(
                clanTag, season, group, group, providerName()
        );
    }

    @Override
    public String providerName() {
        return "v2";
    }

    private String upstreamSeason(String clanTag, String season) {
        String key = seasonKey(clanTag, season);
        return upstreamSeasons.getOrDefault(key, season);
    }

    private void rememberUpstreamSeasons(String clanTag, JsonObject response) {
        JsonArray items = CwlHistoryJson.array(response, "items", "seasons");
        if (items == null) return;
        for (JsonElement item : items) {
            if (!item.isJsonObject()) continue;
            String raw = CwlHistoryJson.string(item.getAsJsonObject(), "season");
            String normalized = CwlHistoryIndexNormalizer.normalizedSeason(raw);
            if (normalized.isBlank()) continue;
            upstreamSeasons.merge(
                    seasonKey(clanTag, normalized),
                    raw,
                    (known, candidate) -> candidate.equals(normalized)
                            ? candidate : known
            );
        }
    }

    private static String seasonKey(String clanTag, String season) {
        return CwlHistoryJson.tag(clanTag) + ":" + season;
    }

    private static String groupPath(String clanTag, String season) {
        return "/v2/cwl/" + encoded(clanTag)
                + "/group?season=" + encoded(season);
    }

    private static String encoded(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
