package Java.achievements;

import Java.API_Utils;
import Java.Config;
import Java.SUPABASE_Client;
import Java.cache.CachePolicy;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Collects fast/non-history achievement sources. Heavy war/CWL history is handled
 * by AchievementHistoryCollector and never blocks the first page render.
 */
public final class AchievementFastMetrics {
    public record Result(
            Map<String, Long> metrics,
            boolean liveProfileAvailable,
            boolean clashPanelAvailable,
            boolean advancedStatsAvailable,
            String clanTag,
            String liveProfileError,
            String clashPanelError,
            String advancedStatsError
    ) {}

    private final API_Utils utils;

    public AchievementFastMetrics(Config config) {
        this.utils = new API_Utils(config);
    }

    public Result collect(String userId, String playerTag) {
        Map<String, Long> metrics = new LinkedHashMap<>();
        boolean liveAvailable = false;
        boolean appAvailable = false;
        boolean statsAvailable = false;
        String clanTag = "";
        String liveError = "";
        String appError = "";
        String statsError = "";

        try {
            JsonObject profile = JsonParser.parseString(
                    utils.clashGetCachedValue(
                            "/players/" + URLEncoder.encode(playerTag, StandardCharsets.UTF_8),
                            CachePolicy.PLAYER_INFO
                    )
            ).getAsJsonObject();
            metrics.putAll(profileMetrics(profile));
            clanTag = nestedString(profile, "clan", "tag");
            liveAvailable = true;
        } catch (Exception error) {
            liveError = errorCode(error);
        }

        try {
            metrics.putAll(readRpcMetrics("read_clashpanel_achievement_metrics_v1", userId, null));
            appAvailable = true;
        } catch (Exception error) {
            appError = errorCode(error);
        }

        try {
            JsonObject body = new JsonObject();
            body.addProperty("p_user_id", userId);
            body.addProperty("p_player_tag", playerTag);
            JsonElement parsed = JsonParser.parseString(
                    SUPABASE_Client.rpc("read_advanced_stats_broad_achievement_metrics_v1", body.toString())
            );
            JsonObject response = parsed != null && parsed.isJsonObject()
                    ? parsed.getAsJsonObject()
                    : new JsonObject();
            statsAvailable = bool(response, "available");
            mergeNumeric(metrics, object(response.get("metrics")));
        } catch (Exception error) {
            statsError = errorCode(error);
        }

        return new Result(
                Map.copyOf(metrics),
                liveAvailable,
                appAvailable,
                statsAvailable,
                clanTag,
                liveError,
                appError,
                statsError
        );
    }

    private Map<String, Long> profileMetrics(JsonObject profile) {
        Map<String, Long> metrics = new LinkedHashMap<>();
        initializeLiveCatalogDefaults(metrics);

        long trophies = number(profile, "trophies");
        long bestTrophies = number(profile, "bestTrophies");
        long attackWins = number(profile, "attackWins");
        long defenseWins = number(profile, "defenseWins");
        long builderTrophies = firstNumber(profile, "builderBaseTrophies", "versusTrophies");
        long bestBuilderTrophies = firstNumber(profile, "bestBuilderBaseTrophies", "bestVersusTrophies");
        long donations = number(profile, "donations");
        long donationsReceived = number(profile, "donationsReceived");
        long warStars = number(profile, "warStars");

        metrics.put("profile_trophies", trophies);
        metrics.put("profile_best_trophies", bestTrophies);
        metrics.put("profile_attack_wins", attackWins);
        metrics.put("profile_defense_wins", defenseWins);
        metrics.put("profile_exp_level", number(profile, "expLevel"));
        metrics.put("profile_builder_trophies", builderTrophies);
        metrics.put("profile_best_builder_trophies", bestBuilderTrophies);
        metrics.put("profile_war_stars", warStars);
        metrics.put("profile_donations", donations);
        metrics.put("profile_donations_received", donationsReceived);
        metrics.put("profile_total_support_current", donations + donationsReceived);
        metrics.put("profile_donation_ratio_percent", donationRatio(donations, donationsReceived));
        metrics.put("profile_capital_contributions", number(profile, "clanCapitalContributions"));
        metrics.put("profile_town_hall", number(profile, "townHallLevel"));
        metrics.put("profile_builder_hall", firstNumber(profile, "builderHallLevel", "builderHallLevel"));

        JsonObject clan = object(profile.get("clan"));
        metrics.put("profile_in_clan", clan.size() > 0 ? 1L : 0L);
        metrics.put("profile_clan_level", number(clan, "clanLevel"));
        metrics.put("profile_role_rank", roleRank(string(profile, "role")));

        JsonArray heroes = array(profile.get("heroes"));
        JsonArray troops = array(profile.get("troops"));
        JsonArray spells = array(profile.get("spells"));
        JsonArray equipment = firstArray(profile, "heroEquipment", "equipment");

        metrics.put("profile_hero_count", countVillage(heroes, "home"));
        metrics.put("profile_hero_level_sum", sumVillageLevels(heroes, "home"));
        metrics.put("profile_troop_count", countVillage(troops, "home"));
        metrics.put("profile_spell_count", countVillage(spells, "home"));
        metrics.put("profile_equipment_count", equipment.size());

        collectMasteryRows(troops, "troop", metrics);
        collectMasteryRows(heroes, "hero", metrics);
        collectMasteryRows(spells, "spell", metrics);
        collectMasteryRows(equipment, "equipment", metrics);

        long nativeStars = 0;
        for (JsonElement element : array(profile.get("achievements"))) {
            if (!element.isJsonObject()) continue;
            JsonObject achievement = element.getAsJsonObject();
            String name = string(achievement, "name");
            if (name.isBlank()) continue;
            String slug = AchievementCatalogExpansion.slug(name);
            long value = number(achievement, "value");
            long stars = number(achievement, "stars");
            metrics.put("native_" + slug, value);
            metrics.put("native_stars_" + slug, stars);
            nativeStars += stars;
        }
        metrics.put("profile_native_achievement_stars", nativeStars);

        metrics.put("fun_attack_defense_total", attackWins + defenseWins);
        metrics.put("fun_support_balance", Math.min(donations, donationsReceived));
        metrics.put("fun_dual_trophy_score", Math.min(bestTrophies, bestBuilderTrophies));
        metrics.put("fun_war_machine", warStars);
        metrics.put("fun_achievement_hunter", nativeStars);
        return Map.copyOf(metrics);
    }

