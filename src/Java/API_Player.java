package Java;

import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpServer;

import java.net.URLEncoder;

public class API_Player {
    private final HttpServer server;
    private final Config conf;
    private final API_Utils utils;

    public API_Player(HttpServer server, Config conf) {
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    public void getPlayer() {
        server.createContext(conf._EXT_PLAYER_INFO, exchange -> utils.handlePost(exchange, ex -> {
            String playerID = utils.requireString(utils.parseBody(ex), "playerID");
            utils.clashGet(ex, "/players/" + URLEncoder.encode(playerID, "UTF-8"));
        }));
    }

    public void getPlayerBattleLog() {
        server.createContext(conf._EXT_PLAYER_BATTLE_LOG, exchange -> utils.handlePost(exchange, ex -> {
            String playerID = utils.requireString(utils.parseBody(ex), "playerID");
            utils.clashGet(ex, "/players/" + URLEncoder.encode(playerID, "UTF-8") + "/battlelog");
        }));
    }

    public void postPlayerVerifyToken() {
        server.createContext(conf._EXT_PLAYER_VERIFY_TOKEN, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json    = utils.parseBody(ex);
            String playerTag   = utils.requireString(json, "playerID");
            String playerToken = utils.requireString(json, "playerToken");

            JsonObject body = new JsonObject();
            body.addProperty("token", playerToken);

            utils.clashPost(ex, "/players/" + URLEncoder.encode(playerTag, "UTF-8") + "/verifytoken", body.toString());
        }));
    }

    public void getPlayerLeagueHistory() {
        server.createContext(conf._EXT_PLAYER_LEAGUE_HISTORY, exchange -> utils.handlePost(exchange, ex -> {
            String playerID = utils.requireString(utils.parseBody(ex), "playerID");
            utils.clashGet(ex, "/players/" + URLEncoder.encode(playerID, "UTF-8") + "/leaguehistory");
        }));
    }
}