package Java.achievements;

import Java.SUPABASE_Client;
import com.google.gson.JsonObject;

/** Fail-closed reader for the shared clan ledger. */
public final class ClanAchievementLedger {
    @FunctionalInterface
    public interface Reader {
        String read(String rpc, String body) throws Exception;
    }

    private final Reader reader;

    public ClanAchievementLedger() {
        this(SUPABASE_Client::rpc);
    }

    public ClanAchievementLedger(Reader reader) {
        this.reader = reader;
    }

    public String readCurrent(String clanTag) throws Exception {
        if (clanTag == null || clanTag.isBlank()) return "[]";
        // Deliberately propagate failures. Returning [] would make an outage or
        // a migration-order mistake look like the clan lost its shared badges.
        JsonObject request = new JsonObject();
        request.addProperty("p_clan_tag", clanTag);
        return reader.read("read_clan_achievement_progress_v2", request.toString());
    }
}