    private void initializeLiveCatalogDefaults(Map<String, Long> metrics) {
        for (AchievementDefinition definition : AchievementCatalog.definitions()) {
            String metric = definition.metric();
            if (metric.startsWith("mastery_") || metric.startsWith("native_stars_")) {
                metrics.putIfAbsent(metric, 0L);
            }
        }
    }

    private void collectMasteryRows(JsonArray rows, String kind, Map<String, Long> metrics) {
        for (JsonElement element : rows) {
            if (!element.isJsonObject()) continue;
            JsonObject item = element.getAsJsonObject();
            String name = string(item, "name");
            if (name.isBlank()) continue;
            long level = number(item, "level");
            long maxLevel = number(item, "maxLevel");
            if (maxLevel <= 0) continue;

            String prefix;
            if ("spell".equals(kind)) {
                prefix = "mastery_spell_";
            } else if ("equipment".equals(kind)) {
                prefix = "mastery_equipment_";
            } else {
                String village = string(item, "village");
                boolean builder = "builderbase".equalsIgnoreCase(village)
                        || "builder_base".equalsIgnoreCase(village)
                        || "builder".equalsIgnoreCase(village);
                prefix = builder ? "mastery_builder_" : "mastery_home_";
            }
            long percentage = Math.min(100, level * 100L / maxLevel);
            metrics.put(prefix + AchievementCatalogExpansion.slug(name), percentage);
        }
    }

    private Map<String, Long> readRpcMetrics(String function, String userId, String playerTag) throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("p_user_id", userId);
        if (playerTag != null) body.addProperty("p_player_tag", playerTag);
        JsonElement parsed = JsonParser.parseString(SUPABASE_Client.rpc(function, body.toString()));
        JsonObject object = parsed != null && parsed.isJsonObject() ? parsed.getAsJsonObject() : new JsonObject();
        Map<String, Long> result = new LinkedHashMap<>();
        mergeNumeric(result, object);
        return Map.copyOf(result);
    }

    private static void mergeNumeric(Map<String, Long> target, JsonObject source) {
        for (Map.Entry<String, JsonElement> entry : source.entrySet()) {
            JsonElement value = entry.getValue();
            if (value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isNumber()) {
                target.put(entry.getKey(), Math.max(0L, value.getAsLong()));
            }
        }
    }

    private static long donationRatio(long donated, long received) {
        if (donated <= 0) return 0;
        if (received <= 0) return 1000;
        return Math.min(1000, Math.round((donated * 100.0) / received));
    }

    private static long roleRank(String role) {
        String normalized = role == null ? "" : role.replace("_", "").replace("-", "").toLowerCase();
        return switch (normalized) {
            case "leader" -> 4;
            case "coleader" -> 3;
            case "admin", "elder" -> 2;
            case "member" -> 1;
            default -> 0;
        };
    }

    private static long countVillage(JsonArray values, String village) {
        long count = 0;
        for (JsonElement element : values) {
            if (!element.isJsonObject()) continue;
            JsonObject item = element.getAsJsonObject();
            String itemVillage = string(item, "village");
            if (itemVillage.isBlank() || village.equalsIgnoreCase(itemVillage)) count++;
        }
        return count;
    }

    private static long sumVillageLevels(JsonArray values, String village) {
        long result = 0;
        for (JsonElement element : values) {
            if (!element.isJsonObject()) continue;
            JsonObject value = element.getAsJsonObject();
            String itemVillage = string(value, "village");
            if (itemVillage.isBlank() || village.equalsIgnoreCase(itemVillage)) result += number(value, "level");
        }
        return result;
    }

    private static JsonArray firstArray(JsonObject object, String... fields) {
        for (String field : fields) {
            JsonArray values = array(object.get(field));
            if (!values.isEmpty()) return values;
        }
        return new JsonArray();
    }

    private static long firstNumber(JsonObject object, String... fields) {
        for (String field : fields) {
            JsonElement value = object.get(field);
            if (value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isNumber()) {
                return Math.max(0L, value.getAsLong());
            }
        }
        return 0;
    }

    private static long number(JsonObject object, String field) {
        return firstNumber(object, field);
    }

    private static boolean bool(JsonObject object, String field) {
        JsonElement value = object.get(field);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isBoolean() && value.getAsBoolean();
    }

    private static JsonObject object(JsonElement value) {
        return value != null && value.isJsonObject() ? value.getAsJsonObject() : new JsonObject();
    }

    private static JsonArray array(JsonElement value) {
        return value != null && value.isJsonArray() ? value.getAsJsonArray() : new JsonArray();
    }

    private static String string(JsonObject object, String field) {
        JsonElement value = object.get(field);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isString()
                ? value.getAsString().trim()
                : "";
    }

    private static String nestedString(JsonObject object, String parent, String field) {
        return string(AchievementFastMetrics.object(object.get(parent)), field);
    }

    private static String errorCode(Exception error) {
        String value = error.getClass().getSimpleName();
        return value == null || value.isBlank() ? "SOURCE_ERROR" : value.toUpperCase();
    }
}
