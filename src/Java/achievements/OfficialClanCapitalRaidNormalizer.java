package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Normalizes the official /clans/{tag}/capitalraidseasons response. */
public final class OfficialClanCapitalRaidNormalizer {
    private static final int TOP_LOOTER_MIN_ATTACKS = 5;

    private OfficialClanCapitalRaidNormalizer() {}

    public static Result normalize(JsonElement response, String playerTag) {
        return normalize(response, playerTag, null);
    }

    public static Result normalize(JsonElement response, String playerTag, Integer clanMemberCount) {
        JsonArray items = items(response);
        String wantedPlayer = normalizeTag(playerTag);
        boolean hasClanContext = clanMemberCount != null && clanMemberCount >= 0;
        Map<String, Long> metrics = zeroMetrics(wantedPlayer, hasClanContext);
        long bestWeekendLoot = 0;
        long fullWeekends = 0;
        long bonusWeekends = 0;
        long topLootWeekends = 0;
        long bestClanLoot = 0;
        long bestClanAttacks = 0;
        long bestClanRaids = 0;
        long bestClanDistricts = 0;
        long bestParticipants = 0;
        int playerWeekends = 0;
        long playerAttacks = 0;
        long playerLoot = 0;
        List<RaidWeekend> sequence = new ArrayList<>();

        for (JsonElement item : items) {
            if (!item.isJsonObject()) continue;
            JsonObject season = item.getAsJsonObject();
            bestClanLoot = Math.max(bestClanLoot, number(season, "capitalTotalLoot"));
            bestClanAttacks = Math.max(bestClanAttacks, number(season, "totalAttacks"));
            bestClanRaids = Math.max(bestClanRaids, number(season, "raidsCompleted"));
            bestClanDistricts = Math.max(bestClanDistricts, number(season, "enemyDistrictsDestroyed"));

            JsonArray members = array(season.get("members"));
            bestParticipants = Math.max(bestParticipants, distinctMemberCount(members));
            JsonObject player = findMember(members, wantedPlayer);
            if (player == null) continue;
            playerWeekends++;
            long attacks = number(player, "attacks");
            long loot = number(player, "capitalResourcesLooted");
            playerAttacks += attacks;
            playerLoot += loot;
            bestWeekendLoot = Math.max(bestWeekendLoot, loot);
            if (hasNumber(player, "bonusAttackLimit") && number(player, "bonusAttackLimit") > 0) {
                bonusWeekends++;
            }
            boolean full = false;
            if (hasNumber(player, "attacks") && hasNumber(player, "attackLimit")
                    && hasNumber(player, "bonusAttackLimit")) {
                long attackLimit = number(player, "attackLimit");
                long bonusLimit = number(player, "bonusAttackLimit");
                full = attackLimit + bonusLimit > 0 && attacks == attackLimit + bonusLimit;
                if (full) fullWeekends++;
            }
            sequence.add(new RaidWeekend(
                    ClashKingV2WarAchievementSupport.timestamp(string(season, "endTime")), full
            ));
            if (isTopLooter(player, members)) topLootWeekends++;
        }

        if (!wantedPlayer.isBlank()) {
            metrics.put("raid_weekends", (long) playerWeekends);
            metrics.put("raid_attacks", playerAttacks);
            metrics.put("raid_loot", playerLoot);
            metrics.put("raid_weekend_loot", bestWeekendLoot);
            metrics.put("raid_full_weekends", fullWeekends);
            metrics.put("raid_bonus_weekends", bonusWeekends);
            metrics.put("raid_top_looter_weekends", topLootWeekends);
            metrics.put("raid_top_looter", topLootWeekends > 0 ? 1L : 0L);
            metrics.put("raid_full_streak", maxFullStreak(sequence));
            if (playerAttacks >= 25) {
                metrics.put("raid_efficiency", Math.round((double) playerLoot / playerAttacks));
            } else if (!items.isEmpty()) {
                metrics.remove("raid_efficiency");
            }
        }
        metrics.put("clan_raid_loot", bestClanLoot);
        metrics.put("clan_raid_attacks", bestClanAttacks);
        metrics.put("clan_raids_completed", bestClanRaids);
        metrics.put("clan_districts_destroyed", bestClanDistricts);
        metrics.put("clan_raid_participants", bestParticipants);
        if (hasClanContext) {
            metrics.put("clan_raid_participation_pct",
                    participation(bestParticipants, clanMemberCount));
        }
        return new Result(metrics, items.size(), !wantedPlayer.isBlank(), hasClanContext);
    }

