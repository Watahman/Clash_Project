package Java;

import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpServer;

import java.net.URLEncoder;

public class API_Clan {
    private final HttpServer server;
    private final Config conf;
    private final API_Utils utils;

    public API_Clan(HttpServer server, Config conf) {
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    public void getClanCurrentWarLeagueGroup() {
        server.createContext(conf._EXT_CLAN_CURRENTWAR_LEAGUEGROUP, exchange -> utils.handlePost(exchange, ex -> {
            String clanTag = utils.requireString(utils.parseBody(ex), "clanTag");
            utils.clashGet(ex, "/clans/" + URLEncoder.encode(clanTag, "UTF-8") + "/currentwar/leaguegroup");
        }));
    }

    public void getClanWarLeagueWar() {
        server.createContext(conf._EXT_CLAN_WARLEAGUES_WARS, exchange -> utils.handlePost(exchange, ex -> {
            String warTag = utils.requireString(utils.parseBody(ex), "warTag");
            utils.clashGet(ex, "/clanwarleagues/wars/" + URLEncoder.encode(warTag, "UTF-8"));
        }));
    }

    public void getClanWarLog() {
        server.createContext(conf._EXT_CLAN_WAR_LOG, exchange -> utils.handlePost(exchange, ex -> {
            String clanTag = utils.requireString(utils.parseBody(ex), "clanTag");
            utils.clashGet(ex, "/clans/" + URLEncoder.encode(clanTag, "UTF-8") + "/warlog");
        }));
    }

    public void getClanCurrentWar() {
        server.createContext(conf._EXT_CLAN_CURRENTWAR, exchange -> utils.handlePost(exchange, ex -> {
            String clanTag = utils.requireString(utils.parseBody(ex), "clanTag");
            utils.clashGet(ex, "/clans/" + URLEncoder.encode(clanTag, "UTF-8") + "/currentwar");
        }));
    }

    public void getClanInfo() {
        server.createContext(conf._EXT_CLAN_INFO, exchange -> utils.handlePost(exchange, ex -> {
            String clanTag = utils.requireString(utils.parseBody(ex), "clanTag");
            utils.clashGet(ex, "/clans/" + URLEncoder.encode(clanTag, "UTF-8"));
        }));
    }

    public void getClanMembers() {
        server.createContext(conf._EXT_CLAN_MEMBERS, exchange -> utils.handlePost(exchange, ex -> {
            String clanTag = utils.requireString(utils.parseBody(ex), "clanTag");
            utils.clashGet(ex, "/clans/" + URLEncoder.encode(clanTag, "UTF-8") + "/members");
        }));
    }

    public void getClanCapitalRaidSeasons() {
        server.createContext(conf._EXT_CLAN_CAPITALRAIDSEASONS, exchange -> utils.handlePost(exchange, ex -> {
            String clanTag = utils.requireString(utils.parseBody(ex), "clanTag");
            utils.clashGet(ex, "/clans/" + URLEncoder.encode(clanTag, "UTF-8") + "/capitalraidseasons");
        }));
    }

    // TODO: getClan (conf._EXT_CLAN_SEARCH) nog implementeren
}