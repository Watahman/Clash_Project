package Java;

import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpServer;

import java.net.URLEncoder;

public class API_Player {
    private HttpServer server;
    private Config conf;
    private API_Utils utils;

    public API_Player(HttpServer server, Config conf){
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    // /players/playertag
    public void getPlayer(){
        server.createContext(conf._EXT_PLAYER_INFO, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String playerID = json.get("playerID").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/players/" + URLEncoder.encode(playerID, "UTF-8");
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    // /players/playertag/battlelog
    public void getPlayerBattleLog(){
        server.createContext(conf._EXT_PLAYER_BATTLE_LOG, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String playerID = json.get("playerID").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/players/" + URLEncoder.encode(playerID, "UTF-8") + "/battlelog";
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    // /players/playertag/verifytoken
    public void postPlayerVerifyToken(){
        server.createContext(conf._EXT_PLAYER_VERIFY_TOKEN, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    System.out.println(json);

                    String playerTag = json.get("playerID").getAsString();
                    String playerToken = json.get("playerToken").getAsString();
                    String clashUrl = conf._BASE_URL_CLASH + "/players/" + URLEncoder.encode(playerTag, "UTF-8") + "/verifytoken";

                    JsonObject body = new JsonObject();
                    body.addProperty("token", playerToken);

                    String responseText = utils.postClashApiResponse(clashUrl, body.toString());
                    System.out.println(responseText);
                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    // /players/playertag/leaguehistory
    public void getPlayerLeagueHistory(){
        server.createContext(conf._EXT_PLAYER_LEAGUE_HISTORY, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String playerID = json.get("playerID").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/players/" + URLEncoder.encode(playerID, "UTF-8") + "/leaguehistory";
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }
}