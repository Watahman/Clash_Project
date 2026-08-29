package Java.advancedstats;

import Java.Config;
import Java.HttpException;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryPage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;
import Java.performance.ClashKingHttpClient;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;

/** Capability-based adapter for the documented V2 normal, ranked, and war GET routes. */
public final class ClashKingV2AdvancedStatsSource implements AdvancedStatsHistorySource {
    private static final int MAX_BOOTSTRAP_DAYS = 365;
    private static final DateTimeFormatter SEASON_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM", Locale.ROOT);

    public interface Transport {
        JsonObject normal(String playerTag, int limit, int days) throws Exception;

        JsonObject ranked(String playerTag, long seasonSeconds, int limit) throws Exception;

        JsonObject war(String playerTag, long startSeconds, long endSeconds, int limit) throws Exception;

        /** Optional metadata lookup used when no explicit ranked season override is configured. */
        default String currentSeason() throws Exception {
            return "";
        }
    }

    private final Transport transport;
    private final Long configuredRankedSeason;
    private final String unavailableReason;
    private Long resolvedRankedSeason;
    private boolean rankedSeasonResolutionAttempted;
    private String rankedSeasonResolutionReason = "";

    public ClashKingV2AdvancedStatsSource(Config config) {
        if (config == null) throw new IllegalArgumentException("config is required");
        this.transport = configuredTransport(config.getClashKingBaseUrl());
        this.unavailableReason = transport == null
                ? "ClashKing API base URL is not configured" : "";
        this.configuredRankedSeason = parseSeason(config.getClashKingRankedSeason());
    }

    public ClashKingV2AdvancedStatsSource(Transport transport, Long rankedSeason) {
        this.transport = transport;
        this.unavailableReason = transport == null ? "ClashKing V2 transport is unavailable" : "";
        this.configuredRankedSeason = rankedSeason;
    }

    @Override
    public String sourceId() {
        return "clashking-v2";
    }

    @Override
    public AdvancedStatsSourceCapabilities capabilities() {
        return buildCapabilities();
    }

    @Override
    public String seasonKey(AdvancedStatsScope scope) {
        Long season = scope == AdvancedStatsScope.RANKED ? rankedSeason() : null;
        return season == null ? "" : Long.toString(season);
    }

    @Override
    public HistoryPage fetch(HistoryRequest request) throws Exception {
        if (transport == null) throw new UnsupportedOperationException(unavailableReason);
        try {
            return switch (request.scope()) {
                case NORMAL -> ClashKingV2AdvancedStatsParser.normal(
                        transport.normal(request.playerTag(), Math.min(request.pageSize(), 500), 365), request);
                case WAR -> ClashKingV2AdvancedStatsParser.war(
                        transport.war(request.playerTag(), startSeconds(request), request.requestedAt().getEpochSecond(),
                                Math.min(request.pageSize(), 500)), request);
                case RANKED -> fetchRanked(request);
            };
        } catch (HttpException unavailable) {
            if (unavailable.getStatusCode() == 404 || unavailable.getStatusCode() == 405) {
                throw new UnsupportedOperationException("ClashKing V2 route is not available for "
                        + request.scope().apiValue(), unavailable);
            }
            throw unavailable;
        }
    }

    private HistoryPage fetchRanked(HistoryRequest request) throws Exception {
        Long season = rankedSeason();
        if (season == null) throw new UnsupportedOperationException(rankedReason());
        ensureSeasonCheckpoint(request, season);
        return ClashKingV2AdvancedStatsParser.ranked(
                transport.ranked(request.playerTag(), season, Math.min(request.pageSize(), 200)),
                request, season);
    }

    private void ensureSeasonCheckpoint(HistoryRequest request, long season) throws AdvancedStatsSourceUnavailableException {
        if (request.checkpoint() == null || !request.checkpoint().present()
                || request.checkpoint().watermarkKey().isBlank()) return;
        String prefix = "ranked-season:" + season + ":";
        if (!request.checkpoint().watermarkKey().startsWith(prefix)) {
            throw new AdvancedStatsSourceUnavailableException(
                    "ranked season changed; state partition reset is required before collection");
        }
    }

    private AdvancedStatsSourceCapabilities buildCapabilities() {
        boolean configured = transport != null;
        String normalReason = configured ? "V2 history route has no cursor or total; local watermark is used"
                : unavailableReason;
        AdvancedStatsCapabilityStatus status = configured
                ? AdvancedStatsCapabilityStatus.PARTIAL : AdvancedStatsCapabilityStatus.UNSUPPORTED;
        return new AdvancedStatsSourceCapabilities(List.of(
                capability(AdvancedStatsScope.NORMAL, AdvancedStatsCapabilityOperation.BOOTSTRAP, status, normalReason),
                capability(AdvancedStatsScope.NORMAL, AdvancedStatsCapabilityOperation.INCREMENTAL, status, normalReason),
                capability(AdvancedStatsScope.WAR, AdvancedStatsCapabilityOperation.BOOTSTRAP, status, normalReason),
                capability(AdvancedStatsScope.WAR, AdvancedStatsCapabilityOperation.INCREMENTAL, status, normalReason),
                rankedCapability(AdvancedStatsCapabilityOperation.BOOTSTRAP),
                rankedCapability(AdvancedStatsCapabilityOperation.INCREMENTAL)
        ));
    }

