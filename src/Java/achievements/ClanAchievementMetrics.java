package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/** Normalizes the eight clan families provable from the official clan endpoints. */
public final class ClanAchievementMetrics {
    private ClanAchievementMetrics() {}

    public static Map<String, Long> normalize(String expectedClanTag, JsonObject clan, JsonObject membersResponse) {
        if (clan == null || membersResponse == null) throw new IllegalArgumentException("Missing clan evidence");
        String actualTag = string(clan, "tag");
        if (expectedClanTag == null || !expectedClanTag.equals(actualTag)) {
            throw new IllegalArgumentException("Clan evidence does not match the linked player's current clan");
        }
        JsonArray members = array(membersResponse.get("items"));
        long declaredMemberCount = number(clan, "members");
        if (members.size() != declaredMemberCount) {
            throw new IllegalArgumentException("Clan member evidence is incomplete");
        }

        long donations = 0;
        long qualifyingDonors = 0;
        Map<Long, Long> townHalls = new HashMap<>();
        for (JsonElement element : members) {
            if (!element.isJsonObject()) continue;
            JsonObject member = element.getAsJsonObject();
            long memberDonations = number(member, "donations");
            donations += memberDonations;
            if (memberDonations >= 1_000) qualifyingDonors++;
            long townHall = number(member, "townHallLevel");
            if (townHall > 0) townHalls.merge(townHall, 1L, Long::sum);
        }

        long memberCount = declaredMemberCount;
        long donorParticipationPct = memberCount == 0 ? 0 : qualifyingDonors * 100 / memberCount;
        long largestTownHallBucket = townHalls.values().stream().mapToLong(Long::longValue).max().orElse(0);
        boolean completeTownHallEvidence = townHalls.values().stream().mapToLong(Long::longValue).sum() == memberCount;
        long balancedRoster = memberCount >= 30 && completeTownHallEvidence
                && largestTownHallBucket * 2 <= memberCount ? 1 : 0;

        Map<String, Long> metrics = new LinkedHashMap<>();
        metrics.put("clan_level", number(clan, "clanLevel"));
        metrics.put("clan_members", memberCount);
        metrics.put("clan_war_wins", number(clan, "warWins"));
        metrics.put("clan_war_win_streak", number(clan, "warWinStreak"));
        metrics.put("clan_capital_points", number(clan, "clanCapitalPoints"));
        metrics.put("clan_donations", donations);
        metrics.put("clan_donor_participation_pct", donorParticipationPct);
        metrics.put("clan_balanced_roster", balancedRoster);
        return Map.copyOf(metrics);
    }

    private static JsonArray array(JsonElement value) {
        return value != null && value.isJsonArray() ? value.getAsJsonArray() : new JsonArray();
    }

    private static long number(JsonObject object, String key) {
        JsonElement value = object.get(key);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isNumber()
                ? Math.max(0, value.getAsLong()) : 0;
    }

    private static String string(JsonObject object, String key) {
        JsonElement value = object.get(key);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isString()
                ? value.getAsString() : "";
    }
}
