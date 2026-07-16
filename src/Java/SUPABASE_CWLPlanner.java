package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public class SUPABASE_CWLPlanner {
    private final HttpServer server;
    private final Config conf;
    private final API_Utils utils;

    public SUPABASE_CWLPlanner(HttpServer server, Config conf){
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    public void saveCWLPlanner() {
        server.createContext(conf._EXT_SUPA_CWLPLANNER_DATA_SET, exchange -> utils.handlePost(exchange, ex -> {
            String userId    = utils.requireAuthenticatedUser(ex);
            JsonObject json  = utils.parseBody(ex);
            String planName  = utils.requireString(json, "name");
            JsonElement planInfo = json.get("planInfo");
            if (planInfo == null || planInfo.isJsonNull() || (!planInfo.isJsonArray() && !planInfo.isJsonObject())) {
                throw new IllegalArgumentException("planInfo moet een object of legacy array zijn");
            }
            planName = planName.trim();
            if (planName.isBlank() || planName.length() > 40) {
                throw new IllegalArgumentException("Plan naam moet tussen 1 en 40 tekens bevatten");
            }

            JsonElement planIdEl = json.get("planId");
            String plannerId     = (planIdEl != null && !planIdEl.isJsonNull()) ? planIdEl.getAsString() : "";

            String planId;

            if (!plannerId.isEmpty() && !plannerId.equals("undefined") && !plannerId.equals("null")) {
                requirePlanAccess(plannerId, userId);
                JsonArray currentRows = JsonParser.parseString(SUPABASE_Client.getWithBody(
                        "plans",
                        "select=id,revision&id=" + SUPABASE_Client.eq(plannerId)
                )).getAsJsonArray();
                if (currentRows.isEmpty()) {
                    throw new HttpException(404, "{\"error\":\"Plan niet gevonden\"}");
                }
                long currentRevision = currentRows.get(0).getAsJsonObject().has("revision")
                        ? currentRows.get(0).getAsJsonObject().get("revision").getAsLong()
                        : 1L;
                JsonElement expectedRevisionElement = json.get("revision");
                if (expectedRevisionElement != null && !expectedRevisionElement.isJsonNull()) {
                    long expectedRevision = expectedRevisionElement.getAsLong();
                    if (expectedRevision != currentRevision) {
                        throw new HttpException(409, "{\"error\":\"Plan is intussen gewijzigd\",\"code\":\"PLAN_REVISION_CONFLICT\"}");
                    }
                }

                JsonObject editPlan = new JsonObject();
                editPlan.add("info", planInfo);
                editPlan.addProperty("name", planName);
                editPlan.addProperty("revision", currentRevision + 1);
                editPlan.addProperty("updated_at", java.time.Instant.now().toString());

                JsonArray planArray = JsonParser.parseString(
                        SUPABASE_Client.patch(
                                "plans",
                                "id=" + SUPABASE_Client.eq(plannerId)
                                        + "&revision=" + SUPABASE_Client.eq(Long.toString(currentRevision)),
                                editPlan.toString()
                        )).getAsJsonArray();

                if (planArray.isEmpty()) {
                    throw new HttpException(409, "{\"error\":\"Plan is intussen gewijzigd\",\"code\":\"PLAN_REVISION_CONFLICT\"}");
                }

                planId = planArray.get(0).getAsJsonObject().get("id").getAsString();
                long savedRevision = planArray.get(0).getAsJsonObject().get("revision").getAsLong();
                utils.sendJsonResponse(ex,
                        "{\"success\":true,\"uuid\":\"" + planId + "\",\"revision\":" + savedRevision + "}",
                        200);
                return;
            } else {
                JsonObject plan = new JsonObject();
                plan.addProperty("name",     planName);
                plan.add("info",             planInfo);
                plan.addProperty("owner_id", userId);
                plan.addProperty("revision", 1);

                JsonArray planArray = JsonParser.parseString(
                        SUPABASE_Client.post("plans", plan.toString())).getAsJsonArray();

                if (planArray.isEmpty()) {
                    utils.sendJsonResponse(ex, "{\"error\":\"Plan aanmaken mislukt\"}", 500);
                    return;
                }

                planId = planArray.get(0).getAsJsonObject().get("id").getAsString();

                JsonObject link = new JsonObject();
                link.addProperty("plan_id", planId);
                link.addProperty("user_id", userId);
                SUPABASE_Client.post("plan_users", link.toString());
            }

            utils.sendJsonResponse(ex, "{\"success\":true,\"uuid\":\"" + planId + "\",\"revision\":1}", 200);
        }));
    }

    public void getAllPlanners() {
        server.createContext(conf._EXT_SUPA_CWLPLANNER_DATA_GET_ALL, exchange -> utils.handlePost(exchange, ex -> {
            String userId = utils.requireAuthenticatedUser(ex);
            utils.parseBody(ex);

            JsonArray userPlanIds = JsonParser.parseString(
                    SUPABASE_Client.getWithBody("plan_users", "select=plan_id&user_id=" + SUPABASE_Client.eq(userId))).getAsJsonArray();

            JsonArray plansResponse = new JsonArray();
            List<String> planIds = new ArrayList<>();
            for (JsonElement element : userPlanIds) {
                planIds.add(element.getAsJsonObject().get("plan_id").getAsString());
            }
            if (!planIds.isEmpty()) {
                JsonArray plans = JsonParser.parseString(SUPABASE_Client.getWithBody(
                        "plans",
                        "select=id,name,info,revision,owner_id,updated_at&id=" + SUPABASE_Client.in(planIds)
                                + "&order=updated_at.desc"
                )).getAsJsonArray();
                for (JsonElement element : plans) {
                    JsonObject plan = element.getAsJsonObject();
                    JsonObject option = new JsonObject();
                    option.addProperty("id", plan.get("id").getAsString());
                    option.addProperty("name", plan.get("name").getAsString());
                    if (plan.has("info") && plan.get("info").isJsonArray()) {
                        option.add("info", plan.get("info"));
                    } else if (plan.has("info") && plan.get("info").isJsonObject()) {
                        option.add("info", plan.get("info"));
                    }
                    if (plan.has("revision")) option.addProperty("revision", plan.get("revision").getAsLong());
                    if (plan.has("updated_at")) option.add("updatedAt", plan.get("updated_at"));
                    option.addProperty("isOwner",
                            plan.has("owner_id") && !plan.get("owner_id").isJsonNull()
                                    && userId.equals(plan.get("owner_id").getAsString()));
                    plansResponse.add(option);
                }
            }

            utils.sendJsonResponse(ex, plansResponse.toString(), 200);
        }));
    }

    public void getPlanner() {
        server.createContext(conf._EXT_SUPA_CWLPLANNER_DATA_GET, exchange -> utils.handlePost(exchange, ex -> {
            String userId = utils.requireAuthenticatedUser(ex);
            JsonObject json = utils.parseBody(ex);
            JsonElement planIdEl = json.get("planId");
            JsonElement nameEl = json.get("name");

            JsonArray planArray;
            if (planIdEl != null && !planIdEl.isJsonNull() && !planIdEl.getAsString().isBlank()) {
                String planId = planIdEl.getAsString();
                requirePlanAccess(planId, userId);
                planArray = JsonParser.parseString(
                        SUPABASE_Client.getWithBody("plans", "id=" + SUPABASE_Client.eq(planId))).getAsJsonArray();
            } else if (nameEl != null && !nameEl.isJsonNull()) {
                String name = nameEl.getAsString();
                planArray = JsonParser.parseString(
                        SUPABASE_Client.getWithBody("plans",
                                "name=" + SUPABASE_Client.eq(name) + "&owner_id=" + SUPABASE_Client.eq(userId))).getAsJsonArray();
            } else {
                throw new IllegalArgumentException("planId ontbreekt");
            }

            if (planArray.isEmpty()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Plan niet gevonden\"}", 404);
                return;
            }

            JsonObject plan     = planArray.get(0).getAsJsonObject();
            JsonObject planInfo = new JsonObject();
            planInfo.addProperty("name", plan.get("name").getAsString());
            planInfo.add("info",         plan.get("info"));
            planInfo.addProperty("id",   plan.get("id").getAsString());
            if (plan.has("revision")) planInfo.addProperty("revision", plan.get("revision").getAsLong());

            utils.sendJsonResponse(ex, planInfo.toString(), 200);
        }));
    }

    public void renamePlanner() {
        server.createContext(conf._EXT_SUPA_CWLPLANNER_RENAME, exchange -> utils.handlePost(exchange, ex -> {
            String userId = utils.requireAuthenticatedUser(ex);
            JsonObject json = utils.parseBody(ex);
            String planId = utils.requireString(json, "planId");
            String name = validatedName(utils.requireString(json, "name"));
            requirePlanOwner(planId, userId);

            JsonObject patch = new JsonObject();
            patch.addProperty("name", name);
            patch.addProperty("updated_at", Instant.now().toString());
            JsonArray result = JsonParser.parseString(SUPABASE_Client.patch(
                    "plans",
                    "id=" + SUPABASE_Client.eq(planId) + "&owner_id=" + SUPABASE_Client.eq(userId),
                    patch.toString()
            )).getAsJsonArray();
            if (result.isEmpty()) throw new HttpException(404, "{\"error\":\"Plan niet gevonden\"}");
            utils.sendJsonResponse(ex, "{\"success\":true}", 200);
        }));
    }

    public void copyPlanner() {
        server.createContext(conf._EXT_SUPA_CWLPLANNER_COPY, exchange -> utils.handlePost(exchange, ex -> {
            String userId = utils.requireAuthenticatedUser(ex);
            JsonObject json = utils.parseBody(ex);
            String planId = utils.requireString(json, "planId");
            requirePlanAccess(planId, userId);

            JsonArray sourceRows = JsonParser.parseString(SUPABASE_Client.getWithBody(
                    "plans",
                    "select=name,info&id=" + SUPABASE_Client.eq(planId)
            )).getAsJsonArray();
            if (sourceRows.isEmpty()) throw new HttpException(404, "{\"error\":\"Plan niet gevonden\"}");
            JsonObject source = sourceRows.get(0).getAsJsonObject();
            String requestedName = json.has("name") && !json.get("name").isJsonNull()
                    ? json.get("name").getAsString()
                    : source.get("name").getAsString() + " (kopie)";

            JsonObject copy = new JsonObject();
            copy.addProperty("name", validatedName(requestedName));
            copy.add("info", source.get("info").deepCopy());
            copy.addProperty("owner_id", userId);
            copy.addProperty("revision", 1);
            JsonArray result = JsonParser.parseString(SUPABASE_Client.post("plans", copy.toString())).getAsJsonArray();
            if (result.isEmpty()) throw new HttpException(500, "{\"error\":\"Plan kopieren mislukt\"}");
            String copiedPlanId = result.get(0).getAsJsonObject().get("id").getAsString();

            JsonObject link = new JsonObject();
            link.addProperty("plan_id", copiedPlanId);
            link.addProperty("user_id", userId);
            SUPABASE_Client.post("plan_users", link.toString());
            utils.sendJsonResponse(ex, "{\"success\":true,\"uuid\":\"" + copiedPlanId + "\"}", 201);
        }));
    }

    public void deletePlanner() {
        server.createContext(conf._EXT_SUPA_CWLPLANNER_DELETE, exchange -> utils.handlePost(exchange, ex -> {
            String userId = utils.requireAuthenticatedUser(ex);
            JsonObject json = utils.parseBody(ex);
            String planId = utils.requireString(json, "planId");
            requirePlanOwner(planId, userId);
            SUPABASE_Client.deleteColumn(
                    "plans",
                    "id=" + SUPABASE_Client.eq(planId) + "&owner_id=" + SUPABASE_Client.eq(userId)
            );
            utils.sendJsonResponse(ex, "{\"success\":true}", 200);
        }));
    }

    private String validatedName(String name) {
        String trimmed = name.trim();
        if (trimmed.isBlank() || trimmed.length() > 40) {
            throw new IllegalArgumentException("Plan naam moet tussen 1 en 40 tekens bevatten");
        }
        return trimmed;
    }

    private void requirePlanOwner(String planId, String userId) throws Exception {
        JsonArray plans = JsonParser.parseString(SUPABASE_Client.getWithBody(
                "plans",
                "select=id&id=" + SUPABASE_Client.eq(planId) + "&owner_id=" + SUPABASE_Client.eq(userId)
        )).getAsJsonArray();
        if (plans.isEmpty()) {
            throw new HttpException(403, "{\"error\":\"Alleen de eigenaar kan dit plan wijzigen\"}");
        }
    }

    private void requirePlanAccess(String planId, String userId) throws Exception {
        JsonArray plans = JsonParser.parseString(SUPABASE_Client.getWithBody(
                "plans",
                "select=id,owner_id&id=" + SUPABASE_Client.eq(planId)
        )).getAsJsonArray();
        if (plans.isEmpty()) {
            throw new HttpException(404, "{\"error\":\"Plan niet gevonden\"}");
        }
        JsonElement owner = plans.get(0).getAsJsonObject().get("owner_id");
        if (owner != null && !owner.isJsonNull() && userId.equals(owner.getAsString())) return;

        JsonArray membership = JsonParser.parseString(SUPABASE_Client.getWithBody(
                "plan_users",
                "select=plan_id&plan_id=" + SUPABASE_Client.eq(planId) + "&user_id=" + SUPABASE_Client.eq(userId)
        )).getAsJsonArray();
        if (membership.isEmpty()) {
            throw new HttpException(403, "{\"error\":\"Geen toegang tot dit plan\"}");
        }
    }
}
