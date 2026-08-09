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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
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
            String advancedStatsError,
            JsonArray officialAchievements,
            boolean clanProfileAvailable,
            String clanProfileError
    ) {
        public Result {
            metrics = Map.copyOf(metrics == null ? Map.of() : metrics);
            officialAchievements = officialAchievements == null ? new JsonArray() : officialAchievements.deepCopy();
        }

        public Result(
                Map<String, Long> metrics,
                boolean liveProfileAvailable,
                boolean clashPanelAvailable,
                boolean advancedStatsAvailable,
                String clanTag,
                String liveProfileError,
                String clashPanelError,
                String advancedStatsError
        ) {
            this(metrics, liveProfileAvailable, clashPanelAvailable, advancedStatsAvailable, clanTag,
                    liveProfileError, clashPanelError, advancedStatsError, new JsonArray(), false, "");
        }
    }

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
        JsonArray officialAchievements = new JsonArray();
        boolean clanProfileAvailable = false;
        String clanProfileError = "";

        try {
            JsonObject profile = JsonParser.parseString(
                    utils.clashGetCachedValue(
                            "/players/" + URLEncoder.encode(playerTag, StandardCharsets.UTF_8),
                            CachePolicy.PLAYER_INFO
                    )
            ).getAsJsonObject();
            metrics.putAll(profileMetrics(profile));
            clanTag = nestedString(profile, "clan", "tag");
            officialAchievements = array(profile.get("achievements")).deepCopy();
            liveAvailable = true;
        } catch (Exception error) {
            liveError = errorCode(error);
        }

        if (!clanTag.isBlank()) {
            try {
                String encodedClanTag = URLEncoder.encode(clanTag, StandardCharsets.UTF_8);
                JsonObject clan = JsonParser.parseString(utils.clashGetCachedValue(
                        "/clans/" + encodedClanTag, CachePolicy.CLAN_INFO)).getAsJsonObject();
                JsonObject members = JsonParser.parseString(utils.clashGetCachedValue(
                        "/clans/" + encodedClanTag + "/members", CachePolicy.CLAN_MEMBERS)).getAsJsonObject();
                metrics.putAll(ClanAchievementMetrics.normalize(clanTag, clan, members));
                clanProfileAvailable = true;
            } catch (Exception error) {
                clanProfileError = errorCode(error);
            }
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
            if (statsAvailable) {
                mergeNumeric(metrics, object(response.get("metrics")));
            }
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
                statsError,
                officialAchievements,
                clanProfileAvailable,
                clanProfileError
        );
    }

    private Map<String, Long> profileMetrics(JsonObject profile) {
        Map<String, Long> metrics = new LinkedHashMap<>();

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
        metrics.put("profile_capital_contributions", number(profile, "clanCapitalContributions"));
        metrics.put("profile_town_hall", number(profile, "townHallLevel"));
        metrics.put("profile_builder_hall", number(profile, "builderHallLevel"));
        metrics.put("profile_legend_trophies", number(object(profile.get("legendStatistics")), "legendTrophies"));
        metrics.put("profile_war_ready", "in".equalsIgnoreCase(string(profile, "warPreference")) ? 1L : 0L);

        JsonObject clan = object(profile.get("clan"));
        metrics.put("profile_in_clan", clan.size() > 0 ? 1L : 0L);
        metrics.put("profile_clan_level", number(clan, "clanLevel"));
        metrics.put("profile_role_rank", roleRank(string(profile, "role")));

        JsonObject league = object(profile.get("league"));
        JsonArray labels = array(profile.get("labels"));
        metrics.put("profile_complete", clan.size() > 0 && league.size() > 0 && labels.size() >= 3 ? 1L : 0L);

        JsonArray heroes = array(profile.get("heroes"));
        JsonArray troops = array(profile.get("troops"));
        JsonArray spells = array(profile.get("spells"));
        JsonArray equipment = firstArray(profile, "heroEquipment", "equipment");

        List<Long> homeHeroLevels = villageLevels(heroes, "home");
        metrics.put("profile_hero_count", (long) homeHeroLevels.size());
        metrics.put("profile_hero_level_sum", sum(homeHeroLevels));
        metrics.put("profile_builder_hero_level_sum", sum(villageLevels(heroes, "builderBase", "builder_base", "builder")));
        metrics.put("profile_troop_count", countVillage(troops, "home"));
        metrics.put("profile_spell_count", countVillage(spells, "home"));
        metrics.put("profile_equipment_count", (long) equipment.size());
        metrics.put("profile_equipment_level_sum", sumLevels(equipment));

        long maxEquipment = 0;
        boolean everyReturnedEquipmentMax = !equipment.isEmpty();
        for (JsonElement element : equipment) {
            if (!element.isJsonObject()) continue;
            JsonObject item = element.getAsJsonObject();
            long level = number(item, "level");
            long maxLevel = number(item, "maxLevel");
            if (maxLevel > 0 && level >= maxLevel) maxEquipment++;
            else everyReturnedEquipmentMax = false;
        }
        metrics.put("profile_equipment_max_count", maxEquipment);
        metrics.put("profile_all_returned_equipment_max", everyReturnedEquipmentMax ? 1L : 0L);
        metrics.put("profile_balanced_heroes", balancedWithin(homeHeroLevels, 5, 3) ? 1L : 0L);

        long activeSuperTroops = 0;
        for (JsonElement element : troops) {
            if (!element.isJsonObject()) continue;
            JsonObject troop = element.getAsJsonObject();
            JsonElement active = troop.get("superTroopIsActive");
            if (active != null && active.isJsonPrimitive() && active.getAsJsonPrimitive().isBoolean() && active.getAsBoolean()) {
                activeSuperTroops++;
            }
        }
        metrics.put("profile_super_troop_active_count", activeSuperTroops);
        metrics.put("profile_super_troop_active", activeSuperTroops > 0 ? 1L : 0L);

        long nativeStars = 0;
        long completedAchievements = 0;
        JsonArray achievements = array(profile.get("achievements"));
        for (JsonElement element : achievements) {
            if (!element.isJsonObject()) continue;
            JsonObject achievement = element.getAsJsonObject();
            long value = number(achievement, "value");
            long target = number(achievement, "target");
            nativeStars += number(achievement, "stars");
            if (target > 0 && value >= target) completedAchievements++;
        }
        metrics.put("profile_native_achievement_stars", nativeStars);
        metrics.put("profile_completed_achievement_count", completedAchievements);
        metrics.put("profile_achievement_completion_pct", achievements.isEmpty()
                ? 0L : Math.min(100L, completedAchievements * 100L / achievements.size()));

        double donationRatio = donationsReceived <= 0 ? (donations > 0 ? Double.POSITIVE_INFINITY : 0.0)
                : (double) donations / donationsReceived;
        metrics.put("profile_generous_spirit", donations >= 5_000 && donationRatio >= 5.0 ? 1L : 0L);
        metrics.put("profile_balanced_donation", donations >= 5_000 && donationsReceived >= 5_000
                && donationRatio >= 0.75 && donationRatio <= 1.25 ? 1L : 0L);

        return Map.copyOf(metrics);
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
        return villageLevels(values, village).size();
    }

    private static List<Long> villageLevels(JsonArray values, String... villages) {
        List<Long> levels = new ArrayList<>();
        for (JsonElement element : values) {
            if (!element.isJsonObject()) continue;
            JsonObject item = element.getAsJsonObject();
            String itemVillage = string(item, "village");
            boolean match = itemVillage.isBlank();
            for (String village : villages) {
                if (village.equalsIgnoreCase(itemVillage)) match = true;
            }
            if (match) levels.add(number(item, "level"));
        }
        return levels;
    }

    private static long sumLevels(JsonArray values) {
        long total = 0;
        for (JsonElement element : values) {
            if (element.isJsonObject()) total += number(element.getAsJsonObject(), "level");
        }
        return total;
    }

    private static long sum(List<Long> values) {
        long total = 0;
        for (Long value : values) total += Math.max(0L, value == null ? 0L : value);
        return total;
    }

    private static boolean balancedWithin(List<Long> values, long spread, int minimumCount) {
        if (values == null || values.size() < minimumCount) return false;
        long min = Long.MAX_VALUE;
        long max = Long.MIN_VALUE;
        for (Long value : values) {
            long level = value == null ? 0L : value;
            min = Math.min(min, level);
            max = Math.max(max, level);
        }
        return max - min <= spread;
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
