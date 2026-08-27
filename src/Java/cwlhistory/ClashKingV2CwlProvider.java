package Java.cwlhistory;

import Java.HttpException;
import Java.performance.ClashKingHttpClient;
import com.google.gson.JsonObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
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
        YearMonth month = YearMonth.parse(season);
        Instant start = month.atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant end = month.plusMonths(1).atDay(1).atStartOfDay()
                .toInstant(ZoneOffset.UTC);
        JsonObject group = client.get(groupPath(clanTag, season));
        String responseSeason = CwlHistoryJson.string(group, "season");
        if (!responseSeason.isBlank() && !season.equals(responseSeason)) {
            throw HttpException.upstream(
                    502,
                    "{\"error\":\"ClashKing returned a different CWL season\"}",
                    "ClashKing V2"
            );
        }
        JsonObject wars = client.get(warsPath(clanTag, start, end));
        return CwlHistoryNormalizer.normalizeSeason(
                clanTag, season, group, wars, providerName()
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

    private static String warsPath(String clanTag, Instant start, Instant end) {
        return "/v2/clan/" + encoded(clanTag) + "/wars"
                + "?type=cwl"
                + "&time%5Bafter%5D=" + encoded(start.toString())
                + "&time%5Bbefore%5D=" + encoded(end.toString())
                + "&limit=20";
    }

    private static String encoded(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
