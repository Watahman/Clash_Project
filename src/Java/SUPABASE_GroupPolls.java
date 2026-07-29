package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class SUPABASE_GroupPolls {
    private static final int MAX_POLLS_PER_GROUP = 3;
    private final HttpServer server;
    private final Config config;
    private final API_Utils utils;
    private final GroupAccessService access = new GroupAccessService();

    public SUPABASE_GroupPolls(HttpServer server, Config config) {
        this.server = server;
        this.config = config;
        this.utils = new API_Utils(config);
    }

    public void getGroupPolls() {
        server.createContext(config._EXT_SUPA_GROUP_POLLS_GET, exchange -> utils.handlePost(exchange, ex -> {
            String actorId = utils.requireAuthenticatedUser(ex);
            JsonObject request = utils.parseBody(ex);
            String groupId = utils.requireString(request, "groupId");
            access.requireMember(groupId, actorId);
            boolean canAdmin = access.canAdmin(groupId, actorId);

            JsonArray polls = JsonParser.parseString(SUPABASE_Client.getWithBody(
                    "group_polls",
                    "select=id,group_id,creator_id,type,title,status,rounds,deadline,created_at,closed_at,archived_at"
                            + "&group_id=" + SUPABASE_Client.eq(groupId)
                            + "&order=created_at.desc&limit=20"
            )).getAsJsonArray();
            hydratePolls(polls, groupId, actorId, canAdmin);
            utils.sendJsonResponse(ex, polls.toString(), 200);
        }));
    }

    public void createGroupPoll() {
        server.createContext(config._EXT_SUPA_GROUP_POLL_CREATE, exchange -> utils.handlePost(exchange, ex -> {
            String actorId = utils.requireAuthenticatedUser(ex);
            JsonObject request = utils.parseBody(ex);
            String groupId = utils.requireString(request, "groupId");
            String title = utils.requireString(request, "title").trim();
            int rounds = request.has("rounds") ? request.get("rounds").getAsInt() : 7;
            if (title.isBlank() || title.length() > 120) throw new IllegalArgumentException("Ongeldige poll titel");
            if (rounds < 1 || rounds > 7) throw new IllegalArgumentException("Rounds moet tussen 1 en 7 liggen");
            access.requireAdmin(groupId, actorId);
            requirePollCapacity(groupId);

            JsonObject rpcBody = new JsonObject();
            rpcBody.addProperty("p_actor_user_id", actorId);
            rpcBody.addProperty("p_group_id", groupId);
            rpcBody.addProperty("p_title", title);
            rpcBody.addProperty("p_rounds", rounds);
            if (request.has("deadline") && !request.get("deadline").isJsonNull()) {
                rpcBody.addProperty("p_deadline", Instant.parse(request.get("deadline").getAsString()).toString());
            } else {
                rpcBody.add("p_deadline", null);
            }

            String result;
            try {
                result = SUPABASE_Client.rpc("create_group_poll_with_notifications", rpcBody.toString());
            } catch (HttpException conflict) {
                if (conflict.getResponseBody().contains("POLL_LIMIT_REACHED")) {
                    throw pollLimitReached();
                }
                if (conflict.getStatusCode() == 409) {
                    throw new HttpException(409, "{\"error\":\"Er is al een open CWL poll\",\"code\":\"OPEN_POLL_EXISTS\"}");
                }
                throw conflict;
            }
            utils.sendJsonResponse(ex, result, 201);
        }));
    }

    public void answerGroupPoll() {
        server.createContext(config._EXT_SUPA_GROUP_POLL_ANSWER, exchange -> utils.handlePost(exchange, ex -> {
            String actorId = utils.requireAuthenticatedUser(ex);
            JsonObject request = utils.parseBody(ex);
            String groupId = utils.requireString(request, "groupId");
            String pollId = utils.requireString(request, "pollId");
            JsonArray accounts = utils.requireArray(request, "accounts");
            access.requireMember(groupId, actorId);
            requirePollInGroup(pollId, groupId);

            JsonObject rpcBody = new JsonObject();
            rpcBody.addProperty("p_actor_user_id", actorId);
            rpcBody.addProperty("p_poll_id", pollId);
            rpcBody.add("p_accounts", accounts);
            String result = SUPABASE_Client.rpc("submit_group_poll_answer", rpcBody.toString());
            utils.sendJsonResponse(ex, result, 200);
        }));
    }

    public void setGroupPollStatus() {
        server.createContext(config._EXT_SUPA_GROUP_POLL_STATUS, exchange -> utils.handlePost(exchange, ex -> {
            String actorId = utils.requireAuthenticatedUser(ex);
            JsonObject request = utils.parseBody(ex);
            String groupId = utils.requireString(request, "groupId");
            String pollId = utils.requireString(request, "pollId");
            String status = utils.requireString(request, "status").trim().toLowerCase();
            if (!List.of("open", "closed", "archived").contains(status)) {
                throw new IllegalArgumentException("Ongeldige poll status");
            }
            access.requireAdmin(groupId, actorId);
            requirePollInGroup(pollId, groupId);
            if (Objects.equals(status, "open")) {
                JsonArray otherOpen = JsonParser.parseString(SUPABASE_Client.getWithBody(
                        "group_polls",
                        "select=id&group_id=" + SUPABASE_Client.eq(groupId)
                                + "&status=eq.open&id=neq." + pollId + "&limit=1"
                )).getAsJsonArray();
                if (!otherOpen.isEmpty()) {
                    throw new HttpException(409, "{\"error\":\"Er is al een open CWL poll\",\"code\":\"OPEN_POLL_EXISTS\"}");
                }
            }

            JsonObject patch = new JsonObject();
            patch.addProperty("status", status);
            patch.addProperty("updated_at", Instant.now().toString());
            if (Objects.equals(status, "closed")) patch.addProperty("closed_at", Instant.now().toString());
            if (Objects.equals(status, "archived")) patch.addProperty("archived_at", Instant.now().toString());
            String result = SUPABASE_Client.patch(
                    "group_polls",
                    "id=" + SUPABASE_Client.eq(pollId) + "&group_id=" + SUPABASE_Client.eq(groupId),
                    patch.toString()
            );
            utils.sendJsonResponse(ex, result, 200);
        }));
    }

    public void sendPollReminders() {
        server.createContext(config._EXT_SUPA_GROUP_POLL_REMIND, exchange -> utils.handlePost(exchange, ex -> {
            String actorId = utils.requireAuthenticatedUser(ex);
            JsonObject request = utils.parseBody(ex);
            String groupId = utils.requireString(request, "groupId");
            String pollId = utils.requireString(request, "pollId");
            access.requireAdmin(groupId, actorId);
            requirePollInGroup(pollId, groupId);

            JsonObject rpcBody = new JsonObject();
            rpcBody.addProperty("p_actor_user_id", actorId);
            rpcBody.addProperty("p_poll_id", pollId);
            String result = SUPABASE_Client.rpc("send_group_poll_reminders", rpcBody.toString());
            utils.sendJsonResponse(ex, result, 200);
        }));
    }

    public void deleteGroupPoll() {
        server.createContext(config._EXT_SUPA_GROUP_POLL_DELETE, exchange -> utils.handlePost(exchange, ex -> {
            String actorId = utils.requireAuthenticatedUser(ex);
            JsonObject request = utils.parseBody(ex);
            String groupId = utils.requireString(request, "groupId");
            String pollId = utils.requireString(request, "pollId");
            access.requireAdmin(groupId, actorId);
            requirePollInGroup(pollId, groupId);

            String result = SUPABASE_Client.deleteColumn(
                    "group_polls",
                    "id=" + SUPABASE_Client.eq(pollId) + "&group_id=" + SUPABASE_Client.eq(groupId)
            );
            utils.sendJsonResponse(ex, result, 200);
        }));
    }

    private void hydratePolls(JsonArray polls, String groupId, String actorId, boolean canAdmin) throws Exception {
        List<String> pollIds = strings(polls, "id");
        if (pollIds.isEmpty()) return;
        String answerFilter = "poll_id=" + SUPABASE_Client.in(pollIds);
        if (!canAdmin) answerFilter += "&user_id=" + SUPABASE_Client.eq(actorId);
        JsonArray answers = JsonParser.parseString(SUPABASE_Client.getWithBody(
                "group_poll_answers",
                "select=id,poll_id,user_id,updated_at&" + answerFilter
        )).getAsJsonArray();
        List<String> answerIds = strings(answers, "id");
        JsonArray accountAnswers = answerIds.isEmpty() ? new JsonArray() : JsonParser.parseString(
                SUPABASE_Client.getWithBody(
                        "group_poll_account_answers",
                        "select=id,answer_id,user_account_id,wants_cwl&answer_id=" + SUPABASE_Client.in(answerIds)
                )
        ).getAsJsonArray();
        List<String> accountAnswerIds = strings(accountAnswers, "id");
        List<String> userAccountIds = strings(accountAnswers, "user_account_id");
        JsonArray dayAnswers = accountAnswerIds.isEmpty() ? new JsonArray() : JsonParser.parseString(
                SUPABASE_Client.getWithBody(
                        "group_poll_day_answers",
                        "select=account_answer_id,round,available&account_answer_id=" + SUPABASE_Client.in(accountAnswerIds)
                )
        ).getAsJsonArray();
        JsonArray userAccounts = userAccountIds.isEmpty() ? new JsonArray() : JsonParser.parseString(
                SUPABASE_Client.getWithBody(
                        "user_accounts",
                        "select=id,player_tag,player_name,town_hall_level&id=" + SUPABASE_Client.in(userAccountIds)
                )
        ).getAsJsonArray();

        Map<String, JsonObject> userAccountsById = objectsBy(userAccounts, "id");
        Map<String, JsonObject> daysByAccountAnswer = new HashMap<>();
        for (JsonElement element : dayAnswers) {
            JsonObject day = element.getAsJsonObject();
            String accountAnswerId = day.get("account_answer_id").getAsString();
            daysByAccountAnswer.computeIfAbsent(accountAnswerId, ignored -> new JsonObject())
                    .addProperty(Integer.toString(day.get("round").getAsInt()), day.get("available").getAsBoolean());
        }
        Map<String, JsonArray> accountsByAnswer = new HashMap<>();
        for (JsonElement element : accountAnswers) {
            JsonObject row = element.getAsJsonObject();
            String answerId = row.get("answer_id").getAsString();
            JsonObject account = userAccountsById.get(row.get("user_account_id").getAsString());
            if (account == null) continue;
            JsonObject response = new JsonObject();
            response.addProperty("tag", account.get("player_tag").getAsString());
            response.addProperty("name", nullableString(account, "player_name"));
            if (account.has("town_hall_level") && !account.get("town_hall_level").isJsonNull()) {
                response.addProperty("townHall", account.get("town_hall_level").getAsInt());
            }
            response.addProperty("wantsCwl", row.get("wants_cwl").getAsBoolean());
            response.add("days", daysByAccountAnswer.getOrDefault(row.get("id").getAsString(), new JsonObject()));
            accountsByAnswer.computeIfAbsent(answerId, ignored -> new JsonArray()).add(response);
        }
        Map<String, JsonObject> answersByPoll = new HashMap<>();
        for (JsonElement element : answers) {
            JsonObject row = element.getAsJsonObject();
            JsonObject response = new JsonObject();
            response.addProperty("user_id", row.get("user_id").getAsString());
            response.addProperty("updated_at", row.get("updated_at").getAsString());
            response.add("accounts", accountsByAnswer.getOrDefault(row.get("id").getAsString(), new JsonArray()));
            answersByPoll.computeIfAbsent(row.get("poll_id").getAsString(), ignored -> new JsonObject())
                    .add(row.get("user_id").getAsString(), response);
        }
        JsonArray members = canAdmin ? loadMemberProfiles(groupId) : null;
        for (JsonElement element : polls) {
            JsonObject poll = element.getAsJsonObject();
            poll.add("answers", answersByPoll.getOrDefault(poll.get("id").getAsString(), new JsonObject()));
            if (members != null) poll.add("members", members.deepCopy());
        }
    }

    private JsonArray loadMemberProfiles(String groupId) throws Exception {
        JsonArray memberships = JsonParser.parseString(SUPABASE_Client.getWithBody(
                "group_members",
                "select=user_id,role&group_id=" + SUPABASE_Client.eq(groupId)
        )).getAsJsonArray();
        List<String> userIds = strings(memberships, "user_id");
        Map<String, JsonObject> profiles = userIds.isEmpty() ? Map.of() : objectsBy(
                JsonParser.parseString(SUPABASE_Client.getWithBody(
                        "users",
                        "select=id,name&id=" + SUPABASE_Client.in(userIds)
                )).getAsJsonArray(),
                "id"
        );
        for (JsonElement element : memberships) {
            JsonObject member = element.getAsJsonObject();
            JsonObject profile = profiles.get(member.get("user_id").getAsString());
            member.addProperty("name", profile == null ? "" : nullableString(profile, "name"));
        }
        return memberships;
    }

    private void requirePollInGroup(String pollId, String groupId) throws Exception {
        JsonArray rows = JsonParser.parseString(SUPABASE_Client.getWithBody(
                "group_polls",
                "select=id&id=" + SUPABASE_Client.eq(pollId)
                        + "&group_id=" + SUPABASE_Client.eq(groupId)
                        + "&limit=1"
        )).getAsJsonArray();
        if (rows.isEmpty()) throw new HttpException(404, "{\"error\":\"Poll niet gevonden\"}");
    }

    private void requirePollCapacity(String groupId) throws Exception {
        JsonArray rows = JsonParser.parseString(SUPABASE_Client.getWithBody(
                "group_polls",
                "select=id&group_id=" + SUPABASE_Client.eq(groupId)
                        + "&limit=" + MAX_POLLS_PER_GROUP
        )).getAsJsonArray();
        if (rows.size() >= MAX_POLLS_PER_GROUP) throw pollLimitReached();
    }

    private HttpException pollLimitReached() {
        return new HttpException(
                409,
                "{\"error\":\"Een Clan Family kan maximaal 3 polls hebben\",\"code\":\"POLL_LIMIT_REACHED\"}"
        );
    }

    private List<String> strings(JsonArray rows, String field) {
        List<String> values = new ArrayList<>();
        for (JsonElement element : rows) {
            JsonElement value = element.getAsJsonObject().get(field);
            if (value != null && !value.isJsonNull()) values.add(value.getAsString());
        }
        return values;
    }

    private Map<String, JsonObject> objectsBy(JsonArray rows, String field) {
        Map<String, JsonObject> values = new LinkedHashMap<>();
        for (JsonElement element : rows) {
            JsonObject object = element.getAsJsonObject();
            if (object.has(field) && !object.get(field).isJsonNull()) {
                values.put(object.get(field).getAsString(), object);
            }
        }
        return values;
    }

    private String nullableString(JsonObject object, String field) {
        JsonElement value = object.get(field);
        return value == null || value.isJsonNull() ? "" : value.getAsString();
    }
}
