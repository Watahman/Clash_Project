package Java.achievements;

import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ClashKingV2AchievementNormalizerTest {
    @Test
    void statsReducePositiveDeltasPerSeasonAndExposeLifetime() {
        var slice = ClashKingV2StatsNormalizer.normalize("donated", JsonParser.parseString(
                "{\"items\":["
                        + "{\"eventTime\":\"2026-09-02T00:00:00Z\",\"clanTag\":null,\"statType\":\"donated\",\"previousValue\":100,\"currentValue\":350,\"delta\":250},"
                        + "{\"eventTime\":\"2026-09-12T00:00:00Z\",\"clanTag\":null,\"statType\":\"donated\",\"previousValue\":350,\"currentValue\":500,\"delta\":150},"
                        + "{\"eventTime\":\"2026-08-12T00:00:00Z\",\"clanTag\":null,\"statType\":\"donated\",\"previousValue\":50,\"currentValue\":125,\"delta\":75}]}"));

        assertEquals(400L, slice.metrics().get("sea_donations"));
        assertEquals(475L, slice.metrics().get("sea_donations_lifetime"));
        assertEquals(500L, slice.metrics().get("history_donations_current"));
        assertEquals("2026-09", slice.latestSeason());
    }

    @Test
    void emptyValidStatsResponseProducesKnownZeroMetrics() {
        var slice = ClashKingV2StatsNormalizer.normalize("clan_games", JsonParser.parseString("{\"items\":[]}"));

        assertEquals(0L, slice.metrics().get("sea_clan_games_points"));
        assertEquals(0, slice.records());
    }

    @Test
    void malformedStatsEnvelopeIsUnavailableToCaller() {
        assertThrows(IllegalArgumentException.class, () ->
                ClashKingV2StatsNormalizer.normalize("received", JsonParser.parseString("{\"value\":[]}")));
    }

    @Test
    void changesReduceActivityDaysAndTypedUpgradeLevels() {
        var slice = ClashKingV2ChangesNormalizer.normalize(JsonParser.parseString(
                "{\"items\":["
                        + "{\"time\":\"2026-09-01T01:00:00Z\",\"townhall_level\":16,\"type\":\"hero_upgrade\",\"item\":{\"name\":\"Barbarian King\",\"id\":1},\"previous\":{\"level\":70},\"current\":{\"level\":72}},"
                        + "{\"time\":\"2026-09-01T02:00:00Z\",\"townhall_level\":16,\"type\":\"wall_level\",\"previous\":14,\"current\":15},"
                        + "{\"time\":\"2026-09-02T02:00:00Z\",\"townhall_level\":16,\"type\":\"builder_upgrade\",\"previous\":3,\"current\":6},"
                        + "{\"time\":\"2026-09-03T02:00:00Z\",\"townhall_level\":16,\"type\":\"name_change\"}]}"),
                Instant.parse("2026-09-15T00:00:00Z"));

        assertEquals(4L, slice.metrics().get("sea_activity_events"));
        assertEquals(3L, slice.metrics().get("sea_active_days"));
        assertEquals(6L, slice.metrics().get("observed_upgrade_level_gains"));
        assertEquals(2L, slice.metrics().get("off_hero_up_30d"));
        assertEquals(1L, slice.metrics().get("base_wall_levels_gained"));
        assertEquals(1L, slice.metrics().get("base_bb_upgrades_completed"));
        assertEquals(1L, slice.metrics().get("player_name_changes"));
    }

    @Test
    void emptyValidChangesResponseProducesKnownZeroMetrics() {
        var slice = ClashKingV2ChangesNormalizer.normalize(JsonParser.parseString("{\"items\":[]}"));

        assertEquals(0L, slice.metrics().get("sea_activity_events"));
        assertEquals(0L, slice.metrics().get("base_building_levels_gained"));
    }

    @Test
    void changesOnlyCountRecentOffensiveGainsInThirtyDayMetrics() {
        var slice = ClashKingV2ChangesNormalizer.normalize(JsonParser.parseString(
                "{\"items\":["
                        + "{\"time\":\"2026-07-01T00:00:00Z\",\"townhall_level\":16,\"type\":\"hero_upgrade\",\"previous\":70,\"current\":75},"
                        + "{\"time\":\"2026-09-10T00:00:00Z\",\"townhall_level\":16,\"type\":\"hero_upgrade\",\"previous\":75,\"current\":77}]}"),
                Instant.parse("2026-09-15T00:00:00Z"));

        assertEquals(2L, slice.metrics().get("off_hero_up_30d"));
        assertEquals(7L, slice.metrics().get("observed_upgrade_level_gains"));
        assertEquals(2L, slice.metrics().get("base_import_completions"));
    }

    @Test
    void socialTotalsAndRankingsNormalizeEmptyAndPopulatedResponses() {
        var social = ClashKingV2SocialRankingNormalizer.joinLeaveTotals(JsonParser.parseString(
                "{\"items\":[{\"clan\":{\"name\":\"A\",\"tag\":\"#A\"},\"visits\":3,\"minutes\":120},"
                        + "{\"clan\":{\"name\":\"B\",\"tag\":\"#B\"},\"visits\":1,\"minutes\":50}]}"));
        var rankings = ClashKingV2SocialRankingNormalizer.rankings(JsonParser.parseString(
                "{\"tag\":\"#P\",\"homeVillage\":{\"trophies\":5000,\"globalRank\":100,\"localRank\":20},"
                        + "\"builderBase\":{\"trophies\":3000,\"globalRank\":200,\"localRank\":40}}"), "#P");

        assertEquals(2L, social.metrics().get("social_clans_visited"));
        assertEquals(4L, social.metrics().get("social_clan_visits"));
        assertEquals(2L, social.metrics().get("social_returns"));
        assertEquals(100L, rankings.metrics().get("ranking_best_global_rank"));
        assertEquals(20L, rankings.metrics().get("ranking_best_local_rank"));
        assertEquals(1L, rankings.metrics().get("tr_double_rank"));
    }
}
