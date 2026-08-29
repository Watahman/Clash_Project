package Java.achievements;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AchievementClashKingSourceStatusContractTest {
    @Test
    void genericClashKingStatusUsesNormalizedEvidenceInsteadOfHardcodedFalse() throws Exception {
        String collector = Files.readString(Path.of("src/Java/achievements/AchievementMetricCollector.java"));

        assertTrue(collector.contains("boolean clashKingEvidence = cachedLegend"));
        assertTrue(collector.contains("clashKingEvidence ? \"partial\" : \"unavailable\""));
        assertTrue(collector.contains("Other generic player-history endpoints remain unavailable or unbound"));
        assertFalse(collector.contains("source(sources, AchievementSources.CLASHKING_HISTORY, false"));
    }
}
