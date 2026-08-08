package Java.achievements;

import Java.Config;
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
                        ? "Clan Family activity loaded; zero progress is valid when you have not used it yet."
                        : "Clan Family metrics could not be loaded."
        );
        source(
                sources,
                AchievementSources.ADVANCED_STATS,
                fast.advancedStatsAvailable(),
                fast.advancedStatsAvailable()
                        ? "Advanced Stats tracking totals loaded."
                        : "Start Advanced Stats to build tracked battle achievements."
        );

        CacheRead cached = readCachedHistory(userId, playerTag);
        metrics.putAll(cached.metrics());
        boolean cachedWar = hasMetricPrefix(cached.metrics(), "war_current_");
        boolean cachedCwl = hasMetricPrefix(cached.metrics(), "cwl_");
        String clanTag = fast.clanTag();

        if (clanTag == null || clanTag.isBlank()) {
            source(sources, AchievementSources.WAR, cachedWar,
                    cachedWar
                            ? "Previously observed regular-war history is cached. Join a clan to add newer wars."
                            : "Join a clan before ClashPanel can observe regular wars.");
            source(sources, AchievementSources.CWL, cachedCwl,
                    cachedCwl
                            ? "Previously indexed CWL history is cached. Join a clan to add newer seasons."
                            : "Join a clan before ClashPanel can index CWL history.");
        } else if (includeDeepHistory) {
            AchievementHistoryCollector.RefreshResult refresh = historyCollector.refresh(userId, playerTag, clanTag);
            CacheRead refreshed = readCachedHistory(userId, playerTag);
            metrics.putAll(refreshed.metrics());
            cachedWar = cachedWar || hasMetricPrefix(refreshed.metrics(), "war_current_");
            cachedCwl = cachedCwl || hasMetricPrefix(refreshed.metrics(), "cwl_");

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
        } else {
            source(
                    sources,
                    AchievementSources.WAR,
                    cachedWar,
                    cachedWar
                            ? "Cached regular-war achievements loaded; the background refresh checks the current war."
                            : "Regular-war history will be checked after the fast first render."
            );
            source(
                    sources,
                    AchievementSources.CWL,
                    cachedCwl,
                    cachedCwl
                            ? "Cached CWL achievements loaded; the background refresh checks only missing/new seasons."
                            : "CWL history starts indexing after the fast first render."
            );
        }

        collectMixedMetrics(metrics);
        boolean mixedAvailable = metrics.keySet().stream().anyMatch(key -> key.startsWith("fun_"));
        source(
                sources,
                AchievementSources.MIXED,
                mixedAvailable,
                mixedAvailable
                        ? "Cross-source signature achievements calculated from the data currently available."
                        : "More data sources are needed for signature achievements."
        );

        return new Result(Map.copyOf(metrics), sources);
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

    private static void collectMixedMetrics(Map<String, Long> metrics) {
        sumIfPresent(metrics, "fun_attack_defense_total", "profile_attack_wins", "profile_defense_wins");
        minIfPresent(metrics, "fun_support_balance", "profile_donations", "profile_donations_received");
        minIfPresent(metrics, "fun_dual_trophy_score", "profile_best_trophies", "profile_best_builder_trophies");
        sumIfPresent(metrics, "fun_social_score", "clashpanel_friends_count", "clashpanel_group_memberships", "clashpanel_polls_answered");
        weightedIfPresent(metrics, "fun_planner_score", "clashpanel_plans_owned", 5, "clashpanel_plans_joined", 1, "war_assignment_count", 1);
        copyIfPresent(metrics, "fun_cwl_cleaner", "cwl_perfect_attacks");
        copyIfPresent(metrics, "fun_war_machine", "profile_war_stars");
        copyIfPresent(metrics, "fun_account_army", "clashpanel_account_count");
        sumIfPresent(metrics, "fun_family_builder", "family_group_memberships", "family_clans_linked", "family_polls_created");
        copyIfPresent(metrics, "fun_achievement_hunter", "profile_native_achievement_stars");
    }

    private static void source(JsonObject sources, String key, boolean available, String detail) {
        JsonObject item = new JsonObject();
        item.addProperty("available", available);
        item.addProperty("detail", detail);
        sources.add(key, item);
    }

    private static void put(Map<String, Long> metrics, String key, long value) {
        metrics.put(key, Math.max(0L, value));
    }

    private static void copyIfPresent(Map<String, Long> metrics, String output, String input) {
        if (metrics.containsKey(input)) put(metrics, output, metrics.get(input));
    }

    private static void minIfPresent(Map<String, Long> metrics, String output, String left, String right) {
        if (metrics.containsKey(left) && metrics.containsKey(right)) {
            put(metrics, output, Math.min(metrics.get(left), metrics.get(right)));
        }
    }

    private static void sumIfPresent(Map<String, Long> metrics, String output, String... inputs) {
        long sum = 0;
        for (String input : inputs) {
            if (!metrics.containsKey(input)) return;
            sum += metrics.get(input);
        }
        put(metrics, output, sum);
    }

    private static void weightedIfPresent(
            Map<String, Long> metrics,
            String output,
            String first,
            long firstWeight,
            String second,
            long secondWeight,
            String third,
            long thirdWeight
    ) {
        if (!metrics.containsKey(first) || !metrics.containsKey(second) || !metrics.containsKey(third)) return;
        put(metrics, output,
                metrics.get(first) * firstWeight
                        + metrics.get(second) * secondWeight
                        + metrics.get(third) * thirdWeight);
    }

    public record Result(Map<String, Long> metrics, JsonObject sources) {}
    private record CacheRead(Map<String, Long> metrics, boolean available) {}
}
