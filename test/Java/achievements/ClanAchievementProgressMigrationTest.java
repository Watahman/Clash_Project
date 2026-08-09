package Java.achievements;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ClanAchievementProgressMigrationTest {
    private static final Path MIGRATION = Path.of("database/migrations/20260809_013_clan_achievement_progress.sql");
    private static final Path DUPLICATE_SMOKE = Path.of(
            "scripts/smoke-test-clan-achievement-duplicate.sql"
    );

    @Test
    void usesClanTagAsSharedSubjectWithoutPersonalOwnershipOrXp() throws Exception {
        String sql = Files.readString(MIGRATION);
        assertTrue(sql.contains("primary key (clan_tag, achievement_key, tier)"));
        assertFalse(sql.contains("user_id uuid"));
        assertFalse(sql.contains("player_tag text"));
        assertFalse(sql.contains("xp integer"));
        assertFalse(sql.contains("references public.users"));
        assertFalse(sql.contains("insert into public.achievement_progress"));
    }

    @Test
    void isServerManagedAndRejectsPlayerScopedRows() throws Exception {
        String sql = Files.readString(MIGRATION);
        assertTrue(sql.contains("enable row level security"));
        assertTrue(sql.contains("from public, anon, authenticated"));
        assertTrue(sql.contains("to service_role"));
        assertTrue(sql.contains("coalesce(v_item->>'scope', '') <> 'clan'"));
        assertTrue(sql.contains("reconcile_clan_achievement_progress_v1"));
    }

    @Test
    void serializesTheUnlockTransitionBeforeReadingExistingState() throws Exception {
        String sql = Files.readString(MIGRATION);
        int orderedLoop = sql.indexOf("order by item.value->>'achievement_key'");
        int lock = sql.indexOf("perform pg_advisory_xact_lock(hashtextextended(");
        int read = sql.indexOf("select unlocked, evidence_timestamp");
        int transition = sql.indexOf("v_new_unlocks := v_new_unlocks + 1");
        int write = sql.indexOf("insert into public.clan_achievement_progress");

        assertTrue(orderedLoop >= 0);
        assertTrue(orderedLoop < lock, "batches must use a deterministic lock order");
        assertTrue(lock < read, "the per-badge lock must precede the transition read");
        assertTrue(read < transition);
        assertTrue(transition < write);
    }

    @Test
    void shipsRollbackOnlyDuplicateRequestSmokeCoverage() throws Exception {
        String sql = Files.readString(DUPLICATE_SMOKE);
        String rpc = "public.reconcile_clan_achievement_progress_v1(";
        int first = sql.indexOf(rpc);
        int second = sql.indexOf(rpc, first + rpc.length());

        assertTrue(sql.contains("begin;"));
        assertTrue(first >= 0 && second > first);
        assertTrue(sql.contains("(v_first->>'newUnlocks')::integer <> 1"));
        assertTrue(sql.contains("(v_duplicate->>'newUnlocks')::integer <> 0"));
        assertTrue(sql.contains("rollback;"));
        assertFalse(sql.contains("concurrent callers"));
    }
}