    private static Map<String, Long> zeroMetrics(String playerTag, boolean hasClanContext) {
        Map<String, Long> metrics = new LinkedHashMap<>();
        if (!playerTag.isBlank()) {
            metrics.put("raid_weekends", 0L);
            metrics.put("raid_attacks", 0L);
            metrics.put("raid_loot", 0L);
            metrics.put("raid_weekend_loot", 0L);
            metrics.put("raid_full_weekends", 0L);
            metrics.put("raid_bonus_weekends", 0L);
            metrics.put("raid_top_looter_weekends", 0L);
            metrics.put("raid_top_looter", 0L);
            metrics.put("raid_full_streak", 0L);
            metrics.put("raid_efficiency", 0L);
        }
        metrics.put("clan_raid_loot", 0L);
        metrics.put("clan_raid_attacks", 0L);
        metrics.put("clan_raids_completed", 0L);
        metrics.put("clan_districts_destroyed", 0L);
        metrics.put("clan_raid_participants", 0L);
        if (hasClanContext) metrics.put("clan_raid_participation_pct", 0L);
        return metrics;
    }

    private static long maxFullStreak(List<RaidWeekend> weekends) {
        List<RaidWeekend> ordered = weekends.stream()
                .sorted(Comparator.comparing(RaidWeekend::when,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        long current = 0;
        long best = 0;
        for (RaidWeekend weekend : ordered) {
            current = weekend.full() ? current + 1 : 0;
            best = Math.max(best, current);
        }
        return best;
    }

    private static boolean isTopLooter(JsonObject player, JsonArray members) {
        if (!hasNumber(player, "attacks") || !hasNumber(player, "capitalResourcesLooted")
                || number(player, "attacks") < TOP_LOOTER_MIN_ATTACKS) return false;
        long playerLoot = number(player, "capitalResourcesLooted");
        boolean hasMember = false;
        for (JsonElement element : members) {
            if (!element.isJsonObject()) continue;
            JsonObject member = element.getAsJsonObject();
            if (!hasNumber(member, "capitalResourcesLooted")) return false;
            if (member != player) hasMember = true;
            if (number(member, "capitalResourcesLooted") > playerLoot) return false;
        }
        return hasMember || members.size() == 1;
    }

    private static long participation(long participants, Integer clanMemberCount) {
        if (clanMemberCount == null || clanMemberCount <= 0) return 0;
        return Math.min(100, participants * 100 / clanMemberCount);
    }

    private static long distinctMemberCount(JsonArray members) {
        java.util.Set<String> tags = new java.util.HashSet<>();
        for (JsonElement element : members) {
            if (!element.isJsonObject()) continue;
            String tag = string(element.getAsJsonObject(), "tag");
            if (!tag.isBlank()) tags.add(normalizeTag(tag));
        }
        return tags.size();
    }

    private static JsonObject findMember(JsonArray members, String wantedTag) {
        if (wantedTag.isBlank()) return null;
        for (JsonElement element : members) {
            if (!element.isJsonObject()) continue;
            JsonObject member = element.getAsJsonObject();
            if (wantedTag.equals(normalizeTag(string(member, "tag")))) return member;
        }
        return null;
    }

    private static JsonArray items(JsonElement response) {
        if (response != null && response.isJsonObject()) {
            JsonElement value = response.getAsJsonObject().get("items");
            if (value != null && value.isJsonArray()) return value.getAsJsonArray();
        }
        throw new IllegalArgumentException("Official capital raid response must contain an items array");
    }

    private static JsonArray array(JsonElement value) {
        return value != null && value.isJsonArray() ? value.getAsJsonArray() : new JsonArray();
    }

    private static boolean hasNumber(JsonObject object, String key) {
        JsonElement value = object == null ? null : object.get(key);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isNumber()
                && Double.isFinite(value.getAsDouble());
    }

    private static long number(JsonObject object, String key) {
        if (!hasNumber(object, key)) return 0;
        return Math.max(0, object.get(key).getAsLong());
    }

    private static String string(JsonObject object, String key) {
        JsonElement value = object == null ? null : object.get(key);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isString()
                ? value.getAsString() : "";
    }

    private static String normalizeTag(String tag) {
        String value = tag == null ? "" : tag.trim().toUpperCase(Locale.ROOT);
        return value.isBlank() ? "" : (value.startsWith("#") ? value : "#" + value);
    }

    private record RaidWeekend(Instant when, boolean full) {}

    public record Result(
            Map<String, Long> metrics,
            int seasonCount,
            boolean playerContext,
            boolean clanContext
    ) {
        public Result {
            metrics = Map.copyOf(metrics == null ? Map.of() : metrics);
        }

        public boolean sourceAvailable() {
            return true;
        }
    }
}
