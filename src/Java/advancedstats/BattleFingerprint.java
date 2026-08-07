package Java.advancedstats;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
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

    public static String sha256(String value) {
        if (value == null) throw new IllegalArgumentException("value is required");
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
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
