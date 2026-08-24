package Java.advancedstats;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AdvancedStatsSourcePresentationTest {
    @Test
    void mapsInternalAdaptersToStablePublicLabels() {
        assertEquals("CLASHKING_V2",
                AdvancedStatsSourcePresentation.fromInternalId("clashking-v2").kind());
        assertEquals("CLASHKING_V2",
                AdvancedStatsSourcePresentation.fromInternalId("CLASHKING_V2").kind());
        assertEquals("OFFICIAL_BATTLELOG",
                AdvancedStatsSourcePresentation.fromInternalId("coc-battlelog").kind());
        assertEquals("UNKNOWN",
                AdvancedStatsSourcePresentation.fromInternalId("internal-worker-42").kind());
    }
}
