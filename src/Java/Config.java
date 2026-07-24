package Java;

import java.util.ArrayList;
import java.util.List;
import io.github.cdimascio.dotenv.Dotenv;

public class Config {
    String _API_KEY_SUPABASE = env("_API_KEY_SUPABASE");
    String _API_KEY_SECR_SUPABASE = firstNonBlank(
            env("_API_KEY_SECR_SUPABASE"),
            env("SUPABASE_SERVICE_ROLE_KEY")
    );
    String _API_KEY_ALL = env("_API_KEY_ALL");

    String _API_KEY_ACTIVE = _API_KEY_ALL;

    String _BASE_URL_SUPABASE = firstNonBlank(env("_BASE_URL_SUPABASE"), env("SUPABASE_URL"));
    String _BASE_URL_CLASH = firstNonBlank(env("_BASE_URL_CLASH"), "https://cocproxy.royaleapi.dev/v1");
    String _CACHE_ENABLED = firstNonBlank(env("CACHE_ENABLED"), "true");
    String _CACHE_MODE = firstNonBlank(env("CACHE_MODE"), "layered");
    String _CACHE_DB_PATH = firstNonBlank(
            env("CACHE_DB_PATH"),
            "data/cache/clashtools-cache.db"
    );
    String _CACHE_MEMORY_MAX_ENTRIES = firstNonBlank(
            env("CACHE_MEMORY_MAX_ENTRIES"),
            "5000"
    );
    String _CACHE_DISK_MAX_ENTRIES = firstNonBlank(
            env("CACHE_DISK_MAX_ENTRIES"),
            "25000"
    );
    String _ALLOWED_ORIGINS = firstNonBlank(
            env("ALLOWED_ORIGINS"),
            "http://localhost:5173,http://127.0.0.1:5173,"
                    + "http://localhost:63342,http://127.0.0.1:63342"
    );
    String _SERVER_PORT = firstNonBlank(env("PORT"), env("SERVER_PORT"), "8080");
    String _MAX_REQUEST_BODY_BYTES = firstNonBlank(env("MAX_REQUEST_BODY_BYTES"), "1048576");
    String _PUBLIC_RATE_LIMIT = firstNonBlank(env("PUBLIC_RATE_LIMIT_PER_MINUTE"), "90");
    String _SENSITIVE_RATE_LIMIT = firstNonBlank(env("SENSITIVE_RATE_LIMIT_PER_MINUTE"), "10");
    String _DATA_RATE_LIMIT = firstNonBlank(env("DATA_RATE_LIMIT_PER_MINUTE"), "180");
    String _TRUST_PROXY_HEADERS = firstNonBlank(env("TRUST_PROXY_HEADERS"), "false");

    String _AUTH_COOKIE_SECURE = firstNonBlank(env("AUTH_COOKIE_SECURE"), "false");
    String _AUTH_COOKIE_SAME_SITE = firstNonBlank(env("AUTH_COOKIE_SAME_SITE"), "Lax");
    String _AUTH_REFRESH_COOKIE_MAX_AGE_SECONDS = firstNonBlank(
            env("AUTH_REFRESH_COOKIE_MAX_AGE_SECONDS"),
            "34560000"
    );
    String _AUTH_EMAIL_CONFIRM_REDIRECT_URL = firstNonBlank(
            env("AUTH_EMAIL_CONFIRM_REDIRECT_URL"),
            "http://localhost:5173/subpages/login.html"
    );
    String _AUTH_PASSWORD_RESET_REDIRECT_URL = firstNonBlank(
            env("AUTH_PASSWORD_RESET_REDIRECT_URL"),
            "http://localhost:5173/subpages/login.html"
    );
    String _AUTH_GOOGLE_CALLBACK_URL = firstNonBlank(
            env("AUTH_GOOGLE_CALLBACK_URL"),
            "http://localhost:5173/api/AuthGoogleCallback"
    );

