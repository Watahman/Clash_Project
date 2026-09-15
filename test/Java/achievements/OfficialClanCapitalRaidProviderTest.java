package Java.achievements;

import com.google.gson.JsonElement;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class OfficialClanCapitalRaidProviderTest {
    @Test
    void fetchesOfficialPathAndPublishesExactPlayerAndClanMetrics() throws Exception {
        AtomicReference<String> requestedPath = new AtomicReference<>();
        JsonElement fixture = JsonParser.parseString("""
                {"items":[
                  {"state":"ended","startTime":"20260821T070000.000Z","endTime":"20260824T070000.000Z",
                   "capitalTotalLoot":123456,"raidsCompleted":12,"totalAttacks":248,"enemyDistrictsDestroyed":33,
                   "members":[
                     {"tag":"#PLAYER","attacks":6,"attackLimit":5,"bonusAttackLimit":1,"capitalResourcesLooted":42000},
                     {"tag":"#OTHER","attacks":5,"attackLimit":5,"bonusAttackLimit":0,"capitalResourcesLooted":41000}]},
                  {"state":"ended","startTime":"20260814T070000.000Z","endTime":"20260817T070000.000Z",
                   "capitalTotalLoot":100000,"raidsCompleted":10,"totalAttacks":200,"enemyDistrictsDestroyed":29,
                   "members":[
                     {"tag":"#PLAYER","attacks":5,"attackLimit":5,"bonusAttackLimit":0,"capitalResourcesLooted":30000},
                     {"tag":"#OTHER","attacks":5,"attackLimit":5,"bonusAttackLimit":0,"capitalResourcesLooted":35000}]}
                ],"paging":{"cursors":{}}}
                """);
        OfficialClanCapitalRaidProvider provider = new OfficialClanCapitalRaidProvider(path -> {
            requestedPath.set(path);
            return fixture;
        });

        OfficialClanCapitalRaidNormalizer.Result result = provider.fetch("#abc", "player", 4);

        assertEquals("/clans/%23ABC/capitalraidseasons", requestedPath.get());
        assertEquals(Map.ofEntries(
                Map.entry("raid_weekends", 2L),
                Map.entry("raid_attacks", 11L),
                Map.entry("raid_loot", 72_000L),
                Map.entry("raid_weekend_loot", 42_000L),
                Map.entry("raid_full_weekends", 2L),
                Map.entry("raid_bonus_weekends", 1L),
                Map.entry("raid_top_looter_weekends", 1L),
                Map.entry("raid_top_looter", 1L),
                Map.entry("raid_full_streak", 2L),
                Map.entry("clan_raid_loot", 123_456L),
                Map.entry("clan_raid_attacks", 248L),
                Map.entry("clan_raids_completed", 12L),
                Map.entry("clan_districts_destroyed", 33L),
                Map.entry("clan_raid_participants", 2L),
                Map.entry("clan_raid_participation_pct", 50L)
        ), result.metrics());
        assertEquals(2, result.seasonCount());
        assertEquals(true, result.sourceAvailable());
    }

    @Test
    void emptyItemsAreAvailableWithKnownZerosAndMissingContextIsNotTransportFailure() throws Exception {
        OfficialClanCapitalRaidProvider provider = new OfficialClanCapitalRaidProvider(
                path -> JsonParser.parseString("{\"items\":[]}")
        );

        OfficialClanCapitalRaidNormalizer.Result result = provider.fetch("#CLAN", "#PLAYER", 4);

        assertEquals(0, result.seasonCount());
        assertEquals(0L, result.metrics().get("raid_weekends"));
        assertEquals(0L, result.metrics().get("raid_attacks"));
        assertEquals(0L, result.metrics().get("raid_loot"));
        assertEquals(0L, result.metrics().get("raid_full_weekends"));
        assertEquals(0L, result.metrics().get("raid_bonus_weekends"));
        assertEquals(0L, result.metrics().get("raid_top_looter_weekends"));
        assertEquals(0L, result.metrics().get("clan_raid_loot"));
        assertEquals(0L, result.metrics().get("clan_raid_participation_pct"));
        assertEquals(true, result.sourceAvailable());
        assertEquals(true, result.playerContext());
        assertEquals(true, result.clanContext());

        OfficialClanCapitalRaidNormalizer.Result noContext = provider.fetch("#CLAN", "", null);
        assertEquals(true, noContext.sourceAvailable());
        assertEquals(false, noContext.playerContext());
        assertEquals(false, noContext.clanContext());
    }

    @Test
    void rejectsAnInvalidEnvelopeInsteadOfTurningItIntoZeroProgress() {
        OfficialClanCapitalRaidProvider provider = new OfficialClanCapitalRaidProvider(
                path -> JsonParser.parseString("{\"value\":[]}")
        );

        assertThrows(IllegalArgumentException.class, () -> provider.fetch("#CLAN", "#PLAYER"));
        assertThrows(IllegalArgumentException.class, () -> OfficialClanCapitalRaidProvider.path(""));
    }

    @Test
    void doesNotGuessBonusOrFullUsageWhenOfficialMemberLimitsAreMissing() {
        JsonElement fixture = JsonParser.parseString("""
                {"items":[{"state":"ended","capitalTotalLoot":1,"totalAttacks":1,
                  "raidsCompleted":1,"enemyDistrictsDestroyed":1,"members":[
                    {"tag":"#PLAYER","attacks":5,"capitalResourcesLooted":6000},
                    {"tag":"#OTHER","attacks":5,"capitalResourcesLooted":5000}]}]}
                """);

        OfficialClanCapitalRaidNormalizer.Result result =
                OfficialClanCapitalRaidNormalizer.normalize(fixture, "#PLAYER", 2);

        assertEquals(0L, result.metrics().get("raid_full_weekends"));
        assertEquals(0L, result.metrics().get("raid_bonus_weekends"));
        assertEquals(1L, result.metrics().get("raid_top_looter_weekends"));
    }
}
