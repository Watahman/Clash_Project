package Java.cwlhistory;

import Java.HttpException;
import Java.performance.ClashKingHttpClient;
import com.google.gson.JsonObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.YearMonth;
import java.util.List;

public final class ClashKingV2CwlProvider implements HistoricalCwlDataProvider {
    private final ClashKingHttpClient client;

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
        return CwlHistoryIndexNormalizer.normalizeV2(
                response, limit, providerName()
        );
    }

    @Override
    public HistoricalCwlSeason getSeason(String clanTag, String season)
            throws Exception {
        YearMonth.parse(season);
        JsonObject group = client.get(groupPath(clanTag, season));
        String responseSeason = CwlHistoryJson.string(group, "season");
        if (!responseSeason.isBlank() && !season.equals(responseSeason)) {
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

    private static String groupPath(String clanTag, String season) {
        return "/v2/cwl/" + encoded(clanTag)
                + "/group?season=" + encoded(season);
    }

    private static String encoded(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