    String _AUTH_LOGIN = "/AuthLogin";
    String _AUTH_SIGNUP = "/AuthSignup";
    String _AUTH_SESSION = "/AuthSession";
    String _AUTH_RECOVER = "/AuthRecover";
    String _AUTH_CHANGE_PASSWORD = "/AuthChangePassword";
    String _AUTH_LOGOUT = "/AuthLogout";
    String _AUTH_GOOGLE = "/AuthGoogle";
    String _AUTH_GOOGLE_CALLBACK = "/AuthGoogleCallback";

    String _EXT_CLAN_CURRENTWAR_LEAGUEGROUP = "/ClanCurrentWarLeagueGroup";
    String _EXT_CLAN_WARLEAGUES_WARS = "/ClanWarLeaguesWars";
    String _EXT_CLAN_WAR_LOG = "/ClanWarLog";
    String _EXT_CLAN_SEARCH = "/ClanSearch";
    String _EXT_CLAN_CURRENTWAR = "/ClanCurrentWar";
    String _EXT_CLAN_INFO = "/ClanInfo";
    String _EXT_CLAN_MEMBERS = "/ClanMembers";
    String _EXT_CLAN_CAPITALRAIDSEASONS = "/ClanCapitalRaidSeasons";

    String _EXT_PLAYER_INFO = "/Player";
    String _EXT_PLAYER_BATTLE_LOG = "/PlayerBattleLog";
    String _EXT_PLAYER_LEAGUE_HISTORY = "/PlayerLeagueHistory";
    String _EXT_PLAYER_VERIFY_TOKEN = "/PlayerVerifyToken";

    String _EXT_LEAGUE_LEAGUETIERS_INFO = "/LeagueTierInfo";
    String _EXT_LEAGUE_CAPITAL_LEAGUES = "/LeagueCapitalLeagues";
    String _EXT_LEAGUE_LEAGUETIERS = "/LeagueTiers";
    String _EXT_LEAGUE_LEAGUES = "/Leagues";
    String _EXT_LEAGUE_LEAGUE_SEASON_INFO = "/LeagueLeagueSeasonInfo";
    String _EXT_LEAGUE_CAPITAL_LEAGUE_INFO = "/LeagueCapitalLeagueInfo";
    String _EXT_LEAGUE_BUILDERBASE_LEAGUE_INFO = "/LeagueBuilderbaseLeagueInfo";
    String _EXT_LEAGUE_BUILDERBASE_LEAGUES = "/LeagueBuilderbaseLeagues";
    String _EXT_LEAGUE_LEAGUE_INFO = "/LeagueInfo";
    String _EXT_LEAGUE_LEAGUEGROUP_INFO= "/LeagueGroupInfo";
    String _EXT_LEAGUE_LEAGUE_SEASONS= "/LeagueSeasons";
    String _EXT_LEAGUE_WARLEAGUE_INFO= "/LeagueWarInfo";
    String _EXT_LEAGUE_WARLEAGUES= "/LeagueWar";

    String _EXT_LOCATIONS_RANKINGS_CLANS_INFO = "/LocationsRankingsClansInfo";
    String _EXT_LOCATIONS_RANKINGS_PLAYERS_INFO = "/LocationsRankingsPlayersInfo";
    String _EXT_LOCATIONS_RANKINGS_PLAYERS_BUILDERBASE_INFO = "/LocationsRankingsPlayersBuilderbaseInfo";
    String _EXT_LOCATIONS_RANKINGS_CLANS_BUILDERBASE_INFO = "/LocationsRankingsClansBuilderbaseInfo";
    String _EXT_LOCATIONS = "/Locations";
    String _EXT_LOCATIONS_RANKINGS_CAPITAL_INFO = "/LocationsRankingsCapitalInfo";
    String _EXT_LOCATIONS_INFO = "/LocationsInfo";

    String _EXT_GOLDPASS = "/GoldPass";

    String _EXT_LABELS_PLAYERS = "/LabelsPlayers";
    String _EXT_LABELS_CLANS = "/LabelsClans";

    String _EXT_SUPA_CONF = "/SupabaseConfigInfo";

    String _EXT_SUPA_USER_INFO = "/SupabaseUserInfo";
    String _EXT_SUPA_USER_BASES = "/SupabaseUserBases";
    String _EXT_SUPA_USER_GROUPS = "/SupabaseUserGroups";
    String _EXT_SUPA_USER_IDCHECK = "/SupabaseUserIdCheck";
    String _EXT_SUPA_USER_ADD_ACCOUNT = "/SupabaseUserAddAccount";
    String _EXT_SUPA_USER_UPDATE_NAME = "/SupabaseUserUpdateName";

    String _EXT_SUPA_USER_ADD_FRIEND = "/SupabaseUserAddFriend";
    String _EXT_SUPA_USER_GET_PENDING_FRIENDS = "/SupabaseUserGetPendingFriends";
    String _EXT_SUPA_USER_GET_FRIEND_REQUESTS =  "/SupabaseUserGetFriendRequests";
    String _EXT_SUPA_USER_ACCEPT_FRIEND =  "/SupabaseUserAcceptFriend";
    String _EXT_SUPA_USER_REJECT_FRIEND = "/SupabaseUserRejectFriend";
    String _EXT_SUPA_USER_GET_FRIENDS = "/SupabaseUserGetFriends";

    String _EXT_SUPA_CWLPLANNER_DATA_SET = "/SupabaseCwplannerDataSet";
    String _EXT_SUPA_CWLPLANNER_DATA_GET = "/SupabaseCwplannerDataGet";
    String _EXT_SUPA_CWLPLANNER_DATA_GET_ALL = "/SupabaseCwplannerDataGetAll";
    String _EXT_SUPA_CWLPLANNER_RENAME = "/SupabaseCwplannerRename";
    String _EXT_SUPA_CWLPLANNER_COPY = "/SupabaseCwplannerCopy";
    String _EXT_SUPA_CWLPLANNER_DELETE = "/SupabaseCwplannerDelete";

    String _EXT_SUPA_GROUP_MAKE = "/SupabaseGroupMake";
    String _EXT_SUPA_GROUP_MEMBERS = "/SupabaseGroupMembers";
    String _EXT_SUPA_GROUP_MEMBER_ACTIVITY = "/SupabaseGroupMemberActivity";
    String _EXT_SUPA_GROUP_INFO = "/SupabaseGroupInfo";
    String _EXT_SUPA_GROUP_JOIN = "/SupabaseGroupJoin";
    String _EXT_SUPA_GROUP_LEAVE = "/SupabaseGroupLeave";
    String _EXT_SUPA_GROUP_CLANS_GET = "/SupabaseGroupClansGet";
    String _EXT_SUPA_GROUP_CLAN_ADD = "/SupabaseGroupClanAdd";
    String _EXT_SUPA_GROUP_CLAN_REMOVE = "/SupabaseGroupClanRemove";
    String _EXT_SUPA_GROUP_MEMBER_ROLE_SET = "/SupabaseGroupMemberRoleSet";
    String _EXT_SUPA_GROUP_LEADERSHIP_TRANSFER = "/SupabaseGroupLeadershipTransfer";
    String _EXT_SUPA_GROUP_MEMBER_KICK = "/SupabaseGroupMemberKick";
    String _EXT_SUPA_GROUP_POLLS_GET = "/SupabaseGroupPollsGet";
    String _EXT_SUPA_GROUP_POLL_CREATE = "/SupabaseGroupPollCreate";
    String _EXT_SUPA_GROUP_POLL_ANSWER = "/SupabaseGroupPollAnswer";
    String _EXT_SUPA_GROUP_POLL_STATUS = "/SupabaseGroupPollStatus";
    String _EXT_SUPA_GROUP_POLL_REMIND = "/SupabaseGroupPollRemind";
    String _EXT_SUPA_NOTIFICATIONS_GET = "/SupabaseNotificationsGet";
    String _EXT_SUPA_NOTIFICATION_READ = "/SupabaseNotificationRead";

    static String firstNonBlank(String... values) {
        if (values == null) return "";
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return "";
    }

    String getSupabaseUrl() {
        if (_BASE_URL_SUPABASE == null || _BASE_URL_SUPABASE.isBlank()) {
            throw new IllegalStateException("Ontbrekende env var: _BASE_URL_SUPABASE");
        }
        return _BASE_URL_SUPABASE;
    }

    String getSupabaseServiceKey() {
        if (_API_KEY_SECR_SUPABASE == null || _API_KEY_SECR_SUPABASE.isBlank()) {
            throw new IllegalStateException("Ontbrekende env var: _API_KEY_SECR_SUPABASE");
        }
        return _API_KEY_SECR_SUPABASE;
    }

    String getSupabasePublishableKey() {
        if (_API_KEY_SUPABASE == null || _API_KEY_SUPABASE.isBlank()) {
            throw new IllegalStateException("Ontbrekende env var: _API_KEY_SUPABASE");
        }
        return _API_KEY_SUPABASE;
    }

    String getClashApiKey() {
        if (_API_KEY_ACTIVE == null || _API_KEY_ACTIVE.isBlank()) {
            throw new IllegalStateException(
                    "Ontbrekende Clash API key env var, bv. _API_KEY_ALL"
            );
        }

        String key = _API_KEY_ACTIVE.trim();

        if (key.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return key;
        }

        return "Bearer " + key;
    }

    String getClashBaseUrl() {
        return _BASE_URL_CLASH;
    }

    boolean isAuthCookieSecure() {
        return "true".equalsIgnoreCase(_AUTH_COOKIE_SECURE)
                || "None".equalsIgnoreCase(getAuthCookieSameSite());
    }

    String getAuthCookieSameSite() {
        if ("Strict".equalsIgnoreCase(_AUTH_COOKIE_SAME_SITE)) return "Strict";
        if ("None".equalsIgnoreCase(_AUTH_COOKIE_SAME_SITE)) return "None";
        return "Lax";
    }

    long getAuthRefreshCookieMaxAgeSeconds() {
        try {
            long value = Long.parseLong(_AUTH_REFRESH_COOKIE_MAX_AGE_SECONDS);
            return Math.max(3600L, Math.min(value, 34_560_000L));
        } catch (NumberFormatException invalidValue) {
            return 34_560_000L;
        }
    }

    String getAuthEmailConfirmationRedirectUrl() {
        return _AUTH_EMAIL_CONFIRM_REDIRECT_URL == null ? "" : _AUTH_EMAIL_CONFIRM_REDIRECT_URL.trim();
    }

    String getAuthPasswordResetRedirectUrl() {
        return _AUTH_PASSWORD_RESET_REDIRECT_URL == null ? "" : _AUTH_PASSWORD_RESET_REDIRECT_URL.trim();
    }

    String getAuthGoogleCallbackUrl() {
        String value = _AUTH_GOOGLE_CALLBACK_URL == null ? "" : _AUTH_GOOGLE_CALLBACK_URL.trim();
        try {
            java.net.URI uri = java.net.URI.create(value);
            if (!uri.isAbsolute() || uri.getHost() == null || !("http".equals(uri.getScheme()) || "https".equals(uri.getScheme()))) {
                throw new IllegalArgumentException();
            }
            return uri.toString();
        } catch (IllegalArgumentException invalidUrl) {
            throw new IllegalStateException("Ongeldige AUTH_GOOGLE_CALLBACK_URL");
        }
    }

    boolean isCacheEnabled() {
        return !"false".equalsIgnoreCase(_CACHE_ENABLED);
    }

    String getCacheMode() {
        return _CACHE_MODE == null || _CACHE_MODE.isBlank() ? "layered" : _CACHE_MODE;
    }

    String getCacheDatabasePath() {
        return _CACHE_DB_PATH == null || _CACHE_DB_PATH.isBlank()
                ? "data/cache/clashtools-cache.db"
                : _CACHE_DB_PATH.trim();
    }

    int getCacheMemoryMaxEntries() {
        return boundedInt(_CACHE_MEMORY_MAX_ENTRIES, 5_000, 100, 100_000);
    }

