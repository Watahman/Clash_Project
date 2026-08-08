package Java.achievements;

import Java.API_Utils;
import Java.Config;
import Java.SUPABASE_Client;
import Java.cache.CachePolicy;
import Java.cwlhistory.HistoricalCwlProviderFactory;
import Java.cwlhistory.HistoricalCwlSeason;
import Java.cwlhistory.HistoricalCwlService;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/** Collects achievement metrics without making one optional data source fatal. */
public final class AchievementMetricCollector {
    private final API_Utils utils;
    private final HistoricalCwlService cwlHistory;

    public AchievementMetricCollector(Config conf) {
        this.utils = new API_Utils(conf);
        this.cwlHistory = new HistoricalCwlService(HistoricalCwlProviderFactory.create(conf));
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

        source(sources, AchievementSources.BASE_DATA, !metrics.isEmpty(),
                metrics.isEmpty() ? "Import base data to unlock this source." : "Latest imported base-data snapshot loaded.");
        source(sources, AchievementSources.BASE_HISTORY,
                metrics.containsKey("snapshot_import_count") || metrics.containsKey("tracked_days"),
                metrics.containsKey("snapshot_import_count") ? "Imported snapshot history loaded." : "Import snapshots over time to build history.");

        String clanTag = "";
        try {
            clanTag = collectLiveProfile(playerTag, metrics);
            source(sources, AchievementSources.LIVE_PROFILE, true, "Live Clash profile loaded.");
        } catch (Exception unavailable) {
            source(sources, AchievementSources.LIVE_PROFILE, false, "Live Clash profile is temporarily unavailable.");
        }

        try {
            collectClashPanelUsage(userId, metrics);
            source(sources, AchievementSources.CLASHPANEL, true, "ClashPanel usage data loaded.");
            source(sources, AchievementSources.CLAN_FAMILY,
                    metrics.getOrDefault("family_group_memberships", 0L) > 0
                            || metrics.getOrDefault("family_groups_owned", 0L) > 0,
                    "Clan Family activity is measured from ClashPanel usage.");
        } catch (Exception unavailable) {
            source(sources, AchievementSources.CLASHPANEL, false, "ClashPanel usage metrics could not be loaded.");
            source(sources, AchievementSources.CLAN_FAMILY, false, "Clan Family metrics could not be loaded.");
        }

        try {
            boolean active = collectAdvancedStats(userId, playerTag, metrics);
            source(sources, AchievementSources.ADVANCED_STATS, active,
                    active ? "Advanced Stats tracking data loaded." : "Start Advanced Stats to build tracked battle achievements.");
        } catch (Exception unavailable) {
            source(sources, AchievementSources.ADVANCED_STATS, false, "Advanced Stats metrics could not be loaded.");
        }

        if (!clanTag.isBlank()) {
            try {
                boolean observed = collectCurrentWar(clanTag, playerTag, metrics);
                source(sources, AchievementSources.WAR, observed,
                        observed ? "Current regular war data observed." : "No active regular war participation is visible right now.");
            } catch (Exception unavailable) {
                source(sources, AchievementSources.WAR, false, "Current regular war data is unavailable.");
            }
        } else {
            source(sources, AchievementSources.WAR, false, "Join a clan to observe regular-war achievements.");
        }

        if (includeDeepHistory && !clanTag.isBlank()) {
            try {
                int seasons = collectCwlHistory(clanTag, playerTag, metrics);
                source(sources, AchievementSources.CWL, seasons > 0,
                        seasons > 0
                                ? "Available CWL history loaded for the current clan."
                                : "No matching CWL history was found for this player in the current clan.");
            } catch (Exception unavailable) {
                source(sources, AchievementSources.CWL, false, "CWL history could not be loaded.");
            }
        } else {
            source(sources, AchievementSources.CWL, false,
                    clanTag.isBlank()
                            ? "Join a clan to scan CWL history."
                            : "CWL history loads after the fast first render.");
        }

        collectMixedMetrics(metrics);
        boolean mixed = metrics.keySet().stream().anyMatch(key -> key.startsWith("fun_"));
        source(sources, AchievementSources.MIXED, mixed,
                mixed ? "Cross-source signature achievements calculated." : "More data sources are needed for signature achievements.");

        return new Result(Map.copyOf(metrics), sources);
    }

