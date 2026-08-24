package Java.advancedstats;

import Java.HttpException;
import Java.LinkedAccountRepository;
import Java.cache.CacheKeys;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.UUID;

/** Ensures persistent tracking is only enabled for an account already linked to the user. */
public final class AdvancedStatsAccountOwnership implements AdvancedStatsLifecycleService.Ownership {
    private static final String[] TAG_FIELDS = {"tag", "playerTag", "accountTag", "clashTag"};
    private final LinkedAccountRepository accounts = new LinkedAccountRepository();

    @Override
    public String requireLinkedAccount(UUID userId, String rawPlayerTag) throws Exception {
        if (userId == null) throw new IllegalArgumentException("userId is required");
        String playerTag = CacheKeys.requireValidTag(rawPlayerTag);

        if (!accounts.owns(userId.toString(), playerTag)) {
            throw new HttpException(
                    403,
                    "{\"error\":\"Dit Clash-account is niet gekoppeld aan je profiel\",\"code\":\"ADVANCED_STATS_ACCOUNT_NOT_LINKED\"}"
            );
        }
        return playerTag;
    }

    static boolean containsLinkedAccount(JsonElement accounts, String rawPlayerTag) {
        String playerTag;
        try {
            playerTag = CacheKeys.requireValidTag(rawPlayerTag);
        } catch (IllegalArgumentException invalidTag) {
            return false;
        }
        if (accounts == null || accounts.isJsonNull()) return false;

        if (accounts.isJsonArray()) {
            for (JsonElement account : accounts.getAsJsonArray()) {
                if (accountMatches(account, playerTag)) return true;
            }
            return false;
        }
        return accountMatches(accounts, playerTag);
    }

    private static boolean accountMatches(JsonElement account, String playerTag) {
        if (account == null || account.isJsonNull()) return false;
        if (account.isJsonPrimitive() && account.getAsJsonPrimitive().isString()) {
            return normalizedTagEquals(account.getAsString(), playerTag);
        }
        if (!account.isJsonObject()) return false;

        JsonObject object = account.getAsJsonObject();
        for (String field : TAG_FIELDS) {
            JsonElement candidate = object.get(field);
            if (candidate != null && !candidate.isJsonNull() && candidate.isJsonPrimitive()) {
                if (normalizedTagEquals(candidate.getAsString(), playerTag)) return true;
            }
        }

        JsonElement nestedBase = object.get("base");
        if (nestedBase != null && accountMatches(nestedBase, playerTag)) return true;
        JsonElement nestedAccount = object.get("account");
        return nestedAccount != null && accountMatches(nestedAccount, playerTag);
    }

    private static boolean normalizedTagEquals(String candidate, String playerTag) {
        try {
            return CacheKeys.requireValidTag(candidate).equals(playerTag);
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }
}
