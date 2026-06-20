package Java;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;

public class Main {
    public static void main(String[] args) throws Exception {
        new Main().run();
    }

    private void run() throws Exception {
        SUPABASE_Group supaGroup;
        SUPABASE_Friend supaFriend;
        SUPABASE_CWLPlanner supaCWLPlanner;
        SUPABASE_User supaUser;
        API_Player apiPlayer;
        API_Locations apiLocations;
        API_Leagues apiLeagues;
        API_Labels apiLabels;
        API_Goldpass apiGoldpass;
        API_Clan apiClan;
        Config conf;
        HttpServer server;
        conf = new Config(); // config initialiseren
        server = HttpServer.create(new InetSocketAddress(8080), 0);

        apiClan = new API_Clan(server, conf);
        apiGoldpass = new API_Goldpass(server, conf);
        apiLabels = new API_Labels(server, conf);
        apiLeagues = new API_Leagues(server, conf);
        apiLocations = new API_Locations(server, conf);
        apiPlayer = new API_Player(server, conf);
        supaUser = new SUPABASE_User(server, conf);
        supaCWLPlanner = new SUPABASE_CWLPlanner(server, conf);
        supaFriend = new SUPABASE_Friend(server, conf);
        supaGroup = new SUPABASE_Group(server, conf);

        apiClan.getClanCurrentWarLeagueGroup();
        apiClan.getClanWarLeagueWar();
        apiClan.getClanWarLog();
        apiClan.getClanCurrentWar();
        apiClan.getClanInfo();
        apiClan.getClanMembers();
        apiClan.getClanCapitalRaidSeasons();

        apiPlayer.getPlayer();
        apiPlayer.getPlayerBattleLog();
        apiPlayer.postPlayerVerifyToken();
        apiPlayer.getPlayerLeagueHistory();

        apiLeagues.getLeagueTierInfo();
        apiLeagues.getLeagueCapitalLeagues();
        apiLeagues.getLeagueTiers();
        apiLeagues.getLeagues();
        apiLeagues.getLeagueSeasonInfo();
        apiLeagues.getLeagueCapitalLeague();
        apiLeagues.getLeagueBuilderBaseLeague();
        apiLeagues.getLeagueBuilderBaseLeagues();
        apiLeagues.getLeagueInfo();
        apiLeagues.getLeagueGroupInfo();
        apiLeagues.getLeagueSeasons();
        apiLeagues.getLeagueWarLeague();
        apiLeagues.getLeagueWarLeagues();

        apiLocations.getLocationRankingClans();
        apiLocations.getLocationRankingPlayers();
        apiLocations.getLocationRankingPlayersBuilderBase();
        apiLocations.getLocationRankingClansBuilderBase();
        apiLocations.getLocations();
        apiLocations.getLocationRankingCapital();
        apiLocations.getLocation();

        apiGoldpass.getGoldPassInfo();

        apiLabels.getLabelsPlayers();
        apiLabels.getLabelsClans();

        supaUser.createUser();
        supaUser.getUserInfo();
        supaUser.getUserBases();
        supaUser.checkUserLogin();
        supaUser.compareUserId();
        supaUser.addAccountToUser();

        supaCWLPlanner.saveCWLPlanner();
        supaCWLPlanner.getAllPlanners();
        supaCWLPlanner.getPlanner();

        supaFriend.addFriend();
        supaFriend.getPendingRequests();
        supaFriend.getFriendRequests();
        supaFriend.acceptFriend();
        supaFriend.rejectFriend();
        supaFriend.getFriends();

        supaGroup.createGroup();
        supaGroup.getUserGroups();
        supaGroup.getGroupInfo();
        supaGroup.getGroupMembers();
        supaGroup.joinGroup();
        supaGroup.leaveGroup();
        supaGroup.getGroupClans();
        supaGroup.addGroupClan();
        supaGroup.removeGroupClan();
        supaGroup.setGroupMemberRole();
        supaGroup.transferGroupLeadership();
        supaGroup.getGroupPolls();
        supaGroup.createGroupPoll();
        supaGroup.answerGroupPoll();
        supaGroup.setGroupPollStatus();

        server.start();
        System.out.println("Server gestart op http://localhost:8080");
    }
}
