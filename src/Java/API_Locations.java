package Java;

import com.sun.net.httpserver.HttpServer;

import java.net.URLEncoder;

public class API_Locations {
    private final HttpServer server;
    private final Config conf;
    private final API_Utils utils;

    public API_Locations(HttpServer server, Config conf) {
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    public void getLocations() {
        server.createContext(conf._EXT_LOCATIONS, exchange -> utils.handlePost(exchange, ex ->
                utils.clashGet(ex, "/locations")
        ));
    }

    public void getLocation() {
        server.createContext(conf._EXT_LOCATIONS_INFO, exchange -> utils.handlePost(exchange, ex -> {
            String locationID = utils.requireString(utils.parseBody(ex), "locationID");
            utils.clashGet(ex, "/locations/" + URLEncoder.encode(locationID, "UTF-8"));
        }));
    }

    public void getLocationRankingClans() {
        server.createContext(conf._EXT_LOCATIONS_RANKINGS_CLANS_INFO, exchange -> utils.handlePost(exchange, ex -> {
            String locationID = utils.requireString(utils.parseBody(ex), "locationID");
            utils.clashGet(ex, "/locations/" + URLEncoder.encode(locationID, "UTF-8") + "/rankings/clans");
        }));
    }

    public void getLocationRankingPlayers() {
        server.createContext(conf._EXT_LOCATIONS_RANKINGS_PLAYERS_INFO, exchange -> utils.handlePost(exchange, ex -> {
            String locationID = utils.requireString(utils.parseBody(ex), "locationID");
            utils.clashGet(ex, "/locations/" + URLEncoder.encode(locationID, "UTF-8") + "/rankings/players");
        }));
    }

    public void getLocationRankingPlayersBuilderBase() {
        server.createContext(conf._EXT_LOCATIONS_RANKINGS_PLAYERS_BUILDERBASE_INFO, exchange -> utils.handlePost(exchange, ex -> {
            String locationID = utils.requireString(utils.parseBody(ex), "locationID");
            utils.clashGet(ex, "/locations/" + URLEncoder.encode(locationID, "UTF-8") + "/rankings/players-builder-base");
        }));
    }

    public void getLocationRankingClansBuilderBase() {
        server.createContext(conf._EXT_LOCATIONS_RANKINGS_CLANS_BUILDERBASE_INFO, exchange -> utils.handlePost(exchange, ex -> {
            String locationID = utils.requireString(utils.parseBody(ex), "locationID");
            utils.clashGet(ex, "/locations/" + URLEncoder.encode(locationID, "UTF-8") + "/rankings/clans-builder-base");
        }));
    }

    public void getLocationRankingCapital() {
        server.createContext(conf._EXT_LOCATIONS_RANKINGS_CAPITAL_INFO, exchange -> utils.handlePost(exchange, ex -> {
            String locationID = utils.requireString(utils.parseBody(ex), "locationID");
            utils.clashGet(ex, "/locations/" + URLEncoder.encode(locationID, "UTF-8") + "/rankings/capitals");
        }));
    }
}