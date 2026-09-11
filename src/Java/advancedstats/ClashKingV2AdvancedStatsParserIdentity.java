package Java.advancedstats;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.util.Locale;

import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.instant;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.object;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.text;

/** Stable identity and side decoding for ClashKing V2 events. */
final class ClashKingV2AdvancedStatsParserIdentity {
    private ClashKingV2AdvancedStatsParserIdentity() {}

    static boolean isAttack(JsonObject row, boolean defaultValue) {
        JsonElement value = row == null ? null : row.get("attack");
        if (value != null && !value.isJsonNull()) {
            try { return value.getAsBoolean(); } catch (RuntimeException ignored) { }
        }
        String side = text(row, "side", "battle_side").toLowerCase(Locale.ROOT);
        if (side.contains("defen")) return false;
        if (side.contains("attack") || side.contains("offen")) return true;
        return defaultValue;
    }

    static String stableKey(String prefix, String id, JsonObject row) {
        if (!id.isBlank()) return prefix + ":" + id;
        // Hash named values only; Gson's source property order is not identity.
        String basis = String.join("|", sourceTimeIdentity(row),
                canonicalTag(opponentTag(row)),
                text(row, "shareCode", "share_code", "armyHash", "army_hash"),
                text(row, "battle_type", "battleType", "type"), text(row, "stars"),
                text(row, "destruction_percentage", "destructionPercentage", "destruction"),
                Boolean.toString(isAttack(row, true)));
        return prefix + ":" + BattleFingerprint.sha256(basis);
    }

    private static String opponentTag(JsonObject row) {
        JsonObject opponent = object(row == null ? null : row.get("opponent"));
        String nested = text(opponent, "tag", "playerTag", "player_tag");
        return nested.isBlank() ? text(row, "opponent_tag", "opponentTag", "defenderTag") : nested;
    }

    static String leagueKey(String type, String season, String id, String opponentTag, JsonObject row) {
        String key = id.isBlank() ? stableLeagueIdentity(season, opponentTag, row) : id;
        return "ranked-season:" + numericSeason(season) + ":" + type + ":" + key;
    }

    private static String stableLeagueIdentity(String season, String opponentTag, JsonObject row) {
        // Route/day labels are not event identity, allowing ranked/Legend overlap.
        String basis = String.join("|", numericSeason(season), sourceTimeIdentity(row), opponentTag,
                text(row, "stars"), text(row, "destructionPercentage", "destruction_percentage"),
                text(row, "shareCode", "share_code", "armyHash", "army_hash"), text(row, "trophies"));
        return BattleFingerprint.sha256(basis);
    }

    private static String sourceTimeIdentity(JsonObject row) {
        Instant sourceTime = instant(row, null, "battleTime", "time", "timestamp", "created_at", "date");
        return sourceTime == null ? "" : sourceTime.toString();
    }

    static String canonicalTag(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    static String numericSeason(String value) {
        if (value == null || !value.trim().matches("[1-9][0-9]{0,18}")) return "";
        return value.trim();
    }
}
