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

    public void saveCWLPlanner(){
        server.createContext(conf._EXT_SUPA_CWLPLANNER_DATA_SET, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String body = new String(exchange.getRequestBody().readAllBytes());

                    if (body.isBlank()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Request body is leeg\"}", 400);
                        return;
                    }

                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();

                    JsonElement idEl        = json.get("id");
                    JsonElement planIdEl    = json.get("currentPlanId");
                    JsonElement nameEl      = json.get("name");
                    JsonElement clansEl     = json.get("clans");

                    if (idEl == null || nameEl == null || clansEl == null) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplichte velden ontbreken: id, name, clans\"}", 400);
                        return;
                    }

                    String userId   = idEl.getAsString();
                    String planName = nameEl.getAsString();
                    JsonArray clans = clansEl.getAsJsonArray();
                    String plannerId = (planIdEl != null && !planIdEl.isJsonNull()) ? planIdEl.getAsString() : "";

                    JsonObject plan = new JsonObject();
                    plan.addProperty("name", planName);
                    plan.add("info", clans);
                    plan.addProperty("owner_id", userId);

                    String planId = "";

                    if (!plannerId.isEmpty() && !plannerId.equals("undefined")) {
                        String planExists = SUPABASE_Client.getWithBody("plans", "id=eq." + plannerId);
                        JsonElement planExistsElement = JsonParser.parseString(planExists);

                        if (planExistsElement.isJsonArray() && !planExistsElement.getAsJsonArray().isEmpty()) {
                            JsonObject editPlan = new JsonObject();
                            editPlan.add("info", clans);
                            editPlan.addProperty("name", planName);
                            String planResult = SUPABASE_Client.patch("plans", "id=eq." + plannerId, editPlan.toString());

                            JsonArray planArray = JsonParser.parseString(planResult).getAsJsonArray();
                            if (planArray.isEmpty()) {
                                utils.sendJsonResponse(exchange, "{\"error\":\"Plan updaten mislukt\"}", 500);
                                return;
                            }
                            planId = planArray.get(0).getAsJsonObject().get("id").getAsString();
                        } else {
                            utils.sendJsonResponse(exchange, "{\"error\":\"Plan niet gevonden met id: " + plannerId + "\"}", 404);
                            return;
                        }
                    } else {
                        String planResult = SUPABASE_Client.post("plans", plan.toString());
                        JsonArray planArray = JsonParser.parseString(planResult).getAsJsonArray();

                        if (planArray.isEmpty()) {
                            utils.sendJsonResponse(exchange, "{\"error\":\"Plan aanmaken mislukt\"}", 500);
                            return;
                        }

                        planId = planArray.get(0).getAsJsonObject().get("id").getAsString();

                        JsonObject link = new JsonObject();
                        link.addProperty("plan_id", planId);
                        link.addProperty("user_id", userId);
                        SUPABASE_Client.post("plan_users", link.toString());
                    }

                    utils.sendJsonResponse(exchange, "{\"success\":true, \"uuid\": \"" + planId + "\"}", 200);

                } catch (IllegalStateException | ClassCastException e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Ongeldige JSON structuur\"}", 400);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Opslaan mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }

    public void getAllPlanners(){
        server.createContext(conf._EXT_SUPA_CWLPLANNER_DATA_GET_ALL, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String body = new String(exchange.getRequestBody().readAllBytes());

                    if (body.isBlank()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Request body is leeg\"}", 400);
                        return;
                    }

                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();
                    JsonElement userEl = json.get("user");

                    if (userEl == null || userEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplicht veld ontbreekt: user\"}", 400);
                        return;
                    }

                    String userId = userEl.getAsString();
                    String userPlanIds = SUPABASE_Client.getWithBody("plan_users", "select=plan_id&user_id=eq." + userId);

                    JsonArray userPlanIdArray = JsonParser.parseString(userPlanIds).getAsJsonArray();
                    JsonArray planNames = new JsonArray();

                    for (JsonElement element : userPlanIdArray) {
                        String planId = element.getAsJsonObject().get("plan_id").getAsString();
                        String planResult = SUPABASE_Client.getWithBody("plans", "select=name&id=eq." + planId);

                        JsonArray planArray = JsonParser.parseString(planResult).getAsJsonArray();
                        if (!planArray.isEmpty()) {
                            String name = planArray.get(0).getAsJsonObject().get("name").getAsString();
                            planNames.add(name);
                        }
                    }

                    utils.sendJsonResponse(exchange, String.valueOf(planNames), 200);

                } catch (IllegalStateException | ClassCastException e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Ongeldige JSON structuur\"}", 400);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Ophalen planners mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }

    public void getPlanner(){
        server.createContext(conf._EXT_SUPA_CWLPLANNER_DATA_GET, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String body = new String(exchange.getRequestBody().readAllBytes());

                    if (body.isBlank()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Request body is leeg\"}", 400);
                        return;
                    }

                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();
                    JsonElement nameEl = json.get("name");

                    if (nameEl == null || nameEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplicht veld ontbreekt: name\"}", 400);
                        return;
                    }

                    String name = nameEl.getAsString();
                    String result = SUPABASE_Client.getWithBody("plans", "name=eq." + name);
                    JsonArray planArray = JsonParser.parseString(result).getAsJsonArray();

                    if (planArray.isEmpty()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Plan niet gevonden: " + name + "\"}", 404);
                        return;
                    }

                    JsonObject plan = planArray.get(0).getAsJsonObject();

                    JsonObject planInfo = new JsonObject();
                    planInfo.addProperty("name", plan.get("name").getAsString());
                    planInfo.add("info", plan.get("info").getAsJsonArray());
                    planInfo.addProperty("id", plan.get("id").getAsString());

                    utils.sendJsonResponse(exchange, planInfo.toString(), 200);

                } catch (IllegalStateException | ClassCastException e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Ongeldige JSON structuur\"}", 400);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Ophalen planner mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }
}