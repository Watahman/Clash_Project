package Java.advancedstats;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;

public final class BattleFingerprint {
    private BattleFingerprint() {}

    public static String from(AdvancedStatsModels.BattleIdentity battle) {
        if (battle == null) throw new IllegalArgumentException("battle is required");

        String canonical = String.join("|",
                escape(battle.playerTag()),
                escape(battle.battleTimestamp()),
                battle.attack() ? "attack" : "defense",
                escape(battle.battleType()),
                escape(battle.opponentPlayerTag()),
                battle.stars() == null ? "" : Integer.toString(battle.stars()),
                canonicalNumber(battle.destructionPercentage()),
                escape(battle.armyShareCode())
        );

        return sha256(canonical);
    }

    /**
     * Rich fingerprint for the current player battle log. The upstream payload
     * does not guarantee an ID or timestamp, so both looted and available loot
     * are included as extra discriminators.
     *
     * Poll-local data such as observedAt and the tracked player's current Town
     * Hall are deliberately excluded: those can change while the same recent
     * battle remains in the upstream log. Opponent name is used only when a
     * stable opponent tag is unavailable.
     */
    public static String from(AdvancedStatsModels.BattleCandidate battle) {
        if (battle == null) throw new IllegalArgumentException("battle is required");

        String opponentIdentity = battle.opponentPlayerTag().isBlank()
                ? "name:" + escape(battle.opponentName())
                : "tag:" + escape(battle.opponentPlayerTag());

        String canonical = String.join("|",
                escape(battle.playerTag()),
                canonicalInstant(battle.battleTimestamp()),
                battle.attack() ? "attack" : "defense",
                escape(battle.battleType()),
                opponentIdentity,
                battle.opponentTownHall() == null ? "" : Integer.toString(battle.opponentTownHall()),
                battle.stars() == null ? "" : Integer.toString(battle.stars()),
                canonicalNumber(battle.destructionPercentage()),
                escape(battle.armyShareCode()),
                Long.toString(battle.lootGold()),
                Long.toString(battle.lootElixir()),
                Long.toString(battle.lootDarkElixir()),
                Long.toString(battle.availableGold()),
                Long.toString(battle.availableElixir()),
                Long.toString(battle.availableDarkElixir())
        );

        return sha256(canonical);
    }

    public static String sha256(String value) {
        if (value == null) throw new IllegalArgumentException("value is required");
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }

    private static String canonicalInstant(Instant value) {
        return value == null ? "" : value.toString();
    }

    private static String canonicalNumber(Double value) {
        if (value == null) return "";
        return BigDecimal.valueOf(value).stripTrailingZeros().toPlainString();
    }

    private static String escape(String value) {
        String normalized = value == null ? "" : value;
        return normalized.replace("\\", "\\\\").replace("|", "\\|");
    }
}
