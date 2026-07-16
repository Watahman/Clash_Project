package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;

import java.time.Instant;

public final class SUPABASE_Notifications {
    private final HttpServer server;
    private final Config config;
    private final API_Utils utils;

    public SUPABASE_Notifications(HttpServer server, Config config) {
        this.server = server;
        this.config = config;
        this.utils = new API_Utils(config);
    }

    public void getNotifications() {
        server.createContext(config._EXT_SUPA_NOTIFICATIONS_GET, exchange -> utils.handlePost(exchange, ex -> {
            String actorId = utils.requireAuthenticatedUser(ex);
            utils.parseBody(ex);
            JsonArray notifications = JsonParser.parseString(SUPABASE_Client.getWithBody(
                    "notifications",
                    "select=id,type,title,body,payload,related_group_id,related_poll_id,read_at,created_at"
                            + "&recipient_id=" + SUPABASE_Client.eq(actorId)
                            + "&order=created_at.desc&limit=50"
            )).getAsJsonArray();
            long unread = 0;
            for (var notification : notifications) {
                if (!notification.getAsJsonObject().has("read_at")
                        || notification.getAsJsonObject().get("read_at").isJsonNull()) unread++;
            }
            JsonObject response = new JsonObject();
            response.addProperty("unread", unread);
            response.add("items", notifications);
            utils.sendJsonResponse(ex, response.toString(), 200);
        }));
    }

    public void markNotificationRead() {
        server.createContext(config._EXT_SUPA_NOTIFICATION_READ, exchange -> utils.handlePost(exchange, ex -> {
            String actorId = utils.requireAuthenticatedUser(ex);
            JsonObject request = utils.parseBody(ex);
            String notificationId = utils.requireString(request, "notificationId");
            JsonObject patch = new JsonObject();
            patch.addProperty("read_at", Instant.now().toString());
            String result = SUPABASE_Client.patch(
                    "notifications",
                    "id=" + SUPABASE_Client.eq(notificationId)
                            + "&recipient_id=" + SUPABASE_Client.eq(actorId),
                    patch.toString()
            );
            JsonArray rows = result.isBlank() ? new JsonArray() : JsonParser.parseString(result).getAsJsonArray();
            if (rows.isEmpty()) throw new HttpException(404, "{\"error\":\"Notificatie niet gevonden\"}");
            utils.sendJsonResponse(ex, rows.get(0).toString(), 200);
        }));
    }
}
