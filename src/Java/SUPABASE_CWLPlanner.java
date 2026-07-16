package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;

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
            JsonArray clans  = utils.requireArray(json, "planInfo");
            planName = planName.trim();
            if (planName.isBlank() || planName.length() > 40) {
                throw new IllegalArgumentException("Plan naam moet tussen 1 en 40 tekens bevatten");
            }

            JsonElement planIdEl = json.get("planId");
            String plannerId     = (planIdEl != null && !planIdEl.isJsonNull()) ? planIdEl.getAsString() : "";

            String planId;

            if (!plannerId.isEmpty() && !plannerId.equals("undefined") && !plannerId.equals("null")) {
                requirePlanAccess(plannerId, userId);

                JsonObject editPlan = new JsonObject();
                editPlan.add("info", clans);
                editPlan.addProperty("name", planName);

                JsonArray planArray = JsonParser.parseString(
                        SUPABASE_Client.patch("plans", "id=" + SUPABASE_Client.eq(plannerId), editPlan.toString())).getAsJsonArray();

                if (planArray.isEmpty()) {
                    utils.sendJsonResponse(ex, "{\"error\":\"Plan updaten mislukt\"}", 500);
                    return;
                }

                planId = planArray.get(0).getAsJsonObject().get("id").getAsString();
            } else {
                JsonObject plan = new JsonObject();
                plan.addProperty("name",     planName);
                plan.add("info",             clans);
                plan.addProperty("owner_id", userId);

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

            utils.sendJsonResponse(ex, "{\"success\":true,\"uuid\":\"" + planId + "\"}", 200);
        }));
    }

    public void getAllPlanners() {
        server.createContext(conf._EXT_SUPA_CWLPLANNER_DATA_GET_ALL, exchange -> utils.handlePost(exchange, ex -> {
            String userId = utils.requireAuthenticatedUser(ex);
            utils.parseBody(ex);

            JsonArray userPlanIds = JsonParser.parseString(
                    SUPABASE_Client.getWithBody("plan_users", "select=plan_id&user_id=" + SUPABASE_Client.eq(userId))).getAsJsonArray();

            JsonArray plansResponse = new JsonArray();
            for (JsonElement element : userPlanIds) {
                String planId   = element.getAsJsonObject().get("plan_id").getAsString();
                JsonArray plans = JsonParser.parseString(
                        SUPABASE_Client.getWithBody("plans", "select=id,name,info&id=" + SUPABASE_Client.eq(planId))).getAsJsonArray();

                if (!plans.isEmpty()) {
                    JsonObject plan = plans.get(0).getAsJsonObject();
                    JsonObject option = new JsonObject();
                    option.addProperty("id", plan.get("id").getAsString());
                    option.addProperty("name", plan.get("name").getAsString());
                    if (plan.has("info") && plan.get("info").isJsonArray()) {
                        option.add("info", plan.get("info").getAsJsonArray());
                    }
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
            planInfo.add("info",         plan.get("info").getAsJsonArray());
            planInfo.addProperty("id",   plan.get("id").getAsString());

            utils.sendJsonResponse(ex, planInfo.toString(), 200);
        }));
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
