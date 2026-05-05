package Java;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;

public class Main {
    private HttpServer server;
    private Config conf;
    private API_Clan apiClan;
    private API_Goldpass apiGoldpass;
    private API_Labels apiLabels;
    private API_Leagues apiLeagues;
    private API_Locations apiLocations;
    private API_Player apiPlayer;
    private SUPABASE_User supaUser;
    private SUPABASE_CWLPlanner supaCWLPlanner;
    private SUPABASE_Friend supaFriend;

    static void main() throws Exception {
        new Main().run();
    }

    private void run() throws Exception {
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

        apiClan.getClanCurrentWarLeagueGroup();
        apiClan.getClanWarLeagueWar();
        apiClan.getClanWarLog();
        apiClan.getClan();
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
        supaUser.checkUserLogin();
        supaUser.compareUserId();
        supaUser.addAccountToUser();

        supaCWLPlanner.saveCWLPlanner();
        supaCWLPlanner.getAllPlanners();
        supaCWLPlanner.getPlanner();

        supaFriend.addFriend();

        server.start();
        System.out.println("Server gestart op http://localhost:8080");
    }
}