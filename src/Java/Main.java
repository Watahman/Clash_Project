package Java;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

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
        server = HttpServer.create(new InetSocketAddress(conf.getServerPort()), 0);
        int workerCount = Math.max(4, Math.min(32, Runtime.getRuntime().availableProcessors() * 2));
        ExecutorService executor = Executors.newFixedThreadPool(workerCount);
        server.setExecutor(executor);

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
        apiClan.searchClans();
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
        supaUser.updateUserName();
        supaUser.changePassword();

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

        server.createContext("/health", exchange -> {
            byte[] response = "{\"status\":\"ok\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
            exchange.sendResponseHeaders(200, response.length);
            try (var output = exchange.getResponseBody()) {
                output.write(response);
            }
        });

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            server.stop(2);
            executor.shutdown();
            try {
                if (!executor.awaitTermination(5, TimeUnit.SECONDS)) executor.shutdownNow();
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                executor.shutdownNow();
            }
        }, "clashtools-shutdown"));

        server.start();
        System.out.println("Server gestart op poort " + conf.getServerPort());
    }
}
