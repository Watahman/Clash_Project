package Java.cwlhistory;

import Java.HttpException;
import Java.performance.ClashKingHttpClient;
import com.google.gson.JsonObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

public final class ClashKingLegacyCwlProvider implements HistoricalCwlDataProvider {
    private final ClashKingHttpClient client;

    public ClashKingLegacyCwlProvider(String baseUrl) {
        client = new ClashKingHttpClient(baseUrl, "ClashKing API");
    }

    @Override
    public List<HistoricalCwlSeasonSummary> getAvailableSeasons(
            String clanTag,
            int limit
    ) throws Exception {
        JsonObject response;
        try {
            response = client.get(
                    "/clan/" + encoded(clanTag) + "/basic"
            );
        } catch (HttpException notFound) {
            if (notFound.getStatusCode() == 404) return List.of();
            throw notFound;
        }
        return CwlHistoryIndexNormalizer.normalizeLegacy(
                response, limit, providerName()
        );
    }

    @Override
    public HistoricalCwlSeason getSeason(String clanTag, String season)
            throws Exception {
        JsonObject response = client.get(
                "/cwl/" + encoded(clanTag) + "/" + encoded(season)
        );
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
}