    private AdvancedStatsCapability capability(AdvancedStatsScope scope, AdvancedStatsCapabilityOperation operation,
                                               AdvancedStatsCapabilityStatus status, String reason) {
        return new AdvancedStatsCapability(scope, operation, status, sourceId(),
                status == AdvancedStatsCapabilityStatus.SUPPORTED ? "" : reason);
    }

    private AdvancedStatsCapability rankedCapability(AdvancedStatsCapabilityOperation operation) {
        if (transport == null) return capability(AdvancedStatsScope.RANKED, operation,
                AdvancedStatsCapabilityStatus.UNSUPPORTED, unavailableReason);
        if (rankedSeason() == null) return capability(AdvancedStatsScope.RANKED, operation,
                AdvancedStatsCapabilityStatus.UNSUPPORTED, rankedReason());
        return capability(AdvancedStatsScope.RANKED, operation, AdvancedStatsCapabilityStatus.PARTIAL,
                "ranked route has an explicit or discovered season but no cursor or total; local watermark is used");
    }

    private String rankedReason() {
        if (!rankedSeasonResolutionReason.isBlank()) return rankedSeasonResolutionReason;
        return "ClashKing V2 current ranked season is unavailable";
    }

    private synchronized Long rankedSeason() {
        if (configuredRankedSeason != null) return configuredRankedSeason;
        if (rankedSeasonResolutionAttempted) return resolvedRankedSeason;
        rankedSeasonResolutionAttempted = true;
        if (transport == null) {
            rankedSeasonResolutionReason = unavailableReason;
            return null;
        }
        try {
            String current = transport.currentSeason();
            resolvedRankedSeason = parseSeasonLabel(current);
            if (resolvedRankedSeason == null) {
                rankedSeasonResolutionReason = "ClashKing V2 returned an invalid current ranked season";
            }
        } catch (Exception unavailable) {
            rankedSeasonResolutionReason = "ClashKing V2 current ranked season could not be resolved";
            resolvedRankedSeason = null;
        }
        return resolvedRankedSeason;
    }

    private long startSeconds(HistoryRequest request) {
        Instant earliest = request.requestedAt().minus(MAX_BOOTSTRAP_DAYS, ChronoUnit.DAYS);
        Instant start = request.checkpoint() == null || request.checkpoint().watermark() == null
                ? earliest
                : request.checkpoint().watermark().minus(1, ChronoUnit.DAYS);
        if (start.isBefore(earliest)) start = earliest;
        return start.getEpochSecond();
    }

    private static Long parseSeason(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            long value = Long.parseLong(raw.trim());
            return value > 0 ? value : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    static Long parseSeasonLabel(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            YearMonth month = YearMonth.parse(raw.trim(), SEASON_FORMAT);
            return month.atDay(1).atStartOfDay(ZoneOffset.UTC).toEpochSecond();
        } catch (DateTimeParseException invalid) {
            return null;
        }
    }

    private static Transport configuredTransport(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) return null;
        return new HttpTransport(baseUrl);
    }

    static String normalPath(String playerTag, int limit, int days) {
        return "/v2/player/" + encoded(playerTag)
                + "/battlelog/history?limit=" + limit + "&days=" + days;
    }

    static String rankedPath(String playerTag, long season, int limit) {
        return "/v2/player/" + encoded(playerTag) + "/ranked/" + season
                + "/battlelog?limit=" + limit;
    }

    static String warPath(String playerTag, long start, long end, int limit) {
        return "/v2/player/" + encoded(playerTag) + "/war/attacks"
                + "?time%5Bafter%5D=" + encoded(Instant.ofEpochSecond(start).toString())
                + "&time%5Bbefore%5D=" + encoded(Instant.ofEpochSecond(end).toString())
                + "&limit=" + limit;
    }

    private static String encoded(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static final class HttpTransport implements Transport {
        private final ClashKingHttpClient client;

        private HttpTransport(String baseUrl) {
            this.client = new ClashKingHttpClient(baseUrl, "ClashKing V2");
        }

        @Override
        public JsonObject normal(String playerTag, int limit, int days) throws Exception {
            return client.get(normalPath(playerTag, limit, days));
        }

        @Override
        public JsonObject ranked(String playerTag, long seasonSeconds, int limit) throws Exception {
            return client.get(rankedPath(playerTag, seasonSeconds, limit));
        }

        @Override
        public JsonObject war(String playerTag, long startSeconds, long endSeconds, int limit) throws Exception {
            return client.get(warPath(playerTag, startSeconds, endSeconds, limit));
        }

        @Override
        public String currentSeason() throws Exception {
            JsonObject response = client.get("/v2/dates/current");
            JsonElement season = response.get("season");
            if (season == null || season.isJsonNull() || !season.isJsonPrimitive()) return "";
            return season.getAsString().trim();
        }
    }
}
