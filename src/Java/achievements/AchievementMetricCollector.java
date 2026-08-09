package Java.achievements;

import Java.Config;
import Java.cwlhistory.HistoricalCwlService;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Combines achievement data sources without letting a slow/optional source block
 * the whole page. Heavy war/CWL history is persisted incrementally and reused.
 */
public final class AchievementMetricCollector {
    private final AchievementFastMetrics fastMetrics;
    private final AchievementSourceCache sourceCache = new AchievementSourceCache();
    private final AchievementHistoryCollector historyCollector;

    public AchievementMetricCollector(Config conf) {
        this.fastMetrics = new AchievementFastMetrics(conf);
        this.historyCollector = new AchievementHistoryCollector(conf);
    }

    public AchievementMetricCollector(Config conf, HistoricalCwlService cwlService) {
        this.fastMetrics = new AchievementFastMetrics(conf);
        this.historyCollector = new AchievementHistoryCollector(conf, cwlService);
    }

    public Result collect(
            String userId,
            String playerTag,
            Map<String, Long> snapshotMetrics,
            boolean includeDeepHistory
    ) {
        Map<String, Long> metrics = new LinkedHashMap<>();
        if (snapshotMetrics != null) metrics.putAll(snapshotMetrics);
        JsonObject sources = new JsonObject();

        boolean hasBaseData = snapshotMetrics != null && !snapshotMetrics.isEmpty();
        boolean hasBaseHistory = hasBaseData && (
                snapshotMetrics.containsKey("snapshot_import_count")
                        || snapshotMetrics.containsKey("tracked_days")
        );
        source(
                sources,
                AchievementSources.BASE_DATA,
                hasBaseData,
                hasBaseData
                        ? "Latest imported base-data snapshot loaded."
                        : "Import base data only for base-specific achievements; the rest of the catalog works without it."
        );
        source(
                sources,
                AchievementSources.BASE_HISTORY,
                hasBaseHistory,
                hasBaseHistory
                        ? "Imported snapshot history loaded."
                        : "Import another snapshot later to build base progression history."
        );

        AchievementFastMetrics.Result fast = fastMetrics.collect(userId, playerTag);
        metrics.putAll(fast.metrics());
        source(
                sources,
                AchievementSources.LIVE_PROFILE,
                fast.liveProfileAvailable(),
                fast.liveProfileAvailable()
                        ? "Live Clash profile loaded."
                        : "Live Clash profile is temporarily unavailable."
        );
        source(
                sources,
                AchievementSources.CLASHPANEL,
                fast.clashPanelAvailable(),
                fast.clashPanelAvailable()
                        ? "ClashPanel usage data loaded in one summary query."
                        : "ClashPanel usage metrics could not be loaded."
        );
        source(
                sources,
                AchievementSources.CLAN_FAMILY,
                fast.clashPanelAvailable(),
                fast.clashPanelAvailable()
                        ? "Clan Family activity source is available."
                        : "Clan Family metrics could not be loaded."
        );

        // Advanced Stats remains an internal feature source, but the original v2
        // achievement spec does not invent extra Advanced-Stats-only families.
        source(
                sources,
                AchievementSources.ADVANCED_STATS,
                fast.advancedStatsAvailable(),
                fast.advancedStatsAvailable()
                        ? "Advanced Stats tracking totals loaded."
                        : "Advanced Stats tracking is not active for this account."
        );

        CacheRead cached = readCachedHistory(userId, playerTag);
        metrics.putAll(cached.metrics());
        boolean cachedWar = hasMetricPrefix(cached.metrics(), "war_current_")
                || hasMetricPrefix(cached.metrics(), "war_recorded_");
        boolean cachedCwl = hasMetricPrefix(cached.metrics(), "cwl_");
        boolean cachedRaid = hasMetricPrefix(cached.metrics(), "raid_");
        boolean cachedLegend = hasMetricPrefix(cached.metrics(), "legend_")
                || hasMetricPrefix(cached.metrics(), "ranking_");
        String clanTag = fast.clanTag();

        if (includeDeepHistory) {
            AchievementHistoryCollector.RefreshResult refresh = historyCollector.refresh(userId, playerTag, clanTag);
            CacheRead refreshed = readCachedHistory(userId, playerTag);
            metrics.putAll(refreshed.metrics());
            cachedWar = cachedWar || hasMetricPrefix(refreshed.metrics(), "war_current_")
                    || hasMetricPrefix(refreshed.metrics(), "war_recorded_");
            cachedCwl = cachedCwl || hasMetricPrefix(refreshed.metrics(), "cwl_");
            cachedRaid = cachedRaid || hasMetricPrefix(refreshed.metrics(), "raid_");
            cachedLegend = cachedLegend || hasMetricPrefix(refreshed.metrics(), "legend_")
                    || hasMetricPrefix(refreshed.metrics(), "ranking_");

            boolean hasClan = clanTag != null && !clanTag.isBlank();
            if (!hasClan) {
                source(sources, AchievementSources.WAR, cachedWar,
                        cachedWar
                                ? "Previously observed regular-war history is cached. Join a clan to add newer wars."
                                : "Join a clan before ClashPanel can observe regular wars.");
                source(sources, AchievementSources.CWL, cachedCwl,
                        cachedCwl
                                ? "Previously indexed CWL history is cached. Join a clan to add newer seasons."
                                : "Join a clan before ClashPanel can index CWL history.");
            } else {
                boolean warAvailable = refresh.warAvailable() || cachedWar;
                boolean cwlAvailable = refresh.cwlAvailable() || cachedCwl;
                source(
                        sources,
                        AchievementSources.WAR,
                        warAvailable,
                        warAvailable
                                ? "Regular-war cache checked. Final wars are reused and the active war may be refreshed."
                                : "Regular-war data could not be refreshed; any older cached progress is preserved."
                );

                String cwlDetail;
                if (!cwlAvailable) {
                    cwlDetail = "CWL history could not be refreshed; any older cached progress is preserved.";
                } else if (refresh.cwlRemaining() > 0) {
                    cwlDetail = "CWL history is indexing incrementally: "
                            + refresh.cwlProcessed() + " season(s) processed now, "
                            + refresh.cwlRemaining() + " remaining. Cached seasons will not be downloaded again.";
                } else {
                    cwlDetail = "CWL history is up to date. Only a new or still-active season will be processed next time.";
                }
                source(sources, AchievementSources.CWL, cwlAvailable, cwlDetail);
            }

            boolean raidAvailable = refresh.raidAvailable() || cachedRaid;
            source(
                    sources,
                    AchievementSources.RAID_HISTORY,
                    raidAvailable,
                    raidAvailable
                            ? "Raid weekends loaded from normalized history; completed weekends are reused."
                            : "Raid history could not be measured yet; cached progress is preserved."
            );
            boolean legendAvailable = refresh.legendAvailable() || cachedLegend;
            source(
                    sources,
                    AchievementSources.LEGEND_HISTORY,
                    legendAvailable,
                    legendAvailable
                            ? "Legend season rankings loaded from normalized history."
                            : "No measurable Legend season ranking is available yet."
            );
        } else {
            boolean hasClan = clanTag != null && !clanTag.isBlank();
            source(
                    sources,
                    AchievementSources.WAR,
                    cachedWar,
                    cachedWar
                            ? "Cached regular-war evidence loaded; only new/current records are refreshed."
                            : hasClan
                                    ? "Regular-war history will be checked after the fast first render."
                                    : "Join a clan before ClashPanel can observe regular wars."
            );
            source(
                    sources,
                    AchievementSources.CWL,
                    cachedCwl,
                    cachedCwl
                            ? "Cached CWL achievements loaded; the background refresh checks only missing/new seasons."
                            : hasClan
                                    ? "CWL history starts indexing after the fast first render."
                                    : "Join a clan before ClashPanel can index CWL history."
            );
            source(
                    sources,
                    AchievementSources.RAID_HISTORY,
                    cachedRaid,
                    cachedRaid
                            ? "Cached raid achievements loaded; completed weekends are reused."
                            : "Raid history is checked after the fast first render."
            );
            source(
                    sources,
                    AchievementSources.LEGEND_HISTORY,
                    cachedLegend,
                    cachedLegend
                            ? "Cached Legend season rankings loaded."
                            : "Legend season rankings are checked after the fast first render."
            );
        }

        // v2 sources that are present in the specification but do not yet have a
        // trustworthy evaluator in this branch stay explicitly unavailable.
        source(sources, AchievementSources.CLASHKING_HISTORY, false,
                "ClashKing-backed history remains UNKNOWN until its normalized evidence is connected.");
        source(sources, AchievementSources.CLAN_PROFILE, fast.clanProfileAvailable(),
                fast.clanProfileAvailable()
                        ? "Current clan profile and member roster loaded. Shared clan badges use the clan tag as owner."
                        : fast.clanTag().isBlank()
                                ? "Join a clan before shared clan achievements can be measured."
                                : "Current clan profile or member roster is temporarily unavailable.");
        source(sources, AchievementSources.MIXED, false,
                "Combination achievements remain UNKNOWN until every required source is available.");

        return new Result(Map.copyOf(metrics), sources, fast.officialAchievements(), fast.clanTag());
    }

