package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;

import java.util.Objects;

public class SUPABASE_Group {
    private final HttpServer server;
    private final Config conf;
    private final API_Utils utils;

    public SUPABASE_Group(HttpServer server, Config conf){
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    public void createGroup() {
        server.createContext(conf._EXT_SUPA_GROUP_MAKE, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json  = utils.parseBody(ex);
            String naam      = utils.requireString(json, "name");
            String ownerId   = utils.requireString(json, "ownerId");
            String code      = API_Utils.generateCode();

            JsonObject group = new JsonObject();
            group.addProperty("name",     naam);
            group.addProperty("owner_id", ownerId);
            group.addProperty("code",     code);

            String result = SUPABASE_Client.post("groups", group.toString());
            JsonArray resultArray = JsonParser.parseString(result).getAsJsonArray();

            if (resultArray.isEmpty()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Groep aanmaken mislukt\"}", 500);
                return;
            }

            String id = resultArray.get(0).getAsJsonObject().get("id").getAsString();

            JsonObject groupMember = new JsonObject();
            groupMember.addProperty("group_id", id);
            groupMember.addProperty("user_id",  ownerId);
            SUPABASE_Client.post("group_members", groupMember.toString());

            utils.sendJsonResponse(ex, result, 201);
        }));
    }

    public void getUserGroups() {
        server.createContext(conf._EXT_SUPA_USER_GROUPS, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String id       = utils.requireString(json, "userId");
            String result   = SUPABASE_Client.getWithBody("group_members", "user_id=" + SUPABASE_Client.eq(id));
            utils.sendJsonResponse(ex, result, 200);
        }));
    }

    public void getGroupInfo() {
        server.createContext(conf._EXT_SUPA_GROUP_INFO, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String id       = utils.requireString(json, "groupId");
            String result   = SUPABASE_Client.getWithBody("groups", "id=" + SUPABASE_Client.eq(id));

            JsonArray resultArray = JsonParser.parseString(result).getAsJsonArray();
            if (resultArray.isEmpty()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Groep niet gevonden\"}", 404);
                return;
            }

            utils.sendJsonResponse(ex, result, 200);
        }));
    }

    public void getGroupMembers() {
        server.createContext(conf._EXT_SUPA_GROUP_MEMBERS, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String id       = utils.requireString(json, "groupId");
            String result   = SUPABASE_Client.getWithBody("group_members", "group_id=" + SUPABASE_Client.eq(id));
            utils.sendJsonResponse(ex, result, 200);
        }));
    }

    public void joinGroup() {
        server.createContext(conf._EXT_SUPA_GROUP_JOIN, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String userId   = utils.requireString(json, "userId");
            String code     = utils.requireString(json, "groupCode").trim();

            JsonArray groupArray = JsonParser.parseString(
                    SUPABASE_Client.getWithBody("groups", "code=" + SUPABASE_Client.eq(code))).getAsJsonArray();

            if (groupArray.isEmpty()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Groep niet gevonden met code: " + API_Utils.escapeJson(code) + "\"}", 404);
                return;
            }

            String groupId = groupArray.get(0).getAsJsonObject().get("id").getAsString();

            JsonArray existing = JsonParser.parseString(SUPABASE_Client.getWithBody("group_members",
                    "group_id=" + SUPABASE_Client.eq(groupId) + "&user_id=" + SUPABASE_Client.eq(userId))).getAsJsonArray();
            if (!existing.isEmpty()) {
                utils.sendJsonResponse(ex, "{\"success\":true,\"message\":\"Gebruiker is al lid\"}", 200);
                return;
            }

            JsonObject member = new JsonObject();
            member.addProperty("user_id",  userId);
            member.addProperty("group_id", groupId);

            String result = SUPABASE_Client.post("group_members", member.toString());
            utils.sendJsonResponse(ex, result, 201);
        }));
    }

    public void leaveGroup() {
        server.createContext(conf._EXT_SUPA_GROUP_LEAVE, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String userId   = utils.requireString(json, "userId");
            String code     = utils.requireString(json, "groupCode").trim();

            JsonArray groupArray = JsonParser.parseString(
                    SUPABASE_Client.getWithBody("groups", "code=" + SUPABASE_Client.eq(code))).getAsJsonArray();

            if (groupArray.isEmpty()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Groep niet gevonden met code: " + API_Utils.escapeJson(code) + "\"}", 404);
                return;
            }

            JsonObject groupObj = groupArray.get(0).getAsJsonObject();
            String groupId      = groupObj.get("id").getAsString();

            String result = SUPABASE_Client.deleteColumn("group_members",
                    "group_id=" + SUPABASE_Client.eq(groupId) + "&user_id=" + SUPABASE_Client.eq(userId));

            JsonElement ownerEl = groupObj.get("owner_id");
            if (ownerEl != null && Objects.equals(ownerEl.getAsString(), userId)) {
                SUPABASE_Client.deleteColumn("groups", "id=" + SUPABASE_Client.eq(groupId));
            }

            utils.sendJsonResponse(ex, result.isBlank() ? "{\"success\":true}" : result, 200);
        }));
    }

    public void getGroupClans() {
        server.createContext(conf._EXT_SUPA_GROUP_CLANS_GET, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String groupId  = utils.requireString(json, "groupId");
            String userId   = utils.requireString(json, "userId");

            requireGroupOwner(groupId, userId);

            String result = SUPABASE_Client.getWithBody("group_clans",
                    "group_id=" + SUPABASE_Client.eq(groupId) + "&order=created_at.asc");
            utils.sendJsonResponse(ex, result, 200);
        }));
    }

    public void addGroupClan() {
        server.createContext(conf._EXT_SUPA_GROUP_CLAN_ADD, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String groupId  = utils.requireString(json, "groupId");
            String userId   = utils.requireString(json, "userId");
            String clanTag  = normalizeClanTag(utils.requireString(json, "clanTag"));
            String clanName = utils.requireString(json, "clanName").trim();

            if (clanTag.isBlank()) throw new IllegalArgumentException("Ongeldige clantag");
            if (clanName.isBlank()) throw new IllegalArgumentException("Clan naam ontbreekt");

            requireGroupOwner(groupId, userId);

            JsonObject row = new JsonObject();
            row.addProperty("group_id", groupId);
            row.addProperty("clan_tag", clanTag);
            row.addProperty("clan_name", clanName);
            row.addProperty("added_by", userId);
            JsonElement badgeUrl = json.get("badgeUrl");
            if (badgeUrl != null && !badgeUrl.isJsonNull() && !badgeUrl.getAsString().isBlank()) {
                row.addProperty("badge_url", badgeUrl.getAsString());
            }

            String result = SUPABASE_Client.post("group_clans", row.toString());
            utils.sendJsonResponse(ex, result, 201);
        }));
    }

    public void removeGroupClan() {
        server.createContext(conf._EXT_SUPA_GROUP_CLAN_REMOVE, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String groupId  = utils.requireString(json, "groupId");
            String userId   = utils.requireString(json, "userId");
            String clanTag  = normalizeClanTag(utils.requireString(json, "clanTag"));

            if (clanTag.isBlank()) throw new IllegalArgumentException("Ongeldige clantag");

            requireGroupOwner(groupId, userId);

            String result = SUPABASE_Client.deleteColumn("group_clans",
                    "group_id=" + SUPABASE_Client.eq(groupId) + "&clan_tag=" + SUPABASE_Client.eq(clanTag));
            utils.sendJsonResponse(ex, result.isBlank() ? "{\"success\":true}" : result, 200);
        }));
    }

    private JsonObject requireGroupOwner(String groupId, String userId) throws Exception {
        JsonArray groupArray = JsonParser.parseString(
                SUPABASE_Client.getWithBody("groups", "id=" + SUPABASE_Client.eq(groupId))).getAsJsonArray();

        if (groupArray.isEmpty()) {
            throw new HttpException(404, "{\"error\":\"Groep niet gevonden\"}");
        }

        JsonObject group = groupArray.get(0).getAsJsonObject();
        JsonElement ownerEl = group.get("owner_id");
        if (ownerEl == null || !Objects.equals(ownerEl.getAsString(), userId)) {
            throw new HttpException(403, "{\"error\":\"Alleen de groepsleider mag gekoppelde clans beheren\"}");
        }

        return group;
    }

    private String normalizeClanTag(String value) {
        if (value == null) return "";
        String tag = value.trim().toUpperCase();
        if (tag.isBlank()) return "";
        if (!tag.startsWith("#")) tag = "#" + tag;
        return tag;
    }
}
