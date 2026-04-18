package Java;

import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpServer;

import java.net.URLEncoder;

public class API_Clan {
    private HttpServer server;
    private Config conf;
    private API_Utils utils;

    public API_Clan(HttpServer server, Config conf) {
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    // /clans/clantag/currentwar/leaguegroup
    public void getClanCurrentWarLeagueGroup(){
        server.createContext(conf._EXT_CLAN_CURRENTWAR_LEAGUEGROUP, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String clanTag = json.get("clanTag").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/clans/" + URLEncoder.encode(clanTag, "UTF-8") + "/currentwar/leaguegroup";
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    // /clanwarleagues/wars/wartag
    public void getClanWarLeagueWar(){
        server.createContext(conf._EXT_CLAN_WARLEAGUES_WARS, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String warTag = json.get("warTag").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/clanwarleagues/wars/" + URLEncoder.encode(warTag, "UTF-8");
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    // /clans/clantag/warlog
    public void getClanWarLog(){
        server.createContext(conf._EXT_CLAN_WAR_LOG, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String clanTag = json.get("clanTag").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/clans/" + URLEncoder.encode(clanTag, "UTF-8") + "/warlog";
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    // /clans
    // change parameters based on info
    public void getClan(){
        server.createContext(conf._EXT_CLAN_SEARCH, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
//                    JsonObject json = utils.parseRequestBody(exchange);
//                    String clanTag = json.getWithBody("clanTag").getAsString();
//
//                    String clashUrl = conf._BASE_URL_CLASH + "/clans/" + URLEncoder.encode(clanTag, "UTF-8");
//                    String responseText = utils.getClashApiResponse(clashUrl);
//
//                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    // /clans/clantag/currentwar
    public void getClanCurrentWar(){
        server.createContext(conf._EXT_CLAN_CURRENTWAR, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String clanTag = json.get("clanTag").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/clans/" + URLEncoder.encode(clanTag, "UTF-8") + "/currentwar";
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    // /clans/clantag
    public void getClanInfo(){
        server.createContext(conf._EXT_CLAN_INFO, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String clanTag = json.get("clanTag").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/clans/" + URLEncoder.encode(clanTag, "UTF-8");
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    // /clans/clantag/members
    public void getClanMembers() {
        server.createContext(conf._EXT_CLAN_MEMBERS, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String clanTag = json.get("clanTag").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/clans/" + URLEncoder.encode(clanTag, "UTF-8") + "/members";
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    // /clans/clantag/capitalraidseasons
    public void getClanCapitalRaidSeasons() {
        server.createContext(conf._EXT_CLAN_CAPITALRAIDSEASONS, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    JsonObject json = utils.parseRequestBody(exchange);
                    String clanTag = json.get("clanTag").getAsString();

                    String clashUrl = conf._BASE_URL_CLASH + "/clans/" + URLEncoder.encode(clanTag, "UTF-8") + "/capitalraidseasons";
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
