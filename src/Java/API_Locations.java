package Java;

import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpServer;

import java.net.URLEncoder;

public class API_Locations {
    private HttpServer server;
    private Config conf;
    private API_Utils utils;

    public API_Locations(HttpServer server, Config conf){
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    public void getLocationRankingClans(){
        server.createContext(conf._EXT_LOCATIONS_RANKINGS_CLANS_INFO, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String locationID = json.get("locationID").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/locations/" + URLEncoder.encode(locationID, "UTF-8") + "/rankings/clans";
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    public void getLocationRankingPlayers(){
        server.createContext(conf._EXT_LOCATIONS_RANKINGS_PLAYERS_INFO, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String locationID = json.get("locationID").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/locations/" + URLEncoder.encode(locationID, "UTF-8") + "/rankings/players";
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    public void getLocationRankingPlayersBuilderBase(){
        server.createContext(conf._EXT_LOCATIONS_RANKINGS_PLAYERS_BUILDERBASE_INFO, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String locationID = json.get("locationID").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/locations/" + URLEncoder.encode(locationID, "UTF-8") + "/rankings/players-builder-base";
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    public void getLocationRankingClansBuilderBase(){
        server.createContext(conf._EXT_LOCATIONS_RANKINGS_CLANS_BUILDERBASE_INFO, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String locationID = json.get("locationID").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/locations/" + URLEncoder.encode(locationID, "UTF-8") + "/rankings/clans-builder-base";
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    public void getLocations(){
        server.createContext(conf._EXT_LOCATIONS, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String clashUrl = conf._BASE_URL_CLASH + "/locations";
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    public void getLocationRankingCapital(){
        server.createContext(conf._EXT_LOCATIONS_RANKINGS_CAPITAL_INFO, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String locationID = json.get("locationID").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/locations/" + URLEncoder.encode(locationID, "UTF-8") + "/rankings/capitals";
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    public void getLocation(){
        server.createContext(conf._EXT_LOCATIONS_INFO, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String locationID = json.get("locationID").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/locations/" + URLEncoder.encode(locationID, "UTF-8");
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