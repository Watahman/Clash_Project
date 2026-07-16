package Java;

public class Config {
    String _API_KEY_SUPABASE = System.getenv("_API_KEY_SUPABASE");
    String _API_KEY_SECR_SUPABASE = firstNonBlank(
            System.getenv("_API_KEY_SECR_SUPABASE"),
            System.getenv("SUPABASE_SERVICE_ROLE_KEY")
    );
    String _API_KEY_BRUGGE = System.getenv("_API_KEY_BRUGGE");
    String _API_KEY_HOME = System.getenv("_API_KEY_HOME");
    String _API_KEY_ALL = System.getenv("_API_KEY_ALL");
    String _API_KEY_0505 = System.getenv("_API_KEY_0505");

    String _API_KEY_ACTIVE = firstNonBlank(_API_KEY_ALL, _API_KEY_HOME, _API_KEY_BRUGGE, _API_KEY_0505);

    String _BASE_URL_SUPABASE = firstNonBlank(System.getenv("_BASE_URL_SUPABASE"), System.getenv("SUPABASE_URL"));
    String _BASE_URL_CLASH = firstNonBlank(System.getenv("_BASE_URL_CLASH"), "https://api.clashofclans.com/v1");
    String _CACHE_ENABLED = firstNonBlank(System.getenv("CACHE_ENABLED"), "true");
    String _CACHE_MODE = firstNonBlank(System.getenv("CACHE_MODE"), "layered");
    String _ALLOWED_ORIGINS = firstNonBlank(
            System.getenv("ALLOWED_ORIGINS"),
            "http://localhost:5173,http://127.0.0.1:5173"
    );
    String _SERVER_PORT = firstNonBlank(System.getenv("PORT"), System.getenv("SERVER_PORT"), "8080");
    String _MAX_REQUEST_BODY_BYTES = firstNonBlank(System.getenv("MAX_REQUEST_BODY_BYTES"), "1048576");

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

    String _EXT_SUPA_USER_MAKE = "/SupabaseUserMake";
    String _EXT_SUPA_USER_INFO = "/SupabaseUserInfo";
    String _EXT_SUPA_USER_BASES = "/SupabaseUserBases";
    String _EXT_SUPA_USER_GROUPS = "/SupabaseUserGroups";
    String _EXT_SUPA_USER_CHECK = "/SupabaseUserCheck";
    String _EXT_SUPA_USER_IDCHECK = "/SupabaseUserIdCheck";
    String _EXT_SUPA_USER_ADD_ACCOUNT = "/SupabaseUserAddAccount";
    String _EXT_SUPA_USER_UPDATE_NAME = "/SupabaseUserUpdateName";
    String _EXT_SUPA_USER_CHANGE_PASSWORD = "/SupabaseUserChangePassword";

    String _EXT_SUPA_USER_ADD_FRIEND = "/SupabaseUserAddFriend";
    String _EXT_SUPA_USER_GET_PENDING_FRIENDS = "/SupabaseUserGetPendingFriends";
    String _EXT_SUPA_USER_GET_FRIEND_REQUESTS =  "/SupabaseUserGetFriendRequests";
    String _EXT_SUPA_USER_ACCEPT_FRIEND =  "/SupabaseUserAcceptFriend";
    String _EXT_SUPA_USER_REJECT_FRIEND = "/SupabaseUserRejectFriend";
    String _EXT_SUPA_USER_GET_FRIENDS = "/SupabaseUserGetFriends";

    String _EXT_SUPA_CWLPLANNER_DATA_SET = "/SupabaseCwplannerDataSet";
    String _EXT_SUPA_CWLPLANNER_DATA_GET = "/SupabaseCwplannerDataGet";
    String _EXT_SUPA_CWLPLANNER_DATA_GET_ALL = "/SupabaseCwplannerDataGetAll";

    String _EXT_SUPA_GROUP_MAKE = "/SupabaseGroupMake";
    String _EXT_SUPA_GROUP_MEMBERS = "/SupabaseGroupMembers";
    String _EXT_SUPA_GROUP_INFO = "/SupabaseGroupInfo";
    String _EXT_SUPA_GROUP_JOIN = "/SupabaseGroupJoin";
    String _EXT_SUPA_GROUP_LEAVE = "/SupabaseGroupLeave";
    String _EXT_SUPA_GROUP_CLANS_GET = "/SupabaseGroupClansGet";
    String _EXT_SUPA_GROUP_CLAN_ADD = "/SupabaseGroupClanAdd";
    String _EXT_SUPA_GROUP_CLAN_REMOVE = "/SupabaseGroupClanRemove";
    String _EXT_SUPA_GROUP_MEMBER_ROLE_SET = "/SupabaseGroupMemberRoleSet";
    String _EXT_SUPA_GROUP_LEADERSHIP_TRANSFER = "/SupabaseGroupLeadershipTransfer";
    String _EXT_SUPA_GROUP_POLLS_GET = "/SupabaseGroupPollsGet";
    String _EXT_SUPA_GROUP_POLL_CREATE = "/SupabaseGroupPollCreate";
    String _EXT_SUPA_GROUP_POLL_ANSWER = "/SupabaseGroupPollAnswer";
    String _EXT_SUPA_GROUP_POLL_STATUS = "/SupabaseGroupPollStatus";

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
            throw new IllegalStateException("Ontbrekende Clash API key env var, bv. _API_KEY_ALL");
        }
        return _API_KEY_ACTIVE;
    }

    String getClashBaseUrl() {
        return _BASE_URL_CLASH;
    }

    boolean isCacheEnabled() {
        return !"false".equalsIgnoreCase(_CACHE_ENABLED);
    }

    String getCacheMode() {
        return _CACHE_MODE == null || _CACHE_MODE.isBlank() ? "layered" : _CACHE_MODE;
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

    boolean isOriginAllowed(String origin) {
        if (origin == null || origin.isBlank()) return true;
        for (String allowed : _ALLOWED_ORIGINS.split(",")) {
            if (origin.equalsIgnoreCase(allowed.trim())) return true;
        }
        return false;
    }
}
