package Java.cwlhistory;

import Java.performance.ClashKingHttpClient;
import com.google.gson.JsonObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
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
                "/v2/cwl/" + encoded(clanTag) + "/ranking-history"
        );
        return CwlHistoryIndexNormalizer.normalizeV2(
                response, limit, providerName()
        );
    }

    @Override
    public HistoricalCwlSeason getSeason(String clanTag, String season)
            throws Exception {
        YearMonth month = YearMonth.parse(season);
        long start = month.atDay(1).atStartOfDay().toEpochSecond(ZoneOffset.UTC);
        long end = month.plusMonths(1).atDay(1).atStartOfDay()
                .toEpochSecond(ZoneOffset.UTC);
        JsonObject group = client.get(
                "/cwl/" + encoded(clanTag) + "/" + encoded(season)
        );
        JsonObject wars = client.get(
                "/v2/clan/" + encoded(clanTag)
                        + "/wars?timestamp_start=" + start
                        + "&timestamp_end=" + end
                        + "&limit=20&war_type=cwl"
        );
        return CwlHistoryNormalizer.normalizeSeason(
                clanTag, season, group, wars, providerName()
        );
    }

    @Override
    public String providerName() {
        return "v2";
    }

    private static String encoded(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
