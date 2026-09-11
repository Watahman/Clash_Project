package Java.achievements;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ClanAchievementLedgerTest {
    @Test
    void propagatesReadFailureInsteadOfMasqueradingAsEmptyProgress() {
        ClanAchievementLedger ledger = new ClanAchievementLedger((table, query) -> {
            throw new IOException("temporary database outage");
        });

        IOException failure = assertThrows(IOException.class,
                () -> ledger.readCurrent("#P0Y8LQ2"));
        assertEquals("temporary database outage", failure.getMessage());
    }

    @Test
    void skipsDatabaseOnlyWhenPlayerHasNoCurrentClan() throws Exception {
        AtomicBoolean called = new AtomicBoolean(false);
        ClanAchievementLedger ledger = new ClanAchievementLedger((table, query) -> {
            called.set(true);
            return "[]";
        });

        assertEquals("[]", ledger.readCurrent(""));
        assertTrue(!called.get());
    }

    @Test
    void readsOnlyTheRequestedCurrentClanTag() throws Exception {
        ClanAchievementLedger ledger = new ClanAchievementLedger((table, query) -> {
            assertEquals("read_clan_achievement_progress_v2", table);
            assertTrue(query.contains("\"p_clan_tag\":\"#P0Y8LQ2\""));
            return "[{\"achievement_key\":\"CL_LEVEL_1\"}]";
        });

        assertEquals("[{\"achievement_key\":\"CL_LEVEL_1\"}]", ledger.readCurrent("#P0Y8LQ2"));
    }
}
