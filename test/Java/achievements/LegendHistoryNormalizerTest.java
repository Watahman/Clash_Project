package Java.achievements;

import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LegendHistoryNormalizerTest {
    private static final Instant FETCHED_AT = Instant.parse("2026-08-09T12:00:00Z");

    @Test
    void acceptsOnlyMatchingDistinctExactSeasonRankings() {
        LegendHistoryNormalizer.History history = LegendHistoryNormalizer.normalize(
                JsonParser.parseString("""
                [
                  {"tag":"#PQL","name":"Player","trophies":5643,"rank":332804,"season":"2025-10-06"},
                  {"tag":"#PQL","name":"Player","trophies":5550,"rank":420000,"season":"2025-09"},
                  {"tag":"#PQL","name":"Player","trophies":5643,"rank":332804,"season":"2025-09"},
                  {"tag":"#OTHER","name":"Other","trophies":6000,"rank":1,"season":"2025-08"},
                  {"tag":"#PQL","name":"Player","trophies":5000,"rank":0,"season":"2025-07"},
                  {"tag":"#PQL","name":"Player","trophies":4900,"rank":-4,"season":"2025-06"},
                  {"tag":"#PQL","name":"Player","trophies":4960,"rank":1092636,"season":"2025-01"}
                ]""").getAsJsonArray(),
                "pql",
                FETCHED_AT
        );

        assertEquals(List.of("2025-09", "2025-01"), history.records().stream()
                .map(LegendHistoryNormalizer.SeasonRecord::season).toList());
        LegendHistoryNormalizer.SeasonRecord september = history.records().getFirst();
        assertEquals(Map.of(
                "legend_ranked_seasons", 1L,
                "legend_best_season_trophies", 5643L,
                "legend_best_season_rank", 332804L,
                "ranking_best_global_rank", 332804L
        ), september.metrics());
        assertEquals(Instant.parse("2025-09-30T23:59:59Z"), september.recordTimestamp());
        assertTrue(september.finalState());
        assertEquals(7, history.coverage().sourceRecords());
        assertEquals(2, history.coverage().measurableRecords());
        assertEquals(1, history.coverage().invalidSeasonRecords());
        assertEquals(2, history.coverage().invalidRankRecords());
        assertEquals(1, history.coverage().mismatchedPlayerRecords());
        assertEquals(1, history.coverage().duplicateRecords());
        assertTrue(september.metadata().get("final").getAsBoolean());
        assertEquals(2, history.coverage().metadata().get("measurableRecords").getAsInt());
    }

    @Test
    void currentSeasonNeverBecomesMeasurableProgress() {
        LegendHistoryNormalizer.History history = LegendHistoryNormalizer.normalize(
                JsonParser.parseString("""
                [{"tag":"#PQL","name":"Player","trophies":5001,"rank":9000,"season":"2026-08"}]
                """).getAsJsonArray(),
                "#PQL",
                FETCHED_AT
        );

        assertTrue(history.records().isEmpty());
        assertEquals(1, history.coverage().nonFinalRecords());
        assertEquals(0, history.coverage().finalRecords());
        assertEquals(FETCHED_AT, history.coverage().fetchedAt());
    }

    @Test
    void missingPlayerReturnsNoMeasurableSeason() {
        LegendHistoryNormalizer.History history = LegendHistoryNormalizer.normalize(
                JsonParser.parseString("""
                [{"tag":"#OTHER","name":"Other","trophies":6000,"rank":1,"season":"2025-09"}]
                """).getAsJsonArray(),
                "#PQL",
                FETCHED_AT
        );

        assertTrue(history.records().isEmpty());
        assertEquals(1, history.coverage().mismatchedPlayerRecords());
    }
}
