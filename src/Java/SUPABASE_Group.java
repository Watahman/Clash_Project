package Java;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;

public class SUPABASE_Group {
    private HttpServer server;
    private Config conf;
    private final API_Utils utils;

    public SUPABASE_Group(HttpServer server, Config conf){
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    public void createGroup(){
        server.createContext(conf._EXT_SUPA_GROUP_MAKE, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String body = new String(exchange.getRequestBody().readAllBytes());
                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();

                    String naam = json.get("name").getAsString();
                    String ownerId = json.get("ownerId").getAsString();
                    String code = API_Utils.generateCode();

                    JsonObject group = new JsonObject();
                    group.addProperty("name", naam);
                    group.addProperty("owner_id", ownerId);
                    group.addProperty("code", code);

                    // opslaan in Supabase
                    String result = SUPABASE_Client.post("groups", group.toString());
                    System.out.println(result);
                    utils.sendJsonResponse(exchange, result, 201);
                } catch (Exception e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"failed\"}", 500);
                    } catch (Exception ex) {
                        throw new RuntimeException(ex);
                    }
                }
            }
        });
    }
}