    private CacheRead readCachedHistory(String userId, String playerTag) {
        try {
            return new CacheRead(sourceCache.aggregateMetrics(userId, playerTag), true);
        } catch (Exception unavailable) {
            return new CacheRead(Map.of(), false);
        }
    }

    private static boolean hasMetricPrefix(Map<String, Long> metrics, String prefix) {
        return metrics.keySet().stream().anyMatch(key -> key.startsWith(prefix));
    }

    private static void source(JsonObject sources, String key, boolean available, String detail) {
        JsonObject item = new JsonObject();
        item.addProperty("available", available);
        item.addProperty("detail", detail);
        sources.add(key, item);
    }

    public record Result(Map<String, Long> metrics, JsonObject sources, JsonArray officialAchievements, String clanTag) {
        public Result {
            metrics = Map.copyOf(metrics == null ? Map.of() : metrics);
            sources = sources == null ? new JsonObject() : sources.deepCopy();
            officialAchievements = officialAchievements == null ? new JsonArray() : officialAchievements.deepCopy();
            clanTag = clanTag == null ? "" : clanTag;
        }

        public Result(Map<String, Long> metrics, JsonObject sources) {
            this(metrics, sources, new JsonArray(), "");
        }
    }

    private record CacheRead(Map<String, Long> metrics, boolean available) {}
}
