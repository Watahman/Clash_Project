package Java.advancedstats;

import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class AdvancedStatsPublicSourceMetadataTest {
    @Test
    void removesInternalProviderIdsFromCompactOverviewMetadata() {
        var source = JsonParser.parseString("{\"sourceId\":\"clashking-v2\","
                + "\"provider\":\"internal-worker-7\",\"provenance\":{"
                + "\"sourceId\":\"clashking-v2\",\"note\":\"partial\"}}").getAsJsonObject();
        var overview = JsonParser.parseString("{\"tracking\":{\"source\":"
                + source + "}}").getAsJsonObject();

        var safe = AdvancedStatsPublicSourceMetadata.sanitizeOverview(overview);
        var safeSource = safe.getAsJsonObject("tracking").getAsJsonObject("source");
        assertEquals("CLASHKING_V2", safeSource.get("provider").getAsString());
        assertEquals("ClashKing V2", safeSource.get("label").getAsString());
        assertFalse(safeSource.has("sourceId"));
        assertFalse(safeSource.getAsJsonObject("provenance").has("sourceId"));
    }
}
