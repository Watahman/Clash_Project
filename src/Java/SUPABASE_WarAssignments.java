package Java;

import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpServer;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

public final class SUPABASE_WarAssignments {
    private static final Pattern CLASH_TAG =
            Pattern.compile("^#[0289PYLQGRJCUV]{3,15}$");
    private static final List<String> TYPES =
            List.of("base", "cleanup", "hold", "free");

    private final HttpServer server;
    private final Config config;
    private final API_Utils utils;

    public SUPABASE_WarAssignments(HttpServer server, Config config) {
        this.server = server;
        this.config = config;
        this.utils = new API_Utils(config);
    }

    public void getAssignments() {
        server.createContext(config._EXT_SUPA_WAR_ASSIGNMENTS_GET,
                exchange -> utils.handlePost(exchange, ex -> {
                    String actorId = utils.requireAuthenticatedUser(ex);
                    JsonObject request = utils.parseBody(ex);
                    String clanTag = requireTag(request, "clanTag");
                    String warKey = requireWarKey(request);
                    String result = SUPABASE_Client.getWithBody(
                            "regular_war_assignments",
                            "select=id,clan_tag,war_key,player_tag,attack_slot,"
                                    + "assignment_type,target_position,updated_at"
                                    + "&user_id=" + SUPABASE_Client.eq(actorId)
                                    + "&clan_tag=" + SUPABASE_Client.eq(clanTag)
                                    + "&war_key=" + SUPABASE_Client.eq(warKey)
                                    + "&order=attack_slot.asc"
                    );
                    utils.sendJsonResponse(ex, result, 200);
                }));
    }

    public void saveAssignment() {
        server.createContext(config._EXT_SUPA_WAR_ASSIGNMENT_SAVE,
                exchange -> utils.handlePost(exchange, ex -> {
                    String actorId = utils.requireAuthenticatedUser(ex);
                    JsonObject request = utils.parseBody(ex);
                    String clanTag = requireTag(request, "clanTag");
                    String warKey = requireWarKey(request);
                    String playerTag = requireTag(request, "playerTag");
                    String type = utils.requireString(request, "type").trim().toLowerCase();
                    if (!TYPES.contains(type)) {
                        throw new IllegalArgumentException("Ongeldig assignmenttype");
                    }
                    int attackSlot = request.get("attackSlot").getAsInt();
                    if (attackSlot < 1 || attackSlot > 2) {
                        throw new IllegalArgumentException("Ongeldige aanvalsslot");
                    }
                    Integer targetPosition = null;
                    if (List.of("base", "cleanup").contains(type)) {
                        if (!request.has("targetPosition")) {
                            throw new IllegalArgumentException("Doelpositie ontbreekt");
                        }
                        targetPosition = request.get("targetPosition").getAsInt();
                        if (targetPosition < 1 || targetPosition > 50) {
                            throw new IllegalArgumentException("Ongeldige doelpositie");
                        }
                    }

                    JsonObject row = new JsonObject();
                    row.addProperty("id", UUID.randomUUID().toString());
                    row.addProperty("user_id", actorId);
                    row.addProperty("clan_tag", clanTag);
                    row.addProperty("war_key", warKey);
                    row.addProperty("player_tag", playerTag);
                    row.addProperty("attack_slot", attackSlot);
                    row.addProperty("assignment_type", type);
                    if (targetPosition == null) row.add("target_position", null);
                    else row.addProperty("target_position", targetPosition);
                    row.addProperty("updated_at", Instant.now().toString());

                    SUPABASE_Client.upsert(
                            "regular_war_assignments",
                            "user_id,clan_tag,war_key,player_tag,attack_slot",
                            row.toString()
                    );
                    utils.sendJsonResponse(ex, frontendRow(row).toString(), 200);
                }));
    }

    public void deleteAssignment() {
        server.createContext(config._EXT_SUPA_WAR_ASSIGNMENT_DELETE,
                exchange -> utils.handlePost(exchange, ex -> {
                    String actorId = utils.requireAuthenticatedUser(ex);
                    JsonObject request = utils.parseBody(ex);
                    String assignmentId = utils.requireString(request, "assignmentId");
                    UUID.fromString(assignmentId);
                    String result = SUPABASE_Client.deleteColumn(
                            "regular_war_assignments",
                            "id=" + SUPABASE_Client.eq(assignmentId)
                                    + "&user_id=" + SUPABASE_Client.eq(actorId)
                    );
                    utils.sendJsonResponse(ex, result, 200);
                }));
    }

    private String requireTag(JsonObject request, String field) {
        String tag = utils.requireString(request, field).trim().toUpperCase();
        if (!CLASH_TAG.matcher(tag).matches()) {
            throw new IllegalArgumentException("Ongeldige Clash tag");
        }
        return tag;
    }

    private String requireWarKey(JsonObject request) {
        String warKey = utils.requireString(request, "warKey").trim();
        if (warKey.length() < 8 || warKey.length() > 160) {
            throw new IllegalArgumentException("Ongeldige war key");
        }
        return warKey;
    }

    private JsonObject frontendRow(JsonObject row) {
        JsonObject result = new JsonObject();
        result.add("id", row.get("id"));
        result.add("playerTag", row.get("player_tag"));
        result.add("attackSlot", row.get("attack_slot"));
        result.add("type", row.get("assignment_type"));
        result.add("targetPosition", row.get("target_position"));
        result.add("updatedAt", row.get("updated_at"));
        return result;
    }
}
