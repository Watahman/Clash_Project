package Java;

import Java.cache.CacheKeys;
import Java.cache.CachePolicy;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Internal-only source used by the Advanced Stats collector.
 * It reuses the existing Clash API client/key rotation/cache and never calls
 * ClashPanel's public /PlayerBattleLog route over HTTP.
 */
public final class AdvancedStatsBattleLogSource {
    private final API_Utils utils;

    public AdvancedStatsBattleLogSource(Config conf) {
        if (conf == null) throw new IllegalArgumentException("conf is required");
        this.utils = new API_Utils(conf);
    }

    public String fetchFresh(String rawPlayerTag) throws Exception {
        return utils.clashGetFreshValue(
                battleLogPath(rawPlayerTag),
                CachePolicy.PLAYER_BATTLE_LOG
        );
    }

    static String battleLogPath(String rawPlayerTag) {
        String playerTag = CacheKeys.requireValidTag(rawPlayerTag);
        return "/players/"
                + URLEncoder.encode(playerTag, StandardCharsets.UTF_8)
                + "/battlelog";
    }
}
