package Java;

import Java.cache.CacheKeys;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.util.HashMap;
import java.util.Map;

/** Canonical read boundary for verified Clash accounts. */
public final class LinkedAccountRepository {
    private static final String ACCOUNT_SELECT = String.join(",",
            "id", "user_id", "player_tag", "player_name", "town_hall_level", "snapshot");

    public JsonArray listForUser(String userId) throws Exception {
        if (userId == null || userId.isBlank()) return new JsonArray();
        String query = "select=" + ACCOUNT_SELECT
                + "&user_id=" + SUPABASE_Client.eq(userId)
                + "&order=created_at.asc,id.asc";
        return accountSnapshots(readRows(query));
    }

    public boolean owns(String userId, String rawPlayerTag) throws Exception {
        if (userId == null || userId.isBlank()) return false;
        String playerTag = CacheKeys.requireValidTag(rawPlayerTag);
        String query = "select=id"
                + "&user_id=" + SUPABASE_Client.eq(userId)
                + "&player_tag=" + SUPABASE_Client.eq(playerTag)
                + "&limit=1";
        return !readRows(query).isEmpty();
    }

    public void attachToProfiles(JsonArray profiles) throws Exception {
        Map<String, JsonObject> profilesById = new HashMap<>();
        for (JsonElement element : profiles) {
            if (!element.isJsonObject()) continue;
            JsonObject profile = element.getAsJsonObject();
            JsonElement id = profile.get("id");
            if (id == null || id.isJsonNull()) continue;
            profile.add("accounts", new JsonArray());
            profilesById.put(id.getAsString(), profile);
        }
        if (profilesById.isEmpty()) return;

        String query = "select=" + ACCOUNT_SELECT
                + "&user_id=" + SUPABASE_Client.in(profilesById.keySet())
                + "&order=created_at.asc,id.asc";
        for (JsonElement element : readRows(query)) {
            JsonObject row = element.getAsJsonObject();
            JsonObject profile = profilesById.get(text(row, "user_id"));
            if (profile != null) profile.getAsJsonArray("accounts").add(accountSnapshot(row));
        }
    }

    private JsonArray readRows(String query) throws Exception {
        String response = SUPABASE_Client.getWithBody("user_accounts", query);
        JsonElement parsed = JsonParser.parseString(response == null ? "[]" : response);
        if (!parsed.isJsonArray()) {
            throw new IllegalStateException("Linked account lookup must return an array");
        }
        return parsed.getAsJsonArray();
    }

    private JsonArray accountSnapshots(JsonArray rows) {
        JsonArray accounts = new JsonArray();
        for (JsonElement element : rows) {
            if (element.isJsonObject()) accounts.add(accountSnapshot(element.getAsJsonObject()));
        }
        return accounts;
    }

    private JsonObject accountSnapshot(JsonObject row) {
        JsonElement stored = row.get("snapshot");
        JsonObject account = stored != null && stored.isJsonObject()
                ? stored.getAsJsonObject().deepCopy() : new JsonObject();
        account.addProperty("tag", text(row, "player_tag"));
        account.addProperty("accountId", text(row, "id"));
        addFallback(account, "name", row.get("player_name"));
        addFallback(account, "townHallLevel", row.get("town_hall_level"));
        return account;
    }

    private void addFallback(JsonObject target, String field, JsonElement value) {
        if (target.has(field) || value == null || value.isJsonNull()) return;
        target.add(field, value.deepCopy());
    }

    private String text(JsonObject row, String field) {
        JsonElement value = row.get(field);
        return value == null || value.isJsonNull() ? "" : value.getAsString();
    }
}
