package Java;

import com.sun.net.httpserver.HttpServer;

import java.net.URLEncoder;

public class API_Leagues {
    private final HttpServer server;
    private final Config conf;
    private final API_Utils utils;

    public API_Leagues(HttpServer server, Config conf) {
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    public void getLeagues() {
        server.createContext(conf._EXT_LEAGUE_LEAGUES, exchange -> utils.handlePost(exchange, ex ->
                utils.clashGet(ex, "/leagues")
        ));
    }

    public void getLeagueInfo() {
        server.createContext(conf._EXT_LEAGUE_LEAGUE_INFO, exchange -> utils.handlePost(exchange, ex -> {
            String leagueID = utils.requireString(utils.parseBody(ex), "leagueID");
            utils.clashGet(ex, "/leagues/" + URLEncoder.encode(leagueID, "UTF-8"));
        }));
    }

    public void getLeagueSeasons() {
        server.createContext(conf._EXT_LEAGUE_LEAGUE_SEASONS, exchange -> utils.handlePost(exchange, ex -> {
            String leagueID = utils.requireString(utils.parseBody(ex), "leagueID");
            utils.clashGet(ex, "/leagues/" + URLEncoder.encode(leagueID, "UTF-8") + "/seasons");
        }));
    }

    public void getLeagueSeasonInfo() {
        server.createContext(conf._EXT_LEAGUE_LEAGUE_SEASON_INFO, exchange -> utils.handlePost(exchange, ex -> {
            String leagueID = utils.requireString(utils.parseBody(ex), "leagueID");
            String seasonID  = utils.requireString(utils.parseBody(ex), "seasonID");
            utils.clashGet(ex, "/leagues/" + URLEncoder.encode(leagueID, "UTF-8") + "/seasons/" + URLEncoder.encode(seasonID, "UTF-8"));
        }));
    }

    public void getLeagueTiers() {
        server.createContext(conf._EXT_LEAGUE_LEAGUETIERS, exchange -> utils.handlePost(exchange, ex ->
                utils.clashGet(ex, "/leaguetiers")
        ));
    }

    public void getLeagueTierInfo() {
        server.createContext(conf._EXT_LEAGUE_LEAGUETIERS_INFO, exchange -> utils.handlePost(exchange, ex -> {
            String leagueTierID = utils.requireString(utils.parseBody(ex), "leagueTierID");
            utils.clashGet(ex, "/leaguetiers/" + URLEncoder.encode(leagueTierID, "UTF-8"));
        }));
    }

    public void getLeagueCapitalLeagues() {
        server.createContext(conf._EXT_LEAGUE_CAPITAL_LEAGUES, exchange -> utils.handlePost(exchange, ex ->
                utils.clashGet(ex, "/capitalleagues")
        ));
    }

    public void getLeagueCapitalLeague() {
        server.createContext(conf._EXT_LEAGUE_CAPITAL_LEAGUE_INFO, exchange -> utils.handlePost(exchange, ex -> {
            String leagueID = utils.requireString(utils.parseBody(ex), "leagueID");
            utils.clashGet(ex, "/capitalleagues/" + URLEncoder.encode(leagueID, "UTF-8"));
        }));
    }

    public void getLeagueBuilderBaseLeagues() {
        server.createContext(conf._EXT_LEAGUE_BUILDERBASE_LEAGUES, exchange -> utils.handlePost(exchange, ex ->
                utils.clashGet(ex, "/builderbaseleagues")
        ));
    }

    public void getLeagueBuilderBaseLeague() {
        server.createContext(conf._EXT_LEAGUE_BUILDERBASE_LEAGUE_INFO, exchange -> utils.handlePost(exchange, ex -> {
            String leagueID = utils.requireString(utils.parseBody(ex), "leagueID");
            utils.clashGet(ex, "/builderbaseleagues/" + URLEncoder.encode(leagueID, "UTF-8"));
        }));
    }

    public void getLeagueWarLeagues() {
        server.createContext(conf._EXT_LEAGUE_WARLEAGUES, exchange -> utils.handlePost(exchange, ex ->
                utils.clashGet(ex, "/warleagues")
        ));
    }

    public void getLeagueWarLeague() {
        server.createContext(conf._EXT_LEAGUE_WARLEAGUE_INFO, exchange -> utils.handlePost(exchange, ex -> {
            String leagueID = utils.requireString(utils.parseBody(ex), "leagueID");
            utils.clashGet(ex, "/warleagues/" + URLEncoder.encode(leagueID, "UTF-8"));
        }));
    }

    public void getLeagueGroupInfo() {
        server.createContext(conf._EXT_LEAGUE_LEAGUEGROUP_INFO, exchange -> utils.handlePost(exchange, ex -> {
            String leagueGroupTag = utils.requireString(utils.parseBody(ex), "leagueGroupTag");
            String leagueSeasonID = utils.requireString(utils.parseBody(ex), "leagueSeasonID");
            utils.clashGet(ex, "/leaguegroup/" + URLEncoder.encode(leagueGroupTag, "UTF-8") + "/" + URLEncoder.encode(leagueSeasonID, "UTF-8"));
        }));
    }
}