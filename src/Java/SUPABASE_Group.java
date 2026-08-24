package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonNull;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;
import Java.cache.CacheKeys;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public class SUPABASE_Group {
    private final HttpServer server;
    private final Config conf;
    private final API_Utils utils;
    private final LinkedAccountRepository accounts = new LinkedAccountRepository();

    public SUPABASE_Group(HttpServer server, Config conf){
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    public void createGroup() {
        server.createContext(conf._EXT_SUPA_GROUP_MAKE, exchange -> utils.handlePost(exchange, ex -> {
            String ownerId   = utils.requireAuthenticatedUser(ex);
            JsonObject json  = utils.parseBody(ex);
            String naam      = utils.requireString(json, "name").trim();
            String code      = API_Utils.generateCode();

            if (naam.length() < 2 || naam.length() > 80) {
                throw new IllegalArgumentException("Groepsnaam moet 2 tot 80 tekens lang zijn");
            }

            JsonObject rpcBody = new JsonObject();
            rpcBody.addProperty("p_owner_user_id", ownerId);
            rpcBody.addProperty("p_name", naam);
            rpcBody.addProperty("p_code", code);
            rpcBody.addProperty("p_badge", "banner");
            rpcBody.add("p_badge_url", JsonNull.INSTANCE);
            String result = SUPABASE_Client.rpc("create_group_with_owner", rpcBody.toString());
            utils.sendJsonResponse(ex, result, 201);
        }));
    }

    public void getUserGroups() {
        server.createContext(conf._EXT_SUPA_USER_GROUPS, exchange -> utils.handlePost(exchange, ex -> {
            String id = utils.requireAuthenticatedUser(ex);
            utils.parseBody(ex);
            String result   = SUPABASE_Client.getWithBody("group_members", "user_id=" + SUPABASE_Client.eq(id));
            utils.sendJsonResponse(ex, result, 200);
        }));
    }

    public void getGroupInfo() {
        server.createContext(conf._EXT_SUPA_GROUP_INFO, exchange -> utils.handlePost(exchange, ex -> {
            String userId = utils.requireAuthenticatedUser(ex);
            JsonObject json = utils.parseBody(ex);
            String id       = utils.requireString(json, "groupId");
            requireGroupMember(id, userId);
            syncGroupBadgeToPrimaryClan(id);
            String result = SUPABASE_Client.getWithBody(
                    "groups",
                    "select=id,name,owner_id,created_at,code,badge,badge_url,updated_at"
                            + "&id=" + SUPABASE_Client.eq(id)
            );

            JsonArray resultArray = JsonParser.parseString(result).getAsJsonArray();
            if (resultArray.isEmpty()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Groep niet gevonden\"}", 404);
                return;
            }

            resultArray.get(0).getAsJsonObject().add("polls", new JsonArray());
            utils.sendJsonResponse(ex, resultArray.toString(), 200);
        }));
    }

    public void getGroupMembers() {
        server.createContext(conf._EXT_SUPA_GROUP_MEMBERS, exchange -> utils.handlePost(exchange, ex -> {
            String userId = utils.requireAuthenticatedUser(ex);
            JsonObject json = utils.parseBody(ex);
            String id       = utils.requireString(json, "groupId");
            requireGroupMember(id, userId);
            JsonArray members = JsonParser.parseString(SUPABASE_Client.getWithBody(
                    "group_members",
                    "group_id=" + SUPABASE_Client.eq(id)
            )).getAsJsonArray();
            utils.sendJsonResponse(ex, hydrateMemberProfiles(members).toString(), 200);
        }));
    }

    public void joinGroup() {
        server.createContext(conf._EXT_SUPA_GROUP_JOIN, exchange -> utils.handlePost(exchange, ex -> {
            String userId = utils.requireAuthenticatedUser(ex);
            JsonObject json = utils.parseBody(ex);
            String code     = utils.requireString(json, "groupCode").trim();

            JsonObject rpcBody = new JsonObject();
            rpcBody.addProperty("p_actor_user_id", userId);
            rpcBody.addProperty("p_group_code", code);
            String result = SUPABASE_Client.rpc("join_group_with_notifications", rpcBody.toString());
            JsonObject response = JsonParser.parseString(result).getAsJsonObject();
            boolean joined = response.has("joined") && response.get("joined").getAsBoolean();
            utils.sendJsonResponse(ex, response.toString(), joined ? 201 : 200);
        }));
    }

    public void leaveGroup() {
        server.createContext(conf._EXT_SUPA_GROUP_LEAVE, exchange -> utils.handlePost(exchange, ex -> {
            String userId = utils.requireAuthenticatedUser(ex);
            JsonObject json = utils.parseBody(ex);
            String code = utils.requireString(json, "groupCode").trim();

            JsonArray groupArray = JsonParser.parseString(
                    SUPABASE_Client.getWithBody(
                            "groups",
                            "code=" + SUPABASE_Client.eq(code)
                    )
            ).getAsJsonArray();

            if (groupArray.isEmpty()) {
                utils.sendJsonResponse(
                        ex,
                        "{\"error\":\"Groep niet gevonden met code: "
                                + API_Utils.escapeJson(code) + "\"}",
                        404
                );
                return;
            }

            String groupId = groupArray
                    .get(0)
                    .getAsJsonObject()
                    .get("id")
                    .getAsString();

            JsonObject rpcBody = new JsonObject();
            rpcBody.addProperty("p_actor_user_id", userId);
            rpcBody.addProperty("p_group_id", groupId);

            String result = SUPABASE_Client.rpc(
                    "leave_group_or_delete_if_last",
                    rpcBody.toString()
            );

            utils.sendJsonResponse(
                    ex,
                    result.isBlank() ? "{\"success\":true}" : result,
                    200
            );
        }));
    }

    public void getGroupClans() {
        server.createContext(conf._EXT_SUPA_GROUP_CLANS_GET, exchange -> utils.handlePost(exchange, ex -> {
            String userId = utils.requireAuthenticatedUser(ex);
            JsonObject json = utils.parseBody(ex);
            String groupId  = utils.requireString(json, "groupId");

            requireGroupMember(groupId, userId);

            JsonArray clans = getOrderedGroupClans(groupId);
            markPrimaryClan(clans);
            utils.sendJsonResponse(ex, clans.toString(), 200);
        }));
    }

    public void addGroupClan() {
        server.createContext(conf._EXT_SUPA_GROUP_CLAN_ADD, exchange -> utils.handlePost(exchange, ex -> {
            String userId = utils.requireAuthenticatedUser(ex);
            JsonObject json = utils.parseBody(ex);
            String groupId  = utils.requireString(json, "groupId");
            String clanTag  = CacheKeys.requireValidTag(utils.requireString(json, "clanTag"));
            String clanName = utils.requireString(json, "clanName").trim();

            if (clanName.isBlank()) throw new IllegalArgumentException("Clan naam ontbreekt");

            requireGroupAdmin(groupId, userId);

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
            syncGroupBadgeToPrimaryClan(groupId);
            utils.sendJsonResponse(ex, result, 201);
        }));
    }

    public void removeGroupClan() {
        server.createContext(conf._EXT_SUPA_GROUP_CLAN_REMOVE, exchange -> utils.handlePost(exchange, ex -> {
            String userId = utils.requireAuthenticatedUser(ex);
            JsonObject json = utils.parseBody(ex);
            String groupId  = utils.requireString(json, "groupId");
            String clanTag  = CacheKeys.requireValidTag(utils.requireString(json, "clanTag"));

            requireGroupAdmin(groupId, userId);

            String result = SUPABASE_Client.deleteColumn("group_clans",
                    "group_id=" + SUPABASE_Client.eq(groupId) + "&clan_tag=" + SUPABASE_Client.eq(clanTag));
            syncGroupBadgeToPrimaryClan(groupId);
            utils.sendJsonResponse(ex, result.isBlank() ? "{\"success\":true}" : result, 200);
        }));
    }

    public void setGroupMemberRole() {
        server.createContext(conf._EXT_SUPA_GROUP_MEMBER_ROLE_SET, exchange -> utils.handlePost(exchange, ex -> {
            String actorId = utils.requireAuthenticatedUser(ex);
            JsonObject json  = utils.parseBody(ex);
            String groupId   = utils.requireString(json, "groupId");
            String targetId  = utils.requireString(json, "targetUserId");
            String targetRole = normalizeGroupRole(utils.requireString(json, "role"));

            if (!Objects.equals(targetRole, "member") && !Objects.equals(targetRole, "co_leader")) {
                throw new IllegalArgumentException("Gebruik leadership transfer om een leader te wijzigen");
            }

            requireGroupLeader(groupId, actorId);
            ensureGroupMember(groupId, targetId);
            String currentTargetRole = getMemberRole(groupId, targetId);
            if (Objects.equals(currentTargetRole, "leader")) {
                throw new HttpException(403, "{\"error\":\"Gebruik leadership transfer om de leader te wijzigen\"}");
            }

            String result = patchMemberRole(groupId, targetId, targetRole);
            utils.sendJsonResponse(ex, result, 200);
        }));
    }

    public void transferGroupLeadership() {
        server.createContext(conf._EXT_SUPA_GROUP_LEADERSHIP_TRANSFER, exchange -> utils.handlePost(exchange, ex -> {
            String actorId = utils.requireAuthenticatedUser(ex);
            JsonObject json = utils.parseBody(ex);
            String groupId  = utils.requireString(json, "groupId");
            String targetId = utils.requireString(json, "targetUserId");

            JsonObject rpcBody = new JsonObject();
            rpcBody.addProperty("p_actor_user_id", actorId);
            rpcBody.addProperty("p_group_id", groupId);
            rpcBody.addProperty("p_target_user_id", targetId);
            String result = SUPABASE_Client.rpc("transfer_group_leadership", rpcBody.toString());
            utils.sendJsonResponse(ex, result, 200);
        }));
    }

    public void kickGroupMember() {
        server.createContext(conf._EXT_SUPA_GROUP_MEMBER_KICK, exchange -> utils.handlePost(exchange, ex -> {
            String actorId = utils.requireAuthenticatedUser(ex);
            JsonObject json = utils.parseBody(ex);
            String groupId  = utils.requireString(json, "groupId");
            String targetId = utils.requireString(json, "targetUserId");

            JsonObject rpcBody = new JsonObject();
            rpcBody.addProperty("p_actor_user_id", actorId);
            rpcBody.addProperty("p_group_id", groupId);
            rpcBody.addProperty("p_target_user_id", targetId);
            String result = SUPABASE_Client.rpc("kick_group_member", rpcBody.toString());
            utils.sendJsonResponse(ex, result, 200);
        }));
    }

    private JsonObject getGroup(String groupId) throws Exception {
        JsonArray groupArray = JsonParser.parseString(
                SUPABASE_Client.getWithBody("groups", "id=" + SUPABASE_Client.eq(groupId))).getAsJsonArray();

        if (groupArray.isEmpty()) {
            throw new HttpException(404, "{\"error\":\"Groep niet gevonden\"}");
        }

        return groupArray.get(0).getAsJsonObject();
    }

    private void requireGroupMember(String groupId, String userId) throws Exception {
        ensureGroupMember(groupId, userId);
    }

    private JsonObject requireGroupAdmin(String groupId, String userId) throws Exception {
        JsonObject group = getGroup(groupId);
        if (!canManageGroup(group, groupId, userId)) {
            throw new HttpException(403, "{\"error\":\"Alleen leaders en co-leaders mogen dit beheren\"}");
        }
        return group;
    }

    private JsonObject requireGroupLeader(String groupId, String userId) throws Exception {
        JsonObject group = getGroup(groupId);
        String role = getMemberRole(groupId, userId);
        JsonElement ownerEl = group.get("owner_id");
        boolean ownerFallback = ownerEl != null && Objects.equals(ownerEl.getAsString(), userId);
        if (!ownerFallback && !Objects.equals(role, "leader")) {
            throw new HttpException(403, "{\"error\":\"Alleen de groepsleider mag rollen beheren\"}");
        }

        return group;
    }

    private boolean canManageGroup(JsonObject group, String groupId, String userId) throws Exception {
        String role = getMemberRole(groupId, userId);
        JsonElement ownerEl = group.get("owner_id");
        boolean ownerFallback = ownerEl != null && Objects.equals(ownerEl.getAsString(), userId);
        return ownerFallback || Objects.equals(role, "leader") || Objects.equals(role, "co_leader");
    }

    private void ensureGroupMember(String groupId, String userId) throws Exception {
        JsonArray members = JsonParser.parseString(SUPABASE_Client.getWithBody("group_members",
                "group_id=" + SUPABASE_Client.eq(groupId) + "&user_id=" + SUPABASE_Client.eq(userId))).getAsJsonArray();
        if (members.isEmpty()) {
            throw new HttpException(404, "{\"error\":\"Groepslid niet gevonden\"}");
        }
    }

    private String getMemberRole(String groupId, String userId) throws Exception {
        JsonArray members = JsonParser.parseString(SUPABASE_Client.getWithBody("group_members",
                "group_id=" + SUPABASE_Client.eq(groupId) + "&user_id=" + SUPABASE_Client.eq(userId))).getAsJsonArray();
        if (members.isEmpty()) return "";

        JsonObject member = members.get(0).getAsJsonObject();
        JsonElement roleEl = member.get("role");
        if (roleEl == null || roleEl.isJsonNull()) return "member";
        return normalizeGroupRole(roleEl.getAsString());
    }

    private String normalizeGroupRole(String value) {
        if (value == null) return "member";
        String role = value.trim().toLowerCase();
        if (Objects.equals(role, "co-leader")) role = "co_leader";
        if (Objects.equals(role, "leader") || Objects.equals(role, "co_leader") || Objects.equals(role, "member")) {
            return role;
        }
        throw new IllegalArgumentException("Ongeldige rol: " + value);
    }

    private JsonArray hydrateMemberProfiles(JsonArray members) throws Exception {
        Set<String> userIds = new HashSet<>();
        for (JsonElement element : members) {
            JsonElement userId = element.getAsJsonObject().get("user_id");
            if (userId != null && !userId.isJsonNull()) userIds.add(userId.getAsString());
        }
        if (userIds.isEmpty()) return members;
        JsonArray profiles = JsonParser.parseString(SUPABASE_Client.getWithBody(
                "users",
                "select=id,name,code&id=" + SUPABASE_Client.in(userIds)
        )).getAsJsonArray();
        accounts.attachToProfiles(profiles);
        Map<String, JsonObject> byId = new HashMap<>();
        for (JsonElement element : profiles) {
            JsonObject profile = element.getAsJsonObject();
            byId.put(profile.get("id").getAsString(), profile);
        }
        for (JsonElement element : members) {
            JsonObject member = element.getAsJsonObject();
            JsonObject profile = byId.get(member.get("user_id").getAsString());
            if (profile != null) member.add("profile", profile.deepCopy());
        }
        return members;
    }

    private String readFirstString(JsonObject object, String... fields) {
        if (object == null) return "";
        for (String field : fields) {
            JsonElement value = object.get(field);
            if (value != null && !value.isJsonNull()) return value.getAsString();
        }
        return "";
    }

    private String patchMemberRole(String groupId, String userId, String role) throws Exception {
        JsonObject update = new JsonObject();
        update.addProperty("role", normalizeGroupRole(role));
        return SUPABASE_Client.patch("group_members",
                "group_id=" + SUPABASE_Client.eq(groupId) + "&user_id=" + SUPABASE_Client.eq(userId),
                update.toString());
    }

    private JsonArray getOrderedGroupClans(String groupId) throws Exception {
        String result = SUPABASE_Client.getWithBody("group_clans",
                "group_id=" + SUPABASE_Client.eq(groupId) + "&order=created_at.asc,id.asc");
        return JsonParser.parseString(result).getAsJsonArray();
    }

    private void markPrimaryClan(JsonArray clans) {
        for (int index = 0; index < clans.size(); index++) {
            clans.get(index).getAsJsonObject().addProperty("is_primary", index == 0);
        }
    }

    private String syncGroupBadgeToPrimaryClan(String groupId) throws Exception {
        JsonArray clans = getOrderedGroupClans(groupId);
        String primaryBadgeUrl = clans.isEmpty()
                ? ""
                : readFirstString(clans.get(0).getAsJsonObject(), "badge_url", "badgeUrl").trim();

        JsonArray groups = JsonParser.parseString(SUPABASE_Client.getWithBody(
                "groups", "id=" + SUPABASE_Client.eq(groupId))).getAsJsonArray();
        if (groups.isEmpty()) return primaryBadgeUrl;

        JsonObject group = groups.get(0).getAsJsonObject();
        String currentBadgeUrl = readFirstString(group, "badge_url", "badgeUrl").trim();
        String currentBadge = readFirstString(group, "badge").trim();
        if (Objects.equals(currentBadgeUrl, primaryBadgeUrl) && Objects.equals(currentBadge, "banner")) {
            return primaryBadgeUrl;
        }

        JsonObject update = new JsonObject();
        update.addProperty("badge", "banner");
        if (primaryBadgeUrl.isBlank()) update.add("badge_url", JsonNull.INSTANCE);
        else update.addProperty("badge_url", primaryBadgeUrl);
        SUPABASE_Client.patch("groups", "id=" + SUPABASE_Client.eq(groupId), update.toString());
        return primaryBadgeUrl;
    }

    private String normalizeGroupBadge(String value) {
        String badge = value == null ? "shield" : value.trim().toLowerCase();
        return switch (badge) {
            case "swords", "crown", "war_star", "tower", "flame", "banner", "helmet" -> badge;
            default -> "shield";
        };
    }
}
