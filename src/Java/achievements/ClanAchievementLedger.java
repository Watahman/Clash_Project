package Java.achievements;

import Java.SUPABASE_Client;

/** Fail-closed reader for the shared clan ledger. */
public final class ClanAchievementLedger {
    @FunctionalInterface
    public interface Reader {
        String read(String table, String query) throws Exception;
    }

    private static final String SELECT =
            "select=achievement_key,family_key,title,description,category,rarity,tier,metric,progress,target,unlocked,unlocked_at,updated_at";

    private final Reader reader;

    public ClanAchievementLedger() {
        this(SUPABASE_Client::getWithBody);
    }

    public ClanAchievementLedger(Reader reader) {
        this.reader = reader;
    }

    public String readCurrent(String clanTag) throws Exception {
        if (clanTag == null || clanTag.isBlank()) return "[]";
        // Deliberately propagate failures. Returning [] would make an outage or
        // a migration-order mistake look like the clan lost its shared badges.
        return reader.read(
                "clan_achievement_progress",
                SELECT + "&clan_tag=" + SUPABASE_Client.eq(clanTag)
                        + "&order=category.asc,family_key.asc,tier.asc"
        );
    }
}
