package Java.advancedstats;

import Java.Config;
import Java.HttpException;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryPage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;

/** Capability-based adapter for the documented V2 battle-data routes. */
public final class ClashKingV2AdvancedStatsSource implements AdvancedStatsHistorySource {
    /** Runtime wrapper used by the non-throwing seasonKey compatibility API. */
    public static final class SeasonDiscoveryException extends RuntimeException {
        public SeasonDiscoveryException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public interface Transport {
        /** Legacy adapter hook. New production calls use the time-window overload below. */
        default JsonObject normal(String playerTag, int limit, int days) throws Exception {
            return new JsonObject();
        }

        default JsonObject normal(String playerTag, Instant after, Instant before) throws Exception {
            long days = Math.max(1, ChronoUnit.DAYS.between(after, before));
            return normal(playerTag, 500,
                    (int) Math.min(ClashKingV2SeasonResolver.MAX_HISTORY_DAYS, days));
        }

        /** Legacy adapter hook. Ranked V2 no longer sends a query string. */
        default JsonObject ranked(String playerTag, long seasonSeconds, int limit) throws Exception {
            return new JsonObject();
        }

        default JsonObject ranked(String playerTag, String seasonId) throws Exception {
            return ranked(playerTag, Long.parseLong(seasonId), 200);
        }

        default JsonObject war(String playerTag, long startSeconds, long endSeconds, int limit) throws Exception {
            return new JsonObject();
        }

        /** Player-specific season metadata from /v2/player/{tag}/league/history. */
        default JsonObject leagueHistory(String playerTag, Instant after, Instant before) throws Exception {
            return league(playerTag, after, before);
        }

        /** Alias retained for lightweight transports and older test doubles. */
        default JsonObject league(String playerTag, Instant after, Instant before) throws Exception {
            return new JsonObject();
        }

        /** Current Legend-day battlelog from /v2/player/{tag}/legend/{day}/battlelog. */
        default JsonObject legend(String playerTag, String day) throws Exception {
            return new JsonObject();
        }

        /** Current date metadata from /v2/dates/current. */
        default JsonObject currentDates() throws Exception {
            return new JsonObject();
        }

        default String currentLegendDay() throws Exception {
            String day = ClashKingV2AdvancedStatsRoutes.text(currentDates(), "legend");
            return day.isBlank() ? currentSeason() : day;
        }

        /** Legacy metadata hook; no longer used for automatic season discovery. */
        default String currentSeason() throws Exception {
            return "";
        }
    }

    private final Transport transport;
    private final Long configuredRankedSeason;
    private final String unavailableReason;
    private final ClashKingV2SeasonResolver seasonResolver;

    public ClashKingV2AdvancedStatsSource(Config config) {
        if (config == null) throw new IllegalArgumentException("config is required");
        this.transport = ClashKingV2AdvancedStatsRoutes.configured(config.getClashKingBaseUrl());
        this.unavailableReason = transport == null ? "ClashKing API base URL is not configured" : "";
        this.configuredRankedSeason = ClashKingV2AdvancedStatsRoutes.parseSeason(config.getClashKingRankedSeason());
        this.seasonResolver = new ClashKingV2SeasonResolver(transport, configuredRankedSeason);
    }

    public ClashKingV2AdvancedStatsSource(Transport transport, Long rankedSeason) {
        this.transport = transport;
        this.unavailableReason = transport == null ? "ClashKing V2 transport is unavailable" : "";
        this.configuredRankedSeason = rankedSeason == null || rankedSeason > 0 ? rankedSeason : null;
        this.seasonResolver = new ClashKingV2SeasonResolver(transport, configuredRankedSeason);
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
        return scope == AdvancedStatsScope.RANKED && configuredRankedSeason != null
                ? Long.toString(configuredRankedSeason) : "";
    }

    @Override
    public String seasonKey(AdvancedStatsScope scope, String playerTag, Instant requestedAt) {
        Objects.requireNonNull(requestedAt, "requestedAt");
        if (scope != AdvancedStatsScope.RANKED) return "";
        try {
            String season = seasonResolver.season(playerTag, requestedAt);
            return season == null ? "" : season;
        } catch (Exception failure) {
            throw new SeasonDiscoveryException(
                    "ClashKing V2 ranked season discovery failed; retryable", failure);
        }
    }

    @Override
    public HistoryPage fetch(HistoryRequest request) throws Exception {
        Objects.requireNonNull(request, "request");
        if (transport == null) throw new UnsupportedOperationException(unavailableReason);
        try {
            return switch (request.scope()) {
                case NORMAL -> ClashKingV2AdvancedStatsParser.normal(
                        transport.normal(request.playerTag(), normalStart(request), request.requestedAt()), request);
                case WAR -> ClashKingV2AdvancedStatsParser.war(
                        transport.war(request.playerTag(), startSeconds(request), request.requestedAt().getEpochSecond(),
                                Math.min(request.pageSize(), 500)), request);
                case RANKED -> fetchRanked(request);
            };
        } catch (HttpException unavailable) {
            if (ClashKingV2AdvancedStatsRoutes.isMissingRoute(unavailable)) {
                throw new UnsupportedOperationException("ClashKing V2 route is not available for "
                        + request.scope().apiValue(), unavailable);
            }
            throw unavailable;
        }
    }

