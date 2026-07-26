export let canAutosave = false;
export function setCanAutosave(value) {
    canAutosave = value;
}
export let isLoading = false;
export function setLoading(value) {
    isLoading = value;
}

const configuredBaseUrl = String(window.APP_CONFIG?.API_BASE_URL || '').trim();

export const _BASE_URL = configuredBaseUrl.replace(/\/+$/, '');

export const _EXT_CLAN_CURRENTWAR_LEAGUEGROUP = "/ClanCurrentWarLeagueGroup";
export const _EXT_CLAN_WARLEAGUES_WARS = "/ClanWarLeaguesWars";
export const _EXT_CLAN_WAR_LOG = "/ClanWarLog";
export const _EXT_CLAN_SEARCH = "/ClanSearch";
export const _EXT_CLAN_CURRENTWAR = "/ClanCurrentWar";
export const _EXT_CLAN_INFO = "/ClanInfo";
export const _EXT_CLAN_MEMBERS = "/ClanMembers";
export const _EXT_CLAN_CAPITALRAIDSEASONS = "/ClanCapitalRaidSeasons";

export const _EXT_PLAYER_INFO = "/Player";
export const _EXT_PLAYER_BATTLE_LOG = "/PlayerBattleLog";
export const _EXT_PLAYER_LEAGUE_HISTORY = "/PlayerLeagueHistory";
export const _EXT_PLAYER_VERIFY_TOKEN = "/PlayerVerifyToken";
export const _EXT_PLAYER_PERFORMANCE = "/PlayerPerformance";

export const _EXT_LEAGUE_LEAGUETIERS_INFO = "/LeagueTierInfo"
export const _EXT_LEAGUE_CAPITAL_LEAGUES = "/LeagueCapitalLeagues"
export const _EXT_LEAGUE_LEAGUETIERS = "/LeagueTiers"
export const _EXT_LEAGUE_LEAGUES = "/Leagues"
export const _EXT_LEAGUE_LEAGUE_SEASON_INFO = "/LeagueLeagueSeasonInfo"
export const _EXT_LEAGUE_CAPITAL_LEAGUE_INFO = "/LeagueCapitalLeagueInfo"
export const _EXT_LEAGUE_BUILDERBASE_LEAGUE_INFO = "/LeagueBuilderbaseLeagueInfo"
export const _EXT_LEAGUE_BUILDERBASE_LEAGUES = "/LeagueBuilderbaseLeagues"
export const _EXT_LEAGUE_LEAGUE_INFO = "/LeagueInfo"
export const _EXT_LEAGUE_LEAGUEGROUP_INFO= "/LeagueGroupInfo"
export const _EXT_LEAGUE_LEAGUE_SEASONS= "/LeagueSeasons"
export const _EXT_LEAGUE_WARLEAGUE_INFO= "/LeagueWarInfo"
export const _EXT_LEAGUE_WARLEAGUES= "/LeagueWar"

export const _EXT_LOCATIONS_RANKINGS_CLANS_INFO = "/LocationsRankingsClansInfo"
export const _EXT_LOCATIONS_RANKINGS_PLAYERS_INFO = "/LocationsRankingsPlayersInfo"
export const _EXT_LOCATIONS_RANKINGS_PLAYERS_BUILDERBASE_INFO = "/LocationsRankingsPlayersBuilderbaseInfo"
export const _EXT_LOCATIONS_RANKINGS_CLANS_BUILDERBASE_INFO = "/LocationsRankingsClansBuilderbaseInfo"
export const _EXT_LOCATIONS = "/Locations"
export const _EXT_LOCATIONS_RANKINGS_CAPITAL_INFO = "/LocationsRankingsCapitalInfo"
export const _EXT_LOCATIONS_INFO = "/LocationsInfo"

export const _EXT_GOLDPASS = "/GoldPass"

export const _EXT_LABELS_PLAYERS = "/LabelsPlayers"
export const _EXT_LABELS_CLANS = "/LabelsClans"

export const _EXT_SUPA_CONF = "/SupabaseConfigInfo"

export const _EXT_SUPA_USER_INFO = "/SupabaseUserInfo"
export const _EXT_SUPA_USER_BASES = "/SupabaseUserBases";
export const _EXT_SUPA_USER_GROUPS = "/SupabaseUserGroups";
export const _EXT_SUPA_USER_IDCHECK = "/SupabaseUserIdCheck"
export const _EXT_SUPA_USER_ADD_ACCOUNT = "/SupabaseUserAddAccount";
export const _EXT_SUPA_USER_UPDATE_NAME = "/SupabaseUserUpdateName";

export const _EXT_SUPA_USER_ADD_FRIEND = "/SupabaseUserAddFriend";
export const _EXT_SUPA_USER_GET_PENDING_FRIENDS = "/SupabaseUserGetPendingFriends";
export const _EXT_SUPA_USER_GET_FRIEND_REQUESTS =  "/SupabaseUserGetFriendRequests";
export const _EXT_SUPA_USER_ACCEPT_FRIEND =  "/SupabaseUserAcceptFriend";
export const _EXT_SUPA_USER_REJECT_FRIEND = "/SupabaseUserRejectFriend";
export const _EXT_SUPA_USER_GET_FRIENDS = "/SupabaseUserGetFriends";

export const _EXT_SUPA_CWLPLANNER_DATA_SET = "/SupabaseCwplannerDataSet";
export const _EXT_SUPA_CWLPLANNER_DATA_GET = "/SupabaseCwplannerDataGet";
export const _EXT_SUPA_CWLPLANNER_DATA_GET_ALL = "/SupabaseCwplannerDataGetAll";
export const _EXT_SUPA_CWLPLANNER_RENAME = "/SupabaseCwplannerRename";
export const _EXT_SUPA_CWLPLANNER_COPY = "/SupabaseCwplannerCopy";
export const _EXT_SUPA_CWLPLANNER_DELETE = "/SupabaseCwplannerDelete";

export const _EXT_SUPA_GROUP_MAKE = "/SupabaseGroupMake";
export const _EXT_SUPA_GROUP_MEMBERS = "/SupabaseGroupMembers";
export const _EXT_SUPA_GROUP_MEMBER_ACTIVITY = "/SupabaseGroupMemberActivity";
export const _EXT_SUPA_GROUP_INFO = "/SupabaseGroupInfo";
export const _EXT_SUPA_GROUP_JOIN = "/SupabaseGroupJoin";
export const _EXT_SUPA_GROUP_LEAVE = "/SupabaseGroupLeave";
export const _EXT_SUPA_GROUP_CLANS_GET = "/SupabaseGroupClansGet";
export const _EXT_SUPA_GROUP_CLAN_ADD = "/SupabaseGroupClanAdd";
export const _EXT_SUPA_GROUP_CLAN_REMOVE = "/SupabaseGroupClanRemove";
export const _EXT_SUPA_GROUP_MEMBER_ROLE_SET = "/SupabaseGroupMemberRoleSet";
export const _EXT_SUPA_GROUP_LEADERSHIP_TRANSFER = "/SupabaseGroupLeadershipTransfer";
export const _EXT_SUPA_GROUP_MEMBER_KICK = "/SupabaseGroupMemberKick";
export const _EXT_SUPA_GROUP_POLLS_GET = "/SupabaseGroupPollsGet";
export const _EXT_SUPA_GROUP_POLL_CREATE = "/SupabaseGroupPollCreate";
export const _EXT_SUPA_GROUP_POLL_ANSWER = "/SupabaseGroupPollAnswer";
export const _EXT_SUPA_GROUP_POLL_STATUS = "/SupabaseGroupPollStatus";
export const _EXT_SUPA_GROUP_POLL_REMIND = "/SupabaseGroupPollRemind";
export const _EXT_SUPA_NOTIFICATIONS_GET = "/SupabaseNotificationsGet";
export const _EXT_SUPA_NOTIFICATION_READ = "/SupabaseNotificationRead";
