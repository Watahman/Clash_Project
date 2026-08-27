package Java.advancedstats;

import Java.Config;
import Java.HttpException;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryPage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;
import Java.performance.ClashKingHttpClient;
import com.google.gson.JsonObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/** Capability-based adapter for the documented V2 normal, ranked, and war GET routes. */
public final class ClashKingV2AdvancedStatsSource implements AdvancedStatsHistorySource {
    private static final int MAX_BOOTSTRAP_DAYS = 365;

    public interface Transport {
        JsonObject normal(String playerTag, int limit, int days) throws Exception;

        JsonObject ranked(String playerTag, long seasonSeconds, int limit) throws Exception;

        JsonObject war(String playerTag, long startSeconds, long endSeconds, int limit) throws Exception;
    }

    private final Transport transport;
    private final Long rankedSeason;
    private final String unavailableReason;
    private final AdvancedStatsSourceCapabilities declaredCapabilities;

    public ClashKingV2AdvancedStatsSource(Config config) {
        if (config == null) throw new IllegalArgumentException("config is required");
        this.transport = configuredTransport(config.getClashKingBaseUrl());
        this.unavailableReason = transport == null
                ? "ClashKing API base URL is not configured" : "";
        this.rankedSeason = parseSeason(config.getClashKingRankedSeason());
        this.declaredCapabilities = buildCapabilities();
    }

    public ClashKingV2AdvancedStatsSource(Transport transport, Long rankedSeason) {
        this.transport = transport;
        this.unavailableReason = transport == null ? "ClashKing V2 transport is unavailable" : "";
        this.rankedSeason = rankedSeason;
        this.declaredCapabilities = buildCapabilities();
    }

    @Override
    public String sourceId() {
        return "clashking-v2";
    }

    @Override
    public AdvancedStatsSourceCapabilities capabilities() {
        return declaredCapabilities;
    }

    @Override
    public String seasonKey(AdvancedStatsScope scope) {
        return scope == AdvancedStatsScope.RANKED && rankedSeason != null
                ? Long.toString(rankedSeason) : "";
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
        if (rankedSeason == null) throw new UnsupportedOperationException(rankedReason());
        ensureSeasonCheckpoint(request);
        return ClashKingV2AdvancedStatsParser.ranked(
                transport.ranked(request.playerTag(), rankedSeason, Math.min(request.pageSize(), 200)),
                request, rankedSeason);
    }

    private void ensureSeasonCheckpoint(HistoryRequest request) throws AdvancedStatsSourceUnavailableException {
        if (request.checkpoint() == null || !request.checkpoint().present()
                || request.checkpoint().watermarkKey().isBlank()) return;
        String prefix = "ranked-season:" + rankedSeason + ":";
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
        if (rankedSeason == null) return capability(AdvancedStatsScope.RANKED, operation,
                AdvancedStatsCapabilityStatus.UNSUPPORTED, rankedReason());
        return capability(AdvancedStatsScope.RANKED, operation, AdvancedStatsCapabilityStatus.PARTIAL,
                "ranked route has an explicit season but no cursor or total; local watermark is used");
    }

    private String rankedReason() {
        return "ClashKing V2 ranked season is not configured explicitly (Unix seconds required)";
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
    }
}