    int getCacheDiskMaxEntries() {
        return boundedInt(_CACHE_DISK_MAX_ENTRIES, 25_000, 1_000, 1_000_000);
    }

    int getServerPort() {
        try {
            int port = Integer.parseInt(_SERVER_PORT);
            if (port < 1 || port > 65535) throw new NumberFormatException();
            return port;
        } catch (NumberFormatException invalidPort) {
            throw new IllegalStateException("Ongeldige SERVER_PORT/PORT");
        }
    }

    int getMaxRequestBodyBytes() {
        try {
            int value = Integer.parseInt(_MAX_REQUEST_BODY_BYTES);
            return Math.max(1024, Math.min(value, 10 * 1024 * 1024));
        } catch (NumberFormatException invalidLimit) {
            return 1024 * 1024;
        }
    }

    int getRateLimitForPath(String path) {
        if (_AUTH_LOGIN.equals(path)
                || _AUTH_SIGNUP.equals(path)
                || _AUTH_RECOVER.equals(path)
                || _AUTH_CHANGE_PASSWORD.equals(path)
                || _AUTH_GOOGLE.equals(path)
                || _AUTH_GOOGLE_CALLBACK.equals(path)
                || _EXT_PLAYER_VERIFY_TOKEN.equals(path)) {
            return positiveInt(_SENSITIVE_RATE_LIMIT, 10);
        }
        if (_AUTH_SESSION.equals(path)
                || _AUTH_LOGOUT.equals(path)
                || (path != null && (path.startsWith("/Clan")
                || path.startsWith("/Player")
                || path.startsWith("/League")
                || path.startsWith("/Locations")
                || path.startsWith("/Labels")
                || path.startsWith("/GoldPass")))) {
            return positiveInt(_PUBLIC_RATE_LIMIT, 90);
        }
        return positiveInt(_DATA_RATE_LIMIT, 180);
    }

    boolean trustsProxyHeaders() {
        return "true".equalsIgnoreCase(_TRUST_PROXY_HEADERS);
    }

    private int positiveInt(String value, int fallback) {
        return boundedInt(value, fallback, 1, 10_000);
    }

    private int boundedInt(String value, int fallback, int minimum, int maximum) {
        try {
            return Math.max(minimum, Math.min(Integer.parseInt(value), maximum));
        } catch (NumberFormatException invalidValue) {
            return fallback;
        }
    }

    boolean isOriginAllowed(String origin) {
        if (origin == null || origin.isBlank()) return true;
        for (String allowed : _ALLOWED_ORIGINS.split(",")) {
            if (origin.equalsIgnoreCase(allowed.trim())) return true;
        }
        return false;
    }

    List<String> missingRequiredConfiguration() {
        List<String> missing = new ArrayList<>();
        if (_BASE_URL_SUPABASE == null || _BASE_URL_SUPABASE.isBlank()) missing.add("SUPABASE_URL");
        if (_API_KEY_SUPABASE == null || _API_KEY_SUPABASE.isBlank()) missing.add("SUPABASE_PUBLISHABLE_KEY");
        if (_API_KEY_SECR_SUPABASE == null || _API_KEY_SECR_SUPABASE.isBlank()) missing.add("SUPABASE_SERVICE_ROLE_KEY");
        if (_API_KEY_ACTIVE == null || _API_KEY_ACTIVE.isBlank()) missing.add("CLASH_API_KEY");
        return List.copyOf(missing);
    }

    private static final Dotenv DOTENV = Dotenv.configure()
            .ignoreIfMissing()
            .load();

    private static String env(String name) {
        return stripQuotes(firstNonBlank(
                System.getenv(name),
                DOTENV.get(name)
        ));
    }

    private static String stripQuotes(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.length() >= 2) {
            char first = trimmed.charAt(0);
            char last = trimmed.charAt(trimmed.length() - 1);
            if ((first == '\'' && last == '\'') || (first == '"' && last == '"')) {
                return trimmed.substring(1, trimmed.length() - 1).trim();
            }
        }
        return trimmed;
    }
}
