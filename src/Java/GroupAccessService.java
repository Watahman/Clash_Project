package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.util.Objects;

public final class GroupAccessService {
    public void requireMember(String groupId, String userId) throws Exception {
        JsonArray rows = JsonParser.parseString(SUPABASE_Client.getWithBody(
                "group_members",
                "select=role&group_id=" + SUPABASE_Client.eq(groupId)
                        + "&user_id=" + SUPABASE_Client.eq(userId)
                        + "&limit=1"
        )).getAsJsonArray();
        if (rows.isEmpty()) {
            throw new HttpException(403, "{\"error\":\"Geen toegang tot deze groep\"}");
        }
    }

    public void requireAdmin(String groupId, String userId) throws Exception {
        JsonObject group = getGroup(groupId);
        JsonElement owner = group.get("owner_id");
        if (owner != null && !owner.isJsonNull() && Objects.equals(owner.getAsString(), userId)) return;

        JsonArray rows = JsonParser.parseString(SUPABASE_Client.getWithBody(
                "group_members",
                "select=role&group_id=" + SUPABASE_Client.eq(groupId)
                        + "&user_id=" + SUPABASE_Client.eq(userId)
                        + "&role=" + SUPABASE_Client.in(java.util.List.of("leader", "co_leader"))
                        + "&limit=1"
        )).getAsJsonArray();
        if (rows.isEmpty()) {
            throw new HttpException(403, "{\"error\":\"Alleen group admins mogen dit uitvoeren\"}");
        }
    }

    public boolean canAdmin(String groupId, String userId) throws Exception {
        try {
            requireAdmin(groupId, userId);
            return true;
        } catch (HttpException denied) {
            if (denied.getStatusCode() == 403) return false;
            throw denied;
        }
    }

    private JsonObject getGroup(String groupId) throws Exception {
        JsonArray rows = JsonParser.parseString(SUPABASE_Client.getWithBody(
                "groups",
                "select=id,owner_id&id=" + SUPABASE_Client.eq(groupId) + "&limit=1"
        )).getAsJsonArray();
        if (rows.isEmpty()) throw new HttpException(404, "{\"error\":\"Groep niet gevonden\"}");
        return rows.get(0).getAsJsonObject();
    }
}
