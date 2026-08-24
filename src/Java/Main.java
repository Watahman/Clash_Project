package Java;

import Java.achievements.AchievementCatalog;
import Java.cwlhistory.HistoricalCwlProviderFactory;
import Java.cwlhistory.HistoricalCwlService;
import Java.performance.ClashKingRequestCounter;
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
        SUPABASE_GroupActivity supaGroupActivity;
        SUPABASE_GroupPolls supaGroupPolls;
        SUPABASE_Notifications supaNotifications;
        SUPABASE_Friend supaFriend;
        SUPABASE_CWLPlanner supaCWLPlanner;
        SUPABASE_User supaUser;
        SUPABASE_Auth supaAuth;
        SUPABASE_Achievements supaAchievements;
        SUPABASE_AdvancedStats supaAdvancedStats;
        AdvancedStatsInternalPoll advancedStatsInternalPoll;
        PublicIntake publicIntake;
        API_Player apiPlayer;
        API_PlayerPerformance apiPlayerPerformance;
        API_CWLHistory apiCwlHistory;
        API_Locations apiLocations;
        API_Leagues apiLeagues;
        API_Labels apiLabels;
        API_Goldpass apiGoldpass;
        API_Clan apiClan;
        Config conf;
        HttpServer server;
        conf = new Config(); // config initialiseren
        conf.validateClashApiKeyConfiguration();
        ClashKingRequestCounter.configure(conf.getClashKingCounterIntervalSeconds());
        AchievementCatalog.definitions(); // Fail startup before readiness if the embedded v2 catalog is invalid.
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
        apiPlayerPerformance = new API_PlayerPerformance(server, conf);
        HistoricalCwlService cwlHistoryService = new HistoricalCwlService(
                HistoricalCwlProviderFactory.create(conf)
        );
        HistoricalCwlService achievementCwlHistoryService = new HistoricalCwlService(
                HistoricalCwlProviderFactory.createV2(conf)
        );
        apiCwlHistory = new API_CWLHistory(server, conf, cwlHistoryService);
        supaUser = new SUPABASE_User(server, conf);
        supaAuth = new SUPABASE_Auth(server, conf);
        supaAchievements = new SUPABASE_Achievements(
                server,
                conf,
                achievementCwlHistoryService
        );
        supaAdvancedStats = new SUPABASE_AdvancedStats(server, conf);
        advancedStatsInternalPoll = new AdvancedStatsInternalPoll(server, conf);
        publicIntake = new PublicIntake(server, conf);
        supaCWLPlanner = new SUPABASE_CWLPlanner(server, conf);
        supaFriend = new SUPABASE_Friend(server, conf);
        supaGroup = new SUPABASE_Group(server, conf);
        supaGroupActivity = new SUPABASE_GroupActivity(server, conf);
        supaGroupPolls = new SUPABASE_GroupPolls(server, conf);
        supaNotifications = new SUPABASE_Notifications(server, conf);

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
        apiPlayerPerformance.postPlayerPerformance();
        apiCwlHistory.registerRoutes();

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

        supaAuth.registerRoutes();
        supaAchievements.registerRoutes();
        supaAdvancedStats.registerRoutes();
        advancedStatsInternalPoll.registerRoute();
        publicIntake.registerRoutes();

        supaUser.getUserInfo();
        supaUser.getUserBases();
        supaUser.compareUserId();
        supaUser.addAccountToUser();
        supaUser.updateUserName();

        supaCWLPlanner.saveCWLPlanner();
        supaCWLPlanner.getAllPlanners();
        supaCWLPlanner.getPlanner();
        supaCWLPlanner.renamePlanner();
        supaCWLPlanner.copyPlanner();
        supaCWLPlanner.deletePlanner();

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
        supaGroupActivity.getGroupMemberActivity();
        supaGroup.joinGroup();
        supaGroup.leaveGroup();
        supaGroup.getGroupClans();
        supaGroup.addGroupClan();
        supaGroup.removeGroupClan();
        supaGroup.setGroupMemberRole();
        supaGroup.transferGroupLeadership();
        supaGroup.kickGroupMember();
        supaGroupPolls.getGroupPolls();
        supaGroupPolls.createGroupPoll();
        supaGroupPolls.answerGroupPoll();
        supaGroupPolls.setGroupPollStatus();
        supaGroupPolls.sendPollReminders();
        supaGroupPolls.deleteGroupPoll();
        supaNotifications.getNotifications();
        supaNotifications.markNotificationRead();

        server.createContext("/health", exchange -> {
            byte[] response = "{\"status\":\"ok\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
            exchange.sendResponseHeaders(200, response.length);
            try (var output = exchange.getResponseBody()) {
                output.write(response);
            }
        });
        server.createContext("/ready", exchange -> {
            var missing = conf.missingRequiredConfiguration();
            boolean ready = missing.isEmpty();
            String body = ready
                    ? "{\"status\":\"ready\"}"
                    : "{\"status\":\"not_ready\",\"missing\":" + new com.google.gson.Gson().toJson(missing) + "}";
            byte[] response = body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
            exchange.sendResponseHeaders(ready ? 200 : 503, response.length);
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