    private String collectLiveProfile(String playerTag, Map<String, Long> metrics) throws Exception {
        String encoded = URLEncoder.encode(playerTag, StandardCharsets.UTF_8);
        String raw = utils.clashGetFreshValue("/players/" + encoded, CachePolicy.PLAYER_INFO);
        JsonObject player = JsonParser.parseString(raw).getAsJsonObject();

        // A successful profile read means known live-profile achievements are
        // measurable even when a unit/achievement is still locked or at zero.
        initializeLiveCatalogDefaults(metrics);

        put(metrics, "profile_town_hall", number(player, "townHallLevel"));
        put(metrics, "profile_builder_hall", number(player, "builderHallLevel"));
        put(metrics, "profile_exp_level", number(player, "expLevel"));
        put(metrics, "profile_trophies", number(player, "trophies"));
        put(metrics, "profile_best_trophies", number(player, "bestTrophies"));
        put(metrics, "profile_builder_trophies", number(player, "builderBaseTrophies"));
        put(metrics, "profile_best_builder_trophies", number(player, "bestBuilderBaseTrophies"));
        put(metrics, "profile_war_stars", number(player, "warStars"));
        put(metrics, "profile_attack_wins", number(player, "attackWins"));
        put(metrics, "profile_defense_wins", number(player, "defenseWins"));
        put(metrics, "profile_capital_contributions", number(player, "clanCapitalContributions"));
        put(metrics, "profile_donations", number(player, "donations"));
        put(metrics, "profile_donations_received", number(player, "donationsReceived"));

        long donated = metrics.getOrDefault("profile_donations", 0L);
        long received = metrics.getOrDefault("profile_donations_received", 0L);
        put(metrics, "profile_total_support_current", donated + received);
        put(metrics, "profile_donation_ratio_percent", received > 0 ? donated * 100L / received : donated > 0 ? 1000 : 0);

        JsonObject clan = object(player, "clan");
        String clanTag = string(clan, "tag");
        put(metrics, "profile_in_clan", clanTag.isBlank() ? 0 : 1);
        put(metrics, "profile_clan_level", number(clan, "clanLevel"));
        put(metrics, "profile_role_rank", roleRank(string(player, "role")));

        JsonArray heroRows = array(player, "heroes");
        JsonArray troopRows = array(player, "troops");
        JsonArray spellRows = array(player, "spells");
        JsonArray equipmentRows = firstArray(player, "heroEquipment", "equipment");

        UnitTotals heroes = unitTotals(heroRows, true);
        UnitTotals troops = unitTotals(troopRows, true);
        UnitTotals spells = unitTotals(spellRows, false);
        UnitTotals equipment = unitTotals(equipmentRows, false);
        put(metrics, "profile_hero_count", heroes.count());
        put(metrics, "profile_hero_level_sum", heroes.levelSum());
        put(metrics, "profile_troop_count", troops.count());
        put(metrics, "profile_spell_count", spells.count());
        put(metrics, "profile_equipment_count", equipment.count());

        collectMasteryRows(troopRows, "troop", metrics);
        collectMasteryRows(heroRows, "hero", metrics);
        collectMasteryRows(spellRows, "spell", metrics);
        collectMasteryRows(equipmentRows, "equipment", metrics);

        long nativeStars = 0;
        for (JsonElement element : array(player, "achievements")) {
            if (!element.isJsonObject()) continue;
            JsonObject achievement = element.getAsJsonObject();
            String name = string(achievement, "name");
            if (name.isBlank()) continue;
            String slug = AchievementCatalogExpansion.slug(name);
            put(metrics, "native_" + slug, number(achievement, "value"));
            put(metrics, "native_stars_" + slug, number(achievement, "stars"));
            nativeStars += number(achievement, "stars");
        }
        put(metrics, "profile_native_achievement_stars", nativeStars);
        return clanTag;
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
            put(metrics, prefix + AchievementCatalogExpansion.slug(name), percentage);
        }
    }

    private boolean collectCurrentWar(String clanTag, String playerTag, Map<String, Long> metrics) throws Exception {
        String encoded = URLEncoder.encode(clanTag, StandardCharsets.UTF_8);
        String raw = utils.clashGetFreshValue("/clans/" + encoded + "/currentwar", CachePolicy.CLAN_CURRENT_WAR);
        JsonObject war = JsonParser.parseString(raw).getAsJsonObject();
        String state = string(war, "state");
        if (state.isBlank() || "notInWar".equalsIgnoreCase(state)) return false;

        JsonObject ownSide = object(war, "clan");
        JsonObject opponent = object(war, "opponent");
        Map<String, Long> defenderTownHalls = new HashMap<>();
        for (JsonElement element : array(opponent, "members")) {
            if (!element.isJsonObject()) continue;
            JsonObject member = element.getAsJsonObject();
            defenderTownHalls.put(string(member, "tag"), number(member, "townhallLevel"));
        }

        JsonObject player = null;
        for (JsonElement element : array(ownSide, "members")) {
            if (!element.isJsonObject()) continue;
            JsonObject candidate = element.getAsJsonObject();
            if (playerTag.equalsIgnoreCase(string(candidate, "tag"))) {
                player = candidate;
                break;
            }
        }
        if (player == null) return false;

        JsonArray attacks = array(player, "attacks");
        long stars = 0;
        long destruction = 0;
        long threes = 0;
        long twos = 0;
        long uphitThrees = 0;
        long attackerTh = number(player, "townhallLevel");
        for (JsonElement element : attacks) {
            if (!element.isJsonObject()) continue;
            JsonObject attack = element.getAsJsonObject();
            long attackStars = number(attack, "stars");
            long attackDestruction = Math.round(decimal(attack, "destructionPercentage"));
            stars += attackStars;
            destruction += attackDestruction;
            if (attackStars == 3) {
                threes++;
                long defenderTh = defenderTownHalls.getOrDefault(string(attack, "defenderTag"), 0L);
                if (defenderTh > attackerTh && attackerTh > 0) uphitThrees++;
            } else if (attackStars == 2) {
                twos++;
            }
        }
        put(metrics, "war_current_participation", 1);
        put(metrics, "war_current_attacks", attacks.size());
        put(metrics, "war_current_stars", stars);
        put(metrics, "war_current_destruction", destruction);
        put(metrics, "war_current_three_stars", threes);
        put(metrics, "war_current_two_stars", twos);
        put(metrics, "war_current_uphit_three_stars", uphitThrees);
        return true;
    }

    private int collectCwlHistory(String clanTag, String playerTag, Map<String, Long> metrics) throws Exception {
        var seasons = cwlHistory.getOverview(clanTag, 24);
        long seasonsPlayed = 0;
        long warsPlayed = 0;
        long attacks = 0;
        long stars = 0;
        long threes = 0;
        long twos = 0;
        long perfectAttacks = 0;
        long uphitThrees = 0;
        long perfectSeasons = 0;
        long clanWins = 0;
        long top3 = 0;

        for (HistoricalCwlSeason season : seasons) {
            boolean seasonPlayerSeen = season.roster().stream().anyMatch(player -> playerTag.equalsIgnoreCase(player.tag()));
            int seasonWars = 0;
            int seasonAttacks = 0;
            boolean seasonPerfect = true;
            for (HistoricalCwlSeason.War war : season.wars()) {
                if (war.clan() == null) continue;
                HistoricalCwlSeason.Member member = war.clan().members().stream()
                        .filter(value -> playerTag.equalsIgnoreCase(value.tag()))
                        .findFirst().orElse(null);
                if (member == null) continue;
                seasonPlayerSeen = true;
                seasonWars++;
                warsPlayed++;
                if (member.attacks().isEmpty()) seasonPerfect = false;
                for (HistoricalCwlSeason.Attack attack : member.attacks()) {
                    seasonAttacks++;
                    attacks++;
                    stars += attack.stars();
                    if (attack.stars() == 3) threes++;
                    if (attack.stars() == 2) twos++;
                    if (attack.stars() == 3 && attack.destruction() >= 99.999) perfectAttacks++;
                    if (attack.stars() == 3 && attack.defenderTownHall() > attack.attackerTownHall()) uphitThrees++;
                    if (attack.stars() != 3 || attack.destruction() < 99.999) seasonPerfect = false;
                }
            }
            if (!seasonPlayerSeen) continue;
            seasonsPlayed++;
            if (season.record() != null) clanWins += Math.max(0, season.record().wins());
            if (season.position() != null && season.position() > 0 && season.position() <= 3) top3++;
            if (seasonWars > 0 && seasonAttacks >= seasonWars && seasonPerfect) perfectSeasons++;
        }

        put(metrics, "cwl_seasons_played", seasonsPlayed);
        put(metrics, "cwl_wars_played", warsPlayed);
        put(metrics, "cwl_attacks", attacks);
        put(metrics, "cwl_stars", stars);
        put(metrics, "cwl_three_stars", threes);
        put(metrics, "cwl_two_stars", twos);
        put(metrics, "cwl_perfect_attacks", perfectAttacks);
        put(metrics, "cwl_uphit_three_stars", uphitThrees);
        put(metrics, "cwl_perfect_seasons", perfectSeasons);
        put(metrics, "cwl_clan_wins", clanWins);
        put(metrics, "cwl_top3_finishes", top3);
        return (int) seasonsPlayed;
    }

    private boolean collectAdvancedStats(String userId, String playerTag, Map<String, Long> metrics) throws Exception {
        JsonArray trackingRows = rows("advanced_stats_tracking",
                "select=id,status&user_id=" + SUPABASE_Client.eq(userId)
                        + "&player_tag=" + SUPABASE_Client.eq(playerTag) + "&limit=1");
        if (trackingRows.isEmpty()) return false;
        String trackingId = string(trackingRows.get(0).getAsJsonObject(), "id");
        if (trackingId.isBlank()) return false;

        JsonArray daily = rows("advanced_stats_daily",
                "select=stat_date,attacks,total_stars,three_star_attacks,two_star_attacks,one_star_attacks,zero_star_attacks,gold_looted,elixir_looted,dark_elixir_looted"
                        + "&tracking_id=" + SUPABASE_Client.eq(trackingId));
        long attacks = 0, stars = 0, threes = 0, twos = 0, ones = 0, zeroes = 0;
        long gold = 0, elixir = 0, dark = 0, activeDays = 0;
        for (JsonElement element : daily) {
            if (!element.isJsonObject()) continue;
            JsonObject row = element.getAsJsonObject();
            long dayAttacks = number(row, "attacks");
            attacks += dayAttacks;
            stars += number(row, "total_stars");
            threes += number(row, "three_star_attacks");
            twos += number(row, "two_star_attacks");
            ones += number(row, "one_star_attacks");
            zeroes += number(row, "zero_star_attacks");
            gold += number(row, "gold_looted");
            elixir += number(row, "elixir_looted");
            dark += number(row, "dark_elixir_looted");
            if (dayAttacks > 0) activeDays++;
        }
        put(metrics, "tracked_attack_count", attacks);
        put(metrics, "tracked_star_count", stars);
        put(metrics, "tracked_three_star_count", threes);
        put(metrics, "tracked_two_star_count", twos);
        put(metrics, "tracked_one_star_count", ones);
        put(metrics, "tracked_zero_star_count", zeroes);
        put(metrics, "tracked_gold_looted", gold);
        put(metrics, "tracked_elixir_looted", elixir);
        put(metrics, "tracked_dark_elixir_looted", dark);
        put(metrics, "tracked_active_days", activeDays);
        return true;
    }

    private void collectClashPanelUsage(String userId, Map<String, Long> metrics) throws Exception {
        long plansOwned = rowCount("plans", "select=id&owner_id=" + SUPABASE_Client.eq(userId));
        long plansJoined = rowCount("plan_users", "select=plan_id&user_id=" + SUPABASE_Client.eq(userId));
        long groupsOwned = rowCount("groups", "select=id&owner_id=" + SUPABASE_Client.eq(userId));
        JsonArray memberships = rows("group_members", "select=group_id,role&user_id=" + SUPABASE_Client.eq(userId));
        long pollsCreated = rowCount("group_polls", "select=id&creator_id=" + SUPABASE_Client.eq(userId));
        long pollsAnswered = rowCount("group_poll_answers", "select=id&user_id=" + SUPABASE_Client.eq(userId));
        long assignments = rowCount("regular_war_assignments", "select=id&user_id=" + SUPABASE_Client.eq(userId));
        long accounts = rowCount("user_accounts", "select=id&user_id=" + SUPABASE_Client.eq(userId));
        long clansLinked = rowCount("group_clans", "select=id&added_by=" + SUPABASE_Client.eq(userId));
        long reminders = rowCount("poll_reminder_deliveries", "select=id&sender_id=" + SUPABASE_Client.eq(userId));
        long friends = rowCount("friends", "select=user_a,user_b&status=eq.accepted&or=(user_a.eq." + userId + ",user_b.eq." + userId + ")");

        long roleRank = 0;
        for (JsonElement element : memberships) {
            if (!element.isJsonObject()) continue;
            roleRank = Math.max(roleRank, familyRoleRank(string(element.getAsJsonObject(), "role")));
        }

        put(metrics, "clashpanel_plans_owned", plansOwned);
        put(metrics, "clashpanel_plans_joined", plansJoined);
        put(metrics, "clashpanel_groups_owned", groupsOwned);
        put(metrics, "clashpanel_group_memberships", memberships.size());
        put(metrics, "clashpanel_polls_created", pollsCreated);
        put(metrics, "clashpanel_polls_answered", pollsAnswered);
        put(metrics, "war_assignment_count", assignments);
        put(metrics, "clashpanel_friends_count", friends);
        put(metrics, "clashpanel_account_count", accounts);

        put(metrics, "family_group_memberships", memberships.size());
        put(metrics, "family_groups_owned", groupsOwned);
        put(metrics, "family_clans_linked", clansLinked);
        put(metrics, "family_polls_created", pollsCreated);
        put(metrics, "family_polls_answered", pollsAnswered);
        put(metrics, "family_reminders_sent", reminders);
        put(metrics, "family_role_rank", roleRank);
    }

    private void collectMixedMetrics(Map<String, Long> metrics) {
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

    private JsonArray rows(String table, String filter) throws Exception {
        return JsonParser.parseString(SUPABASE_Client.getWithBody(table, filter)).getAsJsonArray();
    }

    private long rowCount(String table, String filter) throws Exception {
        return rows(table, filter).size();
    }

    private static void source(JsonObject sources, String key, boolean available, String detail) {
        JsonObject item = new JsonObject();
        item.addProperty("available", available);
        item.addProperty("detail", detail);
        sources.add(key, item);
    }

    private static void put(Map<String, Long> metrics, String key, long value) {
        metrics.put(key, Math.max(0, value));
    }

    private static long number(JsonObject object, String field) {
        if (object == null) return 0;
        JsonElement value = object.get(field);
        if (value == null || value.isJsonNull() || !value.isJsonPrimitive()) return 0;
        try { return Math.max(0, value.getAsLong()); }
        catch (RuntimeException ignored) { return 0; }
    }

    private static double decimal(JsonObject object, String field) {
        if (object == null) return 0;
        JsonElement value = object.get(field);
        if (value == null || value.isJsonNull() || !value.isJsonPrimitive()) return 0;
        try { return Math.max(0, value.getAsDouble()); }
        catch (RuntimeException ignored) { return 0; }
    }

    private static String string(JsonObject object, String field) {
        if (object == null) return "";
        JsonElement value = object.get(field);
        if (value == null || value.isJsonNull() || !value.isJsonPrimitive()) return "";
        try { return value.getAsString().trim(); }
        catch (RuntimeException ignored) { return ""; }
    }

    private static JsonObject object(JsonObject object, String field) {
        if (object == null) return new JsonObject();
        JsonElement value = object.get(field);
        return value != null && value.isJsonObject() ? value.getAsJsonObject() : new JsonObject();
    }

    private static JsonArray array(JsonObject object, String field) {
        if (object == null) return new JsonArray();
        JsonElement value = object.get(field);
        return value != null && value.isJsonArray() ? value.getAsJsonArray() : new JsonArray();
    }

    private static JsonArray firstArray(JsonObject object, String... fields) {
        for (String field : fields) {
            JsonArray values = array(object, field);
            if (!values.isEmpty()) return values;
        }
        return new JsonArray();
    }

    private static UnitTotals unitTotals(JsonArray values, boolean homeOnly) {
        long count = 0;
        long levels = 0;
        for (JsonElement element : values) {
            if (!element.isJsonObject()) continue;
            JsonObject value = element.getAsJsonObject();
            if (homeOnly) {
                String village = string(value, "village");
                if (!village.isBlank() && !"home".equalsIgnoreCase(village)) continue;
            }
            count++;
            levels += number(value, "level");
        }
        return new UnitTotals(count, levels);
    }

    private static long roleRank(String role) {
        return switch (role == null ? "" : role.toLowerCase()) {
            case "leader" -> 4;
            case "coleader", "co-leader", "co_leader" -> 3;
            case "admin", "elder" -> 2;
            case "member" -> 1;
            default -> 0;
        };
    }

    private static long familyRoleRank(String role) {
        return switch (role == null ? "" : role.toLowerCase()) {
            case "leader", "owner" -> 4;
            case "co_leader", "coleader", "co-leader" -> 3;
            case "admin", "elder" -> 2;
            case "member" -> 1;
            default -> 0;
        };
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
    private record UnitTotals(long count, long levelSum) {}
}
