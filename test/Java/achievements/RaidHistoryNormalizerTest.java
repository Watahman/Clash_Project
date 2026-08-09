package Java.achievements;

import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RaidHistoryNormalizerTest {
    private static final Instant FETCHED_AT = Instant.parse("2026-08-09T12:00:00Z");

    @Test
    void createsExactSafeMetricsFromLiveShapedRaidWeekend() {
        RaidHistoryNormalizer.History history = RaidHistoryNormalizer.normalize(
                JsonParser.parseString("""
                {"items":[{
                  "state":"ended",
                  "startTime":"20260227T070000.000Z",
                  "endTime":"20260302T070000.000Z",
                  "members":[
                    {"tag":"#OTHER","name":"Other","attacks":6,"attackLimit":5,
                     "bonusAttackLimit":1,"capitalResourcesLooted":21000},
                    {"tag":"#PQL","name":"Player","attacks":6,"attackLimit":5,
                     "bonusAttackLimit":1,"capitalResourcesLooted":24500}
                  ]
                }]}""").getAsJsonObject(),
                "pql",
                FETCHED_AT
        );

        assertEquals(1, history.records().size());
        RaidHistoryNormalizer.WeekendRecord record = history.records().getFirst();
        assertEquals("2026-02-27T07:00:00Z", record.recordKey());
        assertEquals(Instant.parse("2026-03-02T07:00:00Z"), record.recordTimestamp());
        assertTrue(record.finalState());
        assertEquals("#PQL", record.playerTag());
        assertEquals(Map.of(
                "raid_weekends", 1L,
                "raid_attacks", 6L,
                "raid_loot", 24_500L,
                "raid_weekend_loot", 24_500L,
                "raid_full_weekends", 1L,
                "raid_bonus_weekends", 1L,
                "raid_top_looter_weekends", 1L
        ), record.metrics());
        assertEquals(1, history.coverage().sourceRecords());
        assertEquals(1, history.coverage().measurableRecords());
        assertEquals(1, history.coverage().finalRecords());
        assertEquals(FETCHED_AT, history.coverage().fetchedAt());
        assertTrue(record.metadata().get("final").getAsBoolean());
        assertEquals(100, history.coverage().metadata().get("limit").getAsInt());
    }

    @Test
    void missingMemberAndInvalidTimestampNeverBecomeMeasurableRecords() {
        RaidHistoryNormalizer.History history = RaidHistoryNormalizer.normalize(
                JsonParser.parseString("""
                {"items":[
                  {"state":"ended","startTime":"20260102T070000.000Z",
                   "endTime":"20260105T070000.000Z",
                   "members":[{"tag":"#OTHER","attacks":6}]},
                  {"state":"ended","startTime":"not-a-time","endTime":"also-invalid",
                   "members":[{"tag":"#PQL","attacks":6}]}
                ]}""").getAsJsonObject(),
                "#PQL",
                FETCHED_AT
        );

        assertTrue(history.records().isEmpty());
        assertEquals(2, history.coverage().sourceRecords());
        assertEquals(1, history.coverage().missingPlayerRecords());
        assertEquals(1, history.coverage().invalidTimestampRecords());
    }

    @Test
    void ongoingWeekendNeverBecomesMeasurableProgress() {
        RaidHistoryNormalizer.History history = RaidHistoryNormalizer.normalize(
                JsonParser.parseString("""
                {"items":[{
                  "state":"ongoing",
                  "startTime":"20260807T070000.000Z",
                  "endTime":"20260810T070000.000Z",
                  "members":[
                    {"tag":"#PQL","attacks":5,"attackLimit":5,
                     "bonusAttackLimit":1,"capitalResourcesLooted":12000},
                    {"tag":"#OTHER","attacks":6,"attackLimit":5,
                     "bonusAttackLimit":1,"capitalResourcesLooted":12000}
                  ]
                }]}""").getAsJsonObject(),
                "#pql",
                FETCHED_AT
        );

        assertTrue(history.records().isEmpty());
        assertEquals(1, history.coverage().nonFinalRecords());
        assertEquals(0, history.coverage().finalRecords());
    }

    @Test
    void topLooterRequiresAtLeastFiveAttacks() {
        RaidHistoryNormalizer.History history = RaidHistoryNormalizer.normalize(
                JsonParser.parseString("""
                {"items":[{
                  "state":"ended","startTime":"20260807T070000.000Z",
                  "endTime":"20260810T070000.000Z",
                  "members":[
                    {"tag":"#PQL","attacks":4,"attackLimit":5,
                     "bonusAttackLimit":0,"capitalResourcesLooted":22000},
                    {"tag":"#OTHER","attacks":6,"attackLimit":5,
                     "bonusAttackLimit":1,"capitalResourcesLooted":21000}
                  ]
                }]}""").getAsJsonObject(),
                "#PQL",
                FETCHED_AT
        );

        assertEquals(0L, history.records().getFirst().metrics().get("raid_top_looter_weekends"));
    }

    @Test
    void duplicateWeekendKeysProduceOneCompactRecord() {
        RaidHistoryNormalizer.History history = RaidHistoryNormalizer.normalize(
                JsonParser.parseString("""
                {"items":[
                  {"state":"ongoing","startTime":"20260807T070000.000Z",
                   "members":[{"tag":"#PQL","attacks":1,"attackLimit":5,
                    "bonusAttackLimit":0,"capitalResourcesLooted":1000}]},
                  {"state":"ended","startTime":"20260807T070000.000Z",
                   "endTime":"20260810T070000.000Z",
                   "members":[{"tag":"#PQL","attacks":6,"attackLimit":5,
                    "bonusAttackLimit":1,"capitalResourcesLooted":10000}]}
                ]}""").getAsJsonObject(),
                "#PQL",
                FETCHED_AT
        );

        assertEquals(1, history.records().size());
        assertTrue(history.records().getFirst().finalState());
        assertEquals(6L, history.records().getFirst().metrics().get("raid_attacks"));
        assertEquals(1, history.coverage().nonFinalRecords());
        assertEquals(0, history.coverage().duplicateRecords());
    }
}
