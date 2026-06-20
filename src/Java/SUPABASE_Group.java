package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;

import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

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
            String badge     = normalizeGroupBadge(json.has("badge") ? json.get("badge").getAsString() : "shield");
            String code      = API_Utils.generateCode();

            JsonObject group = new JsonObject();
            group.addProperty("name",     naam);
            group.addProperty("owner_id", ownerId);
            group.addProperty("code",     code);
            group.addProperty("badge",    badge);
            String badgeUrl = readFirstString(json, "badgeUrl", "badge_url").trim();
            if (!badgeUrl.isBlank()) group.addProperty("badge_url", badgeUrl);

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
            groupMember.addProperty("role", "leader");
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

            utils.sendJsonResponse(ex, sanitizeGroupInfoForGeneralRead(result), 200);
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
            member.addProperty("role", "member");

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
            JsonElement ownerEl = groupObj.get("owner_id");
            boolean isOwner = ownerEl != null && Objects.equals(ownerEl.getAsString(), userId);
            boolean isLeader = Objects.equals(getMemberRole(groupId, userId), "leader");
            if (isOwner || isLeader) {
                throw new HttpException(403, "{\"error\":\"Draag eerst leadership over voordat je de groep verlaat\"}");
            }

            String result = SUPABASE_Client.deleteColumn("group_members",
                    "group_id=" + SUPABASE_Client.eq(groupId) + "&user_id=" + SUPABASE_Client.eq(userId));

            utils.sendJsonResponse(ex, result.isBlank() ? "{\"success\":true}" : result, 200);
        }));
    }

    public void getGroupClans() {
        server.createContext(conf._EXT_SUPA_GROUP_CLANS_GET, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String groupId  = utils.requireString(json, "groupId");
            String userId   = utils.requireString(json, "userId");

            requireGroupMember(groupId, userId);

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

            JsonObject group = requireGroupAdmin(groupId, userId);

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
            if (badgeUrl != null && !badgeUrl.isJsonNull() && !badgeUrl.getAsString().trim().isBlank()) {
                patchGroupBadgeUrlIfMissing(groupId, group, badgeUrl.getAsString().trim());
            }
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

            requireGroupAdmin(groupId, userId);

            String result = SUPABASE_Client.deleteColumn("group_clans",
                    "group_id=" + SUPABASE_Client.eq(groupId) + "&clan_tag=" + SUPABASE_Client.eq(clanTag));
            utils.sendJsonResponse(ex, result.isBlank() ? "{\"success\":true}" : result, 200);
        }));
    }

    public void setGroupMemberRole() {
        server.createContext(conf._EXT_SUPA_GROUP_MEMBER_ROLE_SET, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json  = utils.parseBody(ex);
            String groupId   = utils.requireString(json, "groupId");
            String actorId   = utils.requireString(json, "actorId");
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
            JsonObject json = utils.parseBody(ex);
            String groupId  = utils.requireString(json, "groupId");
            String actorId  = utils.requireString(json, "actorId");
            String targetId = utils.requireString(json, "targetUserId");

            JsonObject group = requireGroupLeader(groupId, actorId);
            ensureGroupMember(groupId, targetId);

            if (Objects.equals(actorId, targetId)) {
                utils.sendJsonResponse(ex, "{\"success\":true,\"message\":\"Leader blijft ongewijzigd\"}", 200);
                return;
            }

            String previousTargetRole = getMemberRole(groupId, targetId);
            try {
                patchMemberRole(groupId, actorId, "co_leader");
                patchMemberRole(groupId, targetId, "leader");
                String result = patchGroupOwner(groupId, targetId);
                utils.sendJsonResponse(ex, result, 200);
            } catch (Exception transferError) {
                try {
                    patchMemberRole(groupId, targetId, previousTargetRole);
                    patchMemberRole(groupId, actorId, "leader");
                    patchGroupOwner(groupId, actorId);
                } catch (Exception rollbackError) {
                    transferError.addSuppressed(rollbackError);
                }
                throw transferError;
            }
        }));
    }

    public void getGroupPolls() {
        server.createContext(conf._EXT_SUPA_GROUP_POLLS_GET, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String groupId  = utils.requireString(json, "groupId");
            String userId   = utils.requireString(json, "userId");

            requireGroupMember(groupId, userId);
            JsonObject group = getGroup(groupId);
            JsonArray polls = getPollsFromGroup(group);
            boolean canSeeAllAnswers = canManageGroup(group, groupId, userId);
            utils.sendJsonResponse(ex, sanitizePollsForUser(polls, userId, canSeeAllAnswers).toString(), 200);
        }));
    }

    public void createGroupPoll() {
        server.createContext(conf._EXT_SUPA_GROUP_POLL_CREATE, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String groupId  = utils.requireString(json, "groupId");
            String userId   = utils.requireString(json, "userId");
            String title    = utils.requireString(json, "title").trim();
            int rounds      = json.has("rounds") ? json.get("rounds").getAsInt() : 7;

            if (title.isBlank()) throw new IllegalArgumentException("Poll titel ontbreekt");
            if (rounds < 1 || rounds > 7) throw new IllegalArgumentException("Rounds moet tussen 1 en 7 liggen");

            requireGroupAdmin(groupId, userId);
            JsonArray polls = getPolls(groupId);
            closeOpenCwlPolls(polls);

            JsonObject poll = new JsonObject();
            poll.addProperty("id", UUID.randomUUID().toString());
            poll.addProperty("title", title);
            poll.addProperty("type", "cwl_availability");
            poll.addProperty("creator_id", userId);
            poll.addProperty("created_at", Instant.now().toString());
            poll.addProperty("status", "open");
            poll.addProperty("rounds", rounds);
            poll.add("answers", new JsonObject());
            polls.add(poll);

            savePolls(groupId, polls);
            utils.sendJsonResponse(ex, poll.toString(), 201);
        }));
    }

    public void answerGroupPoll() {
        server.createContext(conf._EXT_SUPA_GROUP_POLL_ANSWER, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String groupId  = utils.requireString(json, "groupId");
            String userId   = utils.requireString(json, "userId");
            String pollId   = utils.requireString(json, "pollId");
            JsonArray accounts = utils.requireArray(json, "accounts");

            requireGroupMember(groupId, userId);
            JsonArray polls = getPolls(groupId);
            JsonObject poll = findPoll(polls, pollId);
            if (!Objects.equals(poll.get("status").getAsString(), "open")) {
                throw new HttpException(403, "{\"error\":\"Poll is gesloten\"}");
            }

            JsonArray validatedAccounts = validatePollAccounts(userId, accounts);
            JsonObject answer = new JsonObject();
            answer.addProperty("user_id", userId);
            answer.addProperty("updated_at", Instant.now().toString());
            answer.add("accounts", validatedAccounts);
            if (!poll.has("answers") || !poll.get("answers").isJsonObject()) poll.add("answers", new JsonObject());
            poll.getAsJsonObject("answers").add(userId, answer);

            savePolls(groupId, polls);
            utils.sendJsonResponse(ex, answer.toString(), 200);
        }));
    }

    public void setGroupPollStatus() {
        server.createContext(conf._EXT_SUPA_GROUP_POLL_STATUS, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String groupId  = utils.requireString(json, "groupId");
            String userId   = utils.requireString(json, "userId");
            String pollId   = utils.requireString(json, "pollId");
            String status   = utils.requireString(json, "status").trim().toLowerCase();

            if (!Objects.equals(status, "open") && !Objects.equals(status, "closed")) {
                throw new IllegalArgumentException("Ongeldige poll status");
            }

            requireGroupAdmin(groupId, userId);
            JsonArray polls = getPolls(groupId);
            JsonObject poll = findPoll(polls, pollId);
            if (Objects.equals(status, "open")) {
                closeOpenCwlPolls(polls);
            }
            poll.addProperty("status", status);
            if (Objects.equals(status, "closed")) poll.addProperty("closed_at", Instant.now().toString());
            savePolls(groupId, polls);
            utils.sendJsonResponse(ex, poll.toString(), 200);
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

    private String normalizeClanTag(String value) {
        if (value == null) return "";
        String tag = value.trim().toUpperCase();
        if (tag.isBlank()) return "";
        if (!tag.startsWith("#")) tag = "#" + tag;
        return tag;
    }

    private String normalizePlayerTag(String value) {
        return normalizeClanTag(value);
    }

    private JsonArray getPolls(String groupId) throws Exception {
        return getPollsFromGroup(getGroup(groupId));
    }

    private JsonArray getPollsFromGroup(JsonObject group) {
        JsonElement pollsEl = group.get("polls");
        if (pollsEl == null || pollsEl.isJsonNull()) return new JsonArray();
        if (pollsEl.isJsonArray()) return pollsEl.getAsJsonArray();
        return JsonParser.parseString(pollsEl.getAsString()).getAsJsonArray();
    }

    private void savePolls(String groupId, JsonArray polls) throws Exception {
        JsonObject update = new JsonObject();
        update.add("polls", polls);
        SUPABASE_Client.patch("groups", "id=" + SUPABASE_Client.eq(groupId), update.toString());
    }

    private JsonObject findPoll(JsonArray polls, String pollId) throws HttpException {
        for (JsonElement element : polls) {
            JsonObject poll = element.getAsJsonObject();
            JsonElement id = poll.get("id");
            if (id != null && Objects.equals(id.getAsString(), pollId)) return poll;
        }
        throw new HttpException(404, "{\"error\":\"Poll niet gevonden\"}");
    }

    private String sanitizeGroupInfoForGeneralRead(String result) {
        JsonArray groups = JsonParser.parseString(result).getAsJsonArray();
        for (JsonElement groupEl : groups) {
            if (!groupEl.isJsonObject()) continue;
            JsonObject group = groupEl.getAsJsonObject();
            group.add("polls", sanitizePollsForPublicMetadata(getPollsFromGroup(group)));
        }
        return groups.toString();
    }

    private JsonArray sanitizePollsForPublicMetadata(JsonArray polls) {
        JsonArray safePolls = new JsonArray();
        for (JsonElement element : polls) {
            if (!element.isJsonObject()) continue;
            JsonObject poll = element.getAsJsonObject().deepCopy();
            poll.add("answers", new JsonObject());
            safePolls.add(poll);
        }
        return safePolls;
    }

    private void closeOpenCwlPolls(JsonArray polls) {
        for (JsonElement element : polls) {
            if (!element.isJsonObject()) continue;
            JsonObject poll = element.getAsJsonObject();
            if (Objects.equals(readFirstString(poll, "type"), "cwl_availability")
                    && Objects.equals(readFirstString(poll, "status"), "open")) {
                poll.addProperty("status", "closed");
                poll.addProperty("closed_at", Instant.now().toString());
            }
        }
    }

    private JsonArray sanitizePollsForUser(JsonArray polls, String userId, boolean canSeeAllAnswers) {
        JsonArray safePolls = new JsonArray();
        for (JsonElement element : polls) {
            if (!element.isJsonObject()) continue;
            JsonObject copy = element.getAsJsonObject().deepCopy();
            if (!canSeeAllAnswers) {
                JsonObject ownAnswers = new JsonObject();
                if (copy.has("answers") && copy.get("answers").isJsonObject()) {
                    JsonObject answers = copy.getAsJsonObject("answers");
                    JsonElement ownAnswer = answers.get(userId);
                    if (ownAnswer != null && ownAnswer.isJsonObject()) ownAnswers.add(userId, ownAnswer.deepCopy());
                }
                copy.add("answers", ownAnswers);
            }
            safePolls.add(copy);
        }
        return safePolls;
    }

    private JsonArray validatePollAccounts(String userId, JsonArray submittedAccounts) throws Exception {
        Map<String, JsonObject> allowedAccounts = getUserAccountsByTag(userId);
        JsonArray validated = new JsonArray();
        Set<String> usedTags = new HashSet<>();

        for (JsonElement element : submittedAccounts) {
            if (!element.isJsonObject()) throw new IllegalArgumentException("Ongeldig poll account");
            JsonObject submitted = element.getAsJsonObject();
            String tag = normalizePlayerTag(readFirstString(submitted, "tag", "playerTag", "accountTag"));
            if (tag.isBlank() || !allowedAccounts.containsKey(tag)) {
                throw new HttpException(403, "{\"error\":\"Poll bevat een account dat niet bij deze gebruiker hoort\"}");
            }
            if (!usedTags.add(tag)) {
                throw new IllegalArgumentException("Dubbel account in poll antwoord: " + tag);
            }

            JsonObject source = allowedAccounts.get(tag);
            boolean wantsCwl = readBoolean(submitted, "wantsCwl", true);
            JsonObject safe = new JsonObject();
            safe.addProperty("name", fallback(readFirstString(source, "name", "playerName", "accountName"), tag));
            safe.addProperty("tag", tag);
            String townHall = fallback(readFirstString(source, "townHallLevel", "townHall", "townhall", "th"),
                    readFirstString(submitted, "townHall", "townHallLevel"));
            safe.addProperty("townHall", townHall);
            safe.addProperty("wantsCwl", wantsCwl);
            safe.add("days", wantsCwl ? sanitizeDays(submitted.get("days")) : new JsonObject());
            validated.add(safe);
        }

        return validated;
    }

    private Map<String, JsonObject> getUserAccountsByTag(String userId) throws Exception {
        JsonArray users = JsonParser.parseString(
                SUPABASE_Client.getWithBody("users", "id=" + SUPABASE_Client.eq(userId))).getAsJsonArray();
        if (users.isEmpty()) throw new HttpException(404, "{\"error\":\"Gebruiker niet gevonden\"}");

        JsonObject user = users.get(0).getAsJsonObject();
        JsonArray accounts = parseAccounts(user.get("accounts"));
        Map<String, JsonObject> byTag = new HashMap<>();
        for (JsonElement accountEl : accounts) {
            if (!accountEl.isJsonObject()) continue;
            JsonObject account = accountEl.getAsJsonObject();
            String tag = normalizePlayerTag(readFirstString(account, "tag", "playerTag", "accountTag"));
            if (!tag.isBlank()) byTag.put(tag, account);
        }
        return byTag;
    }

    private JsonArray parseAccounts(JsonElement accountsEl) {
        if (accountsEl == null || accountsEl.isJsonNull()) return new JsonArray();
        if (accountsEl.isJsonArray()) return accountsEl.getAsJsonArray();
        if (accountsEl.isJsonPrimitive()) {
            String value = accountsEl.getAsString();
            if (value == null || value.isBlank()) return new JsonArray();
            JsonElement parsed = JsonParser.parseString(value);
            return parsed.isJsonArray() ? parsed.getAsJsonArray() : new JsonArray();
        }
        return new JsonArray();
    }

    private JsonObject sanitizeDays(JsonElement daysEl) {
        JsonObject safeDays = new JsonObject();
        if (daysEl == null || !daysEl.isJsonObject()) return safeDays;
        JsonObject submittedDays = daysEl.getAsJsonObject();
        for (int day = 1; day <= 7; day += 1) {
            String key = String.valueOf(day);
            if (submittedDays.has(key)) safeDays.addProperty(key, readBoolean(submittedDays, key, false));
        }
        return safeDays;
    }

    private String readFirstString(JsonObject object, String... fields) {
        if (object == null) return "";
        for (String field : fields) {
            JsonElement value = object.get(field);
            if (value != null && !value.isJsonNull()) return value.getAsString();
        }
        return "";
    }

    private boolean readBoolean(JsonObject object, String field, boolean defaultValue) {
        if (object == null || !object.has(field) || object.get(field).isJsonNull()) return defaultValue;
        JsonElement value = object.get(field);
        if (value.isJsonPrimitive()) {
            String raw = value.getAsString();
            if (Objects.equals(raw, "true") || Objects.equals(raw, "false")) return Boolean.parseBoolean(raw);
        }
        return defaultValue;
    }

    private String fallback(String first, String second) {
        return first == null || first.isBlank() ? (second == null ? "" : second) : first;
    }

    private String patchMemberRole(String groupId, String userId, String role) throws Exception {
        JsonObject update = new JsonObject();
        update.addProperty("role", normalizeGroupRole(role));
        return SUPABASE_Client.patch("group_members",
                "group_id=" + SUPABASE_Client.eq(groupId) + "&user_id=" + SUPABASE_Client.eq(userId),
                update.toString());
    }

    private String patchGroupOwner(String groupId, String ownerId) throws Exception {
        JsonObject groupUpdate = new JsonObject();
        groupUpdate.addProperty("owner_id", ownerId);
        return SUPABASE_Client.patch("groups", "id=" + SUPABASE_Client.eq(groupId), groupUpdate.toString());
    }

    private void patchGroupBadgeUrlIfMissing(String groupId, JsonObject group, String badgeUrl) throws Exception {
        String currentBadgeUrl = readFirstString(group, "badge_url", "badgeUrl").trim();
        if (!currentBadgeUrl.isBlank() || badgeUrl.isBlank()) return;

        JsonObject update = new JsonObject();
        update.addProperty("badge_url", badgeUrl);
        SUPABASE_Client.patch("groups", "id=" + SUPABASE_Client.eq(groupId), update.toString());
    }

    private String normalizeGroupBadge(String value) {
        String badge = value == null ? "shield" : value.trim().toLowerCase();
        return switch (badge) {
            case "swords", "crown", "war_star", "tower", "flame", "banner", "helmet" -> badge;
            default -> "shield";
        };
    }
}
