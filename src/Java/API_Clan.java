package Java;

import com.sun.net.httpserver.HttpServer;
import Java.cache.CacheKeys;
import Java.cache.CachePolicy;

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
            String clanTag = CacheKeys.normalizeTag(utils.requireString(utils.parseBody(ex), "clanTag"));
            utils.clashGetCached(ex, "/clans/" + URLEncoder.encode(clanTag, "UTF-8") + "/currentwar/leaguegroup", CachePolicy.CLAN_LEAGUE_GROUP);
        }));
    }

    public void getClanWarLeagueWar() {
        server.createContext(conf._EXT_CLAN_WARLEAGUES_WARS, exchange -> utils.handlePost(exchange, ex -> {
            var body = utils.parseBody(ex);
            String warTag = CacheKeys.normalizeTag(utils.requireString(body, "warTag"));
            utils.clashGetCached(ex, "/clanwarleagues/wars/" + URLEncoder.encode(warTag, "UTF-8"), CachePolicy.CLAN_LEAGUE_WAR);
        }));
    }

    public void getClanWarLog() {
        server.createContext(conf._EXT_CLAN_WAR_LOG, exchange -> utils.handlePost(exchange, ex -> {
            String clanTag = CacheKeys.normalizeTag(utils.requireString(utils.parseBody(ex), "clanTag"));
            utils.clashGetCached(ex, "/clans/" + URLEncoder.encode(clanTag, "UTF-8") + "/warlog", CachePolicy.CLAN_WAR_LOG);
        }));
    }

    public void getClanCurrentWar() {
        server.createContext(conf._EXT_CLAN_CURRENTWAR, exchange -> utils.handlePost(exchange, ex -> {
            String clanTag = CacheKeys.normalizeTag(utils.requireString(utils.parseBody(ex), "clanTag"));
            utils.clashGetCached(ex, "/clans/" + URLEncoder.encode(clanTag, "UTF-8") + "/currentwar", CachePolicy.CLAN_CURRENT_WAR);
        }));
    }

    public void getClanInfo() {
        server.createContext(conf._EXT_CLAN_INFO, exchange -> utils.handlePost(exchange, ex -> {
            String clanTag = CacheKeys.normalizeTag(utils.requireString(utils.parseBody(ex), "clanTag"));
            utils.clashGetCached(ex, "/clans/" + URLEncoder.encode(clanTag, "UTF-8"), CachePolicy.CLAN_INFO);
        }));
    }

    public void getClanMembers() {
        server.createContext(conf._EXT_CLAN_MEMBERS, exchange -> utils.handlePost(exchange, ex -> {
            String clanTag = CacheKeys.normalizeTag(utils.requireString(utils.parseBody(ex), "clanTag"));
            utils.clashGetCached(ex, "/clans/" + URLEncoder.encode(clanTag, "UTF-8") + "/members", CachePolicy.CLAN_MEMBERS);
        }));
    }

    public void getClanCapitalRaidSeasons() {
        server.createContext(conf._EXT_CLAN_CAPITALRAIDSEASONS, exchange -> utils.handlePost(exchange, ex -> {
            String clanTag = CacheKeys.normalizeTag(utils.requireString(utils.parseBody(ex), "clanTag"));
            utils.clashGetCached(ex, "/clans/" + URLEncoder.encode(clanTag, "UTF-8") + "/capitalraidseasons", CachePolicy.CLAN_RAID_SEASONS);
        }));
    }

    // TODO: getClan (conf._EXT_CLAN_SEARCH) nog implementeren
}
