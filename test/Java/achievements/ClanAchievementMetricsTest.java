package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ClanAchievementMetricsTest {
    @Test
    void normalizesAllEightReliableClanMetricsIncludingPercentAndRosterBalance() {
        JsonObject clan = clan("#P0Y8LQ2", 15, 40);
        JsonArray members = new JsonArray();
        for (int i = 0; i < 20; i++) members.add(member(16, i < 12 ? 1_500 : 100));
        for (int i = 0; i < 12; i++) members.add(member(15, 1_000));
        for (int i = 0; i < 8; i++) members.add(member(14, 0));
        JsonObject response = new JsonObject();
        response.add("items", members);

        Map<String, Long> metrics = ClanAchievementMetrics.normalize("#P0Y8LQ2", clan, response);
        assertEquals(15, metrics.get("clan_level"));
        assertEquals(40, metrics.get("clan_members"));
        assertEquals(321, metrics.get("clan_war_wins"));
        assertEquals(7, metrics.get("clan_war_win_streak"));
        assertEquals(2_345, metrics.get("clan_capital_points"));
        assertEquals(30_800, metrics.get("clan_donations"));
        assertEquals(60, metrics.get("clan_donor_participation_pct"));
        assertEquals(1, metrics.get("clan_balanced_roster"));
    }

    @Test
    void rejectsMismatchedOrIncompleteEvidenceInsteadOfPublishingZeroes() {
        JsonObject empty = new JsonObject();
        empty.add("items", new JsonArray());
        assertThrows(IllegalArgumentException.class,
                () -> ClanAchievementMetrics.normalize("#P0Y8LQ2", clan("#LQURPQJ0Y", 1, 1), empty));
        assertThrows(IllegalArgumentException.class,
                () -> ClanAchievementMetrics.normalize("#P0Y8LQ2", clan("#P0Y8LQ2", 1, 5), empty));

        JsonObject partial = new JsonObject();
        JsonArray fourOfFive = new JsonArray();
        for (int i = 0; i < 4; i++) fourOfFive.add(member(15, 1_000));
        partial.add("items", fourOfFive);
        assertThrows(IllegalArgumentException.class,
                () -> ClanAchievementMetrics.normalize("#P0Y8LQ2", clan("#P0Y8LQ2", 1, 5), partial));
    }

    private JsonObject clan(String tag, int level, int members) {
        JsonObject clan = new JsonObject();
        clan.addProperty("tag", tag);
        clan.addProperty("clanLevel", level);
        clan.addProperty("members", members);
        clan.addProperty("warWins", 321);
        clan.addProperty("warWinStreak", 7);
        clan.addProperty("clanCapitalPoints", 2_345);
        return clan;
    }

    private JsonObject member(int townHall, int donations) {
        JsonObject member = new JsonObject();
        member.addProperty("townHallLevel", townHall);
        member.addProperty("donations", donations);
        return member;
    }
}
