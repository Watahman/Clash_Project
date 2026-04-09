package Java;

import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpServer;

import java.net.URLEncoder;

public class API_Leagues {
    private HttpServer server;
    private Config conf;
    private API_Utils utils;

    public API_Leagues(HttpServer server, Config conf){
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    public void getLeagueTierInfo(){
        server.createContext(conf._EXT_LEAGUE_LEAGUETIERS_INFO, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String leagueTierID = json.get("leagueTierID").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/leaguetiers/" + URLEncoder.encode(leagueTierID, "UTF-8");
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    public void getLeagueCapitalLeagues(){
        server.createContext(conf._EXT_LEAGUE_CAPITAL_LEAGUES, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String clashUrl = conf._BASE_URL_CLASH + "/capitalleagues";
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    public void getLeagueTiers(){
        server.createContext(conf._EXT_LEAGUE_LEAGUETIERS, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String clashUrl = conf._BASE_URL_CLASH + "/leaguetiers";
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    public void getLeagues(){
        server.createContext(conf._EXT_LEAGUE_LEAGUES, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String clashUrl = conf._BASE_URL_CLASH + "/leagues";
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    public void getLeagueSeasonInfo(){
        server.createContext(conf._EXT_LEAGUE_LEAGUE_SEASON_INFO, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String leagueID = json.get("leagueID").getAsString();
                    String seasonID = json.get("seasonID").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/leagues/" + URLEncoder.encode(leagueID, "UTF-8") + "/seasons/" +  URLEncoder.encode(seasonID, "UTF-8");
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    public void getLeagueCapitalLeague(){
        server.createContext(conf._EXT_LEAGUE_CAPITAL_LEAGUE_INFO, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String leagueID = json.get("leagueID").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/capitalleagues/" + URLEncoder.encode(leagueID, "UTF-8");
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    public void getLeagueBuilderBaseLeague(){
        server.createContext(conf._EXT_LEAGUE_BUILDERBASE_LEAGUE_INFO, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String leagueID = json.get("leagueID").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/builderbaseleagues/" + URLEncoder.encode(leagueID, "UTF-8");
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    public void getLeagueBuilderBaseLeagues(){
        server.createContext(conf._EXT_LEAGUE_BUILDERBASE_LEAGUES, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String clashUrl = conf._BASE_URL_CLASH + "/builderbaseleagues";
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    public void getLeagueInfo(){
        server.createContext(conf._EXT_LEAGUE_LEAGUE_INFO, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String leagueID = json.get("leagueID").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/leagues/" + URLEncoder.encode(leagueID, "UTF-8");
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    public void getLeagueGroupInfo(){
        server.createContext(conf._EXT_LEAGUE_LEAGUEGROUP_INFO, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String leagueGroupTag = json.get("leagueGroupTag").getAsString();
                    String leagueSeasonID = json.get("leagueSeasonID").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/leaguegroup/" + URLEncoder.encode(leagueGroupTag, "UTF-8") + "/" +  URLEncoder.encode(leagueSeasonID, "UTF-8");
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    public void getLeagueSeasons(){
        server.createContext(conf._EXT_LEAGUE_LEAGUE_SEASONS, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String leagueID = json.get("leagueID").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/leagues/" + URLEncoder.encode(leagueID, "UTF-8") + "/seasons";
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    public void getLeagueWarLeague(){
        server.createContext(conf._EXT_LEAGUE_WARLEAGUE_INFO, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String leagueID = json.get("leagueID").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/warleagues/" + URLEncoder.encode(leagueID, "UTF-8");
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    public void getLeagueWarLeagues(){
        server.createContext(conf._EXT_LEAGUE_WARLEAGUES, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String clashUrl = conf._BASE_URL_CLASH + "/warleagues";
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
