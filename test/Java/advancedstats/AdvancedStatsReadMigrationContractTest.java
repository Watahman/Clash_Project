package Java.advancedstats;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsReadMigrationContractTest {
    @Test
    void readMigrationPersistsPerBattleArmyIdentityAndUsesEffectiveBattleTime() throws Exception {
        String sql = Files.readString(Path.of(
                "database/migrations/20260807_005_advanced_stats_read_models.sql"
        ));

        assertTrue(sql.contains("add column if not exists army_hash"));
        assertTrue(sql.contains("add column if not exists normalized_army_json"));
        assertTrue(sql.contains("save_advanced_stats_battle_v3"));
        assertTrue(sql.contains("coalesce(b.battle_timestamp, b.observed_at)"));
        assertTrue(sql.contains("processing_status = 'PROCESSED'"));
    }

    @Test
    void readMigrationProvidesAllFiveBackendReadModelsAndCursorPagination() throws Exception {
        String sql = Files.readString(Path.of(
                "database/migrations/20260807_005_advanced_stats_read_models.sql"
        ));

        assertTrue(sql.contains("read_advanced_stats_overview_v1"));
        assertTrue(sql.contains("read_advanced_stats_units_v1"));
        assertTrue(sql.contains("read_advanced_stats_armies_v1"));
        assertTrue(sql.contains("read_advanced_stats_battles_v1"));
        assertTrue(sql.contains("read_advanced_stats_trends_v1"));
        assertTrue(sql.contains("p_cursor_at timestamptz"));
        assertTrue(sql.contains("p_cursor_id uuid"));
        assertTrue(sql.contains("limit greatest(1, least(coalesce(p_limit, 25), 100)) + 1"));
    }

    @Test
    void readFunctionsRemainServiceRoleOnly() throws Exception {
        String sql = Files.readString(Path.of(
                "database/migrations/20260807_005_advanced_stats_read_models.sql"
        ));

        assertTrue(sql.contains("from public, anon, authenticated"));
        assertTrue(sql.contains("to service_role"));
        assertFalse(sql.contains("grant execute on function public.read_advanced_stats_overview_v1(uuid, timestamptz) to authenticated"));
    }
}