    private HistoryPage fetchRanked(HistoryRequest request) throws Exception {
        String season = seasonResolver.season(request.playerTag(), request.requestedAt());
        ensureSeasonCheckpoint(request, season);
        String day = seasonResolver.legendDay(request.requestedAt());
        JsonObject ranked = new JsonObject();
        JsonObject legend = new JsonObject();
        if (season != null) {
            try {
                ranked = transport.ranked(request.playerTag(), season);
            } catch (HttpException missingSeason) {
                if (!ClashKingV2AdvancedStatsRoutes.isMissingRoute(missingSeason)) throw missingSeason;
            }
        }
        if (!day.isBlank()) {
            try {
                legend = transport.legend(request.playerTag(), day);
            } catch (HttpException missingLegend) {
                if (!ClashKingV2AdvancedStatsRoutes.isMissingRoute(missingLegend)) throw missingLegend;
            }
        }
        if (season == null && day.isBlank()) {
            throw new AdvancedStatsSourceUnavailableException(
                    seasonResolver.reason(request.playerTag(), request.requestedAt()));
        }
        return ClashKingV2AdvancedStatsParser.league(ClashKingV2AdvancedStatsRoutes.normalizeRanked(ranked),
                season == null ? "" : season,
                legend, day, request);
    }

    private void ensureSeasonCheckpoint(HistoryRequest request, String season)
            throws AdvancedStatsSourceUnavailableException {
        if (season == null || request.checkpoint() == null || !request.checkpoint().present()
                || request.checkpoint().watermarkKey().isBlank()) return;
        String prefix = "ranked-season:" + season + ":";
        if (!request.checkpoint().watermarkKey().startsWith(prefix)) {
            throw new AdvancedStatsSourceUnavailableException(
                    "ranked season changed; state partition reset is required before collection");
        }
    }

    private Instant normalStart(HistoryRequest request) {
        Instant earliest = ClashKingV2SeasonResolver.historyStart(request.requestedAt());
        if (request.checkpoint() == null || request.checkpoint().watermark() == null) return earliest;
        Instant start = request.checkpoint().watermark().minus(1, ChronoUnit.DAYS);
        return start.isAfter(earliest) ? start : earliest;
    }

    private long startSeconds(HistoryRequest request) {
        return normalStart(request).getEpochSecond();
    }

    private AdvancedStatsSourceCapabilities buildCapabilities() {
        boolean configured = transport != null;
        AdvancedStatsCapabilityStatus status = configured
                ? AdvancedStatsCapabilityStatus.PARTIAL : AdvancedStatsCapabilityStatus.UNSUPPORTED;
        String reason = configured ? "V2 route has no cursor or total; local watermark is used" : unavailableReason;
        return new AdvancedStatsSourceCapabilities(List.of(
                capability(AdvancedStatsScope.NORMAL, AdvancedStatsCapabilityOperation.BOOTSTRAP, status, reason),
                capability(AdvancedStatsScope.NORMAL, AdvancedStatsCapabilityOperation.INCREMENTAL, status, reason),
                capability(AdvancedStatsScope.WAR, AdvancedStatsCapabilityOperation.BOOTSTRAP, status, reason),
                capability(AdvancedStatsScope.WAR, AdvancedStatsCapabilityOperation.INCREMENTAL, status, reason),
                rankedCapability(AdvancedStatsCapabilityOperation.BOOTSTRAP),
                rankedCapability(AdvancedStatsCapabilityOperation.INCREMENTAL)));
    }

    private AdvancedStatsCapability rankedCapability(AdvancedStatsCapabilityOperation operation) {
        if (transport == null) return capability(AdvancedStatsScope.RANKED, operation,
                AdvancedStatsCapabilityStatus.UNSUPPORTED, unavailableReason);
        return capability(AdvancedStatsScope.RANKED, operation, AdvancedStatsCapabilityStatus.PARTIAL,
                "ranked and Legend-day routes use local watermark; coverage is partial");
    }

    private AdvancedStatsCapability capability(AdvancedStatsScope scope, AdvancedStatsCapabilityOperation operation,
                                               AdvancedStatsCapabilityStatus status, String reason) {
        return new AdvancedStatsCapability(scope, operation, status, sourceId(),
                status == AdvancedStatsCapabilityStatus.SUPPORTED ? "" : reason);
    }

    static String normalPath(String playerTag, Instant after, Instant before) {
        return ClashKingV2AdvancedStatsRoutes.normalPath(playerTag, after, before);
    }

    static String leagueHistoryPath(String playerTag, Instant after, Instant before) {
        return ClashKingV2AdvancedStatsRoutes.leagueHistoryPath(playerTag, after, before);
    }

    static String rankedPath(String playerTag, String seasonId) {
        return ClashKingV2AdvancedStatsRoutes.rankedPath(playerTag, seasonId);
    }

    static String rankedPath(String playerTag, long season, int ignoredLimit) {
        return rankedPath(playerTag, Long.toString(season));
    }

    static String legendPath(String playerTag, String day) {
        return ClashKingV2AdvancedStatsRoutes.legendPath(playerTag, day);
    }

    static String warPath(String playerTag, long start, long end, int limit) {
        return ClashKingV2AdvancedStatsRoutes.warPath(playerTag, start, end, limit);
    }

}
