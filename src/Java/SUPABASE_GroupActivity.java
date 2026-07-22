package Java;

import Java.cache.CachePolicy;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Estimates the most recent in-game activity of linked Clash accounts.
 *
 * The Clash API does not expose a direct online/last-seen value. Exact timestamps
 * are used when league history exposes creationTime for an offensive entry.
 * Other activity is detected only from counters and battle-log entries that require
 * an action by the player; incoming attacks and other passive changes are ignored.
 */
public final class SUPABASE_GroupActivity {
    private static final long REFRESH_INTERVAL_MS = 5 * 60 * 1000L;
    private static final int MAX_PARALLEL_REFRESHES = 6;
    private static final String OWN_BATTLE_FINGERPRINT_PREFIX = "own-v2:";
    private static final Set<String> OWN_ATTACK_KEYS = Set.of(
            "attack", "attacks", "attacklog", "attacklogs",
            "offense", "offenses", "offence", "offences",
            "offensive", "offensiveattacks"
    );
    private static final Set<String> DEFENSE_KEYS = Set.of(
            "defense", "defenses", "defenselog", "defenselogs",
            "defence", "defences", "defencelog", "defencelogs",
            "defensive", "defensivebattles"
    );
    private static final Set<String> ACTIVITY_TYPE_KEYS = Set.of(
            "type", "entrytype", "battletype", "logtype", "kind"
    );
    private static final ExecutorService REFRESH_EXECUTOR = Executors.newFixedThreadPool(
            MAX_PARALLEL_REFRESHES,
            runnable -> {
                Thread thread = new Thread(runnable, "clashtools-group-activity");
                thread.setDaemon(true);
                return thread;
            }
    );

    private final HttpServer server;
    private final Config conf;
    private final API_Utils utils;

    public SUPABASE_GroupActivity(HttpServer server, Config conf) {
        this.server = server;
        this.conf = conf;
        this.utils = new API_Utils(conf);
    }

    public void getGroupMemberActivity() {
        server.createContext(conf._EXT_SUPA_GROUP_MEMBER_ACTIVITY, exchange -> utils.handlePost(exchange, ex -> {
            String requesterId = utils.requireAuthenticatedUser(ex);
            JsonObject body = utils.parseBody(ex);
            String groupId = utils.requireString(body, "groupId");

            requireGroupMember(groupId, requesterId);
            JsonArray memberships = readGroupMemberships(groupId);
            Set<String> userIds = membershipUserIds(memberships);
            JsonArray accountRows = readAccountRows(userIds);

            Map<String, JsonObject> refreshedById = refreshStaleAccounts(accountRows);
            JsonArray normalizedRows = new JsonArray();
            for (JsonElement element : accountRows) {
                JsonObject original = element.getAsJsonObject();
                String id = readString(original, "id");
                normalizedRows.add(refreshedById.getOrDefault(id, original).deepCopy());
            }

            JsonObject response = buildResponse(memberships, normalizedRows);
            utils.sendJsonResponse(ex, response.toString(), 200);
        }));
    }

    private void requireGroupMember(String groupId, String userId) throws Exception {
        JsonArray rows = JsonParser.parseString(SUPABASE_Client.getWithBody(
                "group_members",
                "select=user_id&group_id=" + SUPABASE_Client.eq(groupId)
                        + "&user_id=" + SUPABASE_Client.eq(userId)
                        + "&limit=1"
        )).getAsJsonArray();
        if (rows.isEmpty()) {
            throw new HttpException(403, "{\"error\":\"Je bent geen lid van deze groep\"}");
        }
    }

    private JsonArray readGroupMemberships(String groupId) throws Exception {
        return JsonParser.parseString(SUPABASE_Client.getWithBody(
                "group_members",
                "select=user_id&group_id=" + SUPABASE_Client.eq(groupId) + "&order=joined_at.asc"
        )).getAsJsonArray();
    }

    private Set<String> membershipUserIds(JsonArray memberships) {
        Set<String> ids = new HashSet<>();
        for (JsonElement element : memberships) {
            String userId = readString(element.getAsJsonObject(), "user_id");
            if (!userId.isBlank()) ids.add(userId);
        }
        return ids;
    }

    private JsonArray readAccountRows(Set<String> userIds) throws Exception {
        if (userIds.isEmpty()) return new JsonArray();
        String select = "select=id,user_id,player_tag,player_name,activity_snapshot,battle_log_fingerprint,"
                + "last_activity_at,last_activity_source,activity_checked_at";
        return JsonParser.parseString(SUPABASE_Client.getWithBody(
                "user_accounts",
                select + "&user_id=" + SUPABASE_Client.in(userIds)
        )).getAsJsonArray();
    }

    private Map<String, JsonObject> refreshStaleAccounts(JsonArray rows) {
        List<JsonObject> staleRows = new ArrayList<>();
        for (JsonElement element : rows) {
            JsonObject row = element.getAsJsonObject();
            if (isStale(readInstant(row, "activity_checked_at"))) staleRows.add(row.deepCopy());
        }

        List<CompletableFuture<JsonObject>> futures = staleRows.stream()
                .map(row -> CompletableFuture.supplyAsync(() -> {
                    try {
                        return refreshAccount(row);
                    } catch (Exception error) {
                        return markRefreshFailure(row);
                    }
                }, REFRESH_EXECUTOR))
                .toList();

        Map<String, JsonObject> byId = new HashMap<>();
        for (CompletableFuture<JsonObject> future : futures) {
            JsonObject row = future.join();
            String id = readString(row, "id");
            if (!id.isBlank()) byId.put(id, row);
        }
        return byId;
    }

    private boolean isStale(Instant checkedAt) {
        return checkedAt == null || checkedAt.toEpochMilli() < System.currentTimeMillis() - REFRESH_INTERVAL_MS;
    }

    private JsonObject refreshAccount(JsonObject row) throws Exception {
        String accountId = readString(row, "id");
        String playerTag = normalizeTag(readString(row, "player_tag"));
        if (accountId.isBlank() || playerTag.isBlank()) return row;

        String encodedTag = URLEncoder.encode(playerTag, StandardCharsets.UTF_8);
        JsonObject player = JsonParser.parseString(utils.clashGetFreshValue(
                "/players/" + encodedTag,
                CachePolicy.PLAYER_INFO
        )).getAsJsonObject();

        JsonElement battleLog = safeClashJson(
                "/players/" + encodedTag + "/battlelog",
                CachePolicy.PLAYER_BATTLE_LOG
        );
        JsonElement leagueHistory = safeClashJson(
                "/players/" + encodedTag + "/leaguehistory",
                CachePolicy.PLAYER_LEAGUE_HISTORY
        );

        JsonObject previousSnapshot = readObject(row, "activity_snapshot");
        JsonObject currentSnapshot = createActivitySnapshot(player);
        String previousBattleFingerprint = readString(row, "battle_log_fingerprint");
        String currentBattleFingerprint = fingerprintOwnBattleLog(battleLog);
        Instant previousActivity = readInstant(row, "last_activity_at");
        String previousSource = readString(row, "last_activity_source");

        ActivitySignal observed = detectObservedActivity(
                previousSnapshot,
                currentSnapshot,
                previousBattleFingerprint,
                currentBattleFingerprint
        );
        ActivitySignal exact = latestExactLeagueActivity(leagueHistory);
        ActivitySignal chosen = chooseLatest(previousActivity, previousSource, observed, exact);

        Instant now = Instant.now();
        JsonObject patch = new JsonObject();
        patch.add("activity_snapshot", currentSnapshot);
        if (!currentBattleFingerprint.isBlank()) patch.addProperty("battle_log_fingerprint", currentBattleFingerprint);
        patch.addProperty("activity_checked_at", now.toString());
        patch.addProperty("player_name", readString(player, "name"));
        if (chosen.at() != null) {
            patch.addProperty("last_activity_at", chosen.at().toString());
            patch.addProperty("last_activity_source", chosen.source());
        }

        SUPABASE_Client.patch("user_accounts", "id=" + SUPABASE_Client.eq(accountId), patch.toString());

        JsonObject updated = row.deepCopy();
        updated.add("activity_snapshot", currentSnapshot);
        if (!currentBattleFingerprint.isBlank()) updated.addProperty("battle_log_fingerprint", currentBattleFingerprint);
        updated.addProperty("activity_checked_at", now.toString());
        updated.addProperty("player_name", readString(player, "name"));
        if (chosen.at() != null) {
            updated.addProperty("last_activity_at", chosen.at().toString());
            updated.addProperty("last_activity_source", chosen.source());
        }
        updated.addProperty("refresh_failed", false);
        return updated;
    }

    private JsonObject markRefreshFailure(JsonObject row) {
        JsonObject copy = row.deepCopy();
        Instant checkedAt = Instant.now();
        copy.addProperty("activity_checked_at", checkedAt.toString());
        copy.addProperty("refresh_failed", true);

        String accountId = readString(row, "id");
        if (!accountId.isBlank()) {
            JsonObject patch = new JsonObject();
            patch.addProperty("activity_checked_at", checkedAt.toString());
            try {
                SUPABASE_Client.patch("user_accounts", "id=" + SUPABASE_Client.eq(accountId), patch.toString());
            } catch (Exception ignored) {
                // The endpoint can still return the previous estimate when persisting the check time fails.
            }
        }
        return copy;
    }

    private JsonElement safeClashJson(String path, long ttlMs) {
        try {
            return JsonParser.parseString(utils.clashGetCachedValue(path, ttlMs));
        } catch (Exception ignored) {
            return JsonNull.INSTANCE;
        }
    }

    static JsonObject createActivitySnapshot(JsonObject player) {
        JsonObject snapshot = new JsonObject();
        copyNumber(player, snapshot, "donations");
        copyNumber(player, snapshot, "donationsReceived");
        copyNumber(player, snapshot, "attackWins");
        copyNumber(player, snapshot, "defenseWins");
        copyNumber(player, snapshot, "warStars");
        copyNumber(player, snapshot, "clanCapitalContributions");
        copyNumber(player, snapshot, "trophies");
        copyNumber(player, snapshot, "builderBaseTrophies");
        copyNumber(player, snapshot, "expLevel");
        copyNumber(player, snapshot, "townHallLevel");
        if (player.has("clan") && player.get("clan").isJsonObject()) {
            String clanTag = readString(player.getAsJsonObject("clan"), "tag");
            if (!clanTag.isBlank()) snapshot.addProperty("clanTag", clanTag);
        }
        return snapshot;
    }

    static ActivitySignal detectObservedActivity(
            JsonObject previous,
            JsonObject current,
            String previousBattleFingerprint,
            String currentBattleFingerprint
    ) {
        if (previous == null || previous.size() == 0) return ActivitySignal.none();
        Instant observedAt = Instant.now();

        // Only outgoing donations prove that this player was active. Receiving
        // troops is caused by another player and must not update the timestamp.
        if (increased(previous, current, "donations")) {
            return new ActivitySignal(observedAt, "donation");
        }
        if (increased(previous, current, "warStars")) {
            return new ActivitySignal(observedAt, "war_attack");
        }
        if (increased(previous, current, "clanCapitalContributions")) {
            return new ActivitySignal(observedAt, "capital");
        }
        if (increased(previous, current, "attackWins")) {
            return new ActivitySignal(observedAt, "attack");
        }

        // The versioned fingerprint contains offensive entries only. Comparing
        // entry sets instead of the complete log avoids treating incoming
        // defenses, reordered entries or expired old entries as player activity.
        if (hasNewOwnBattleEntry(previousBattleFingerprint, currentBattleFingerprint)) {
            return new ActivitySignal(observedAt, "attack");
        }

        // Intentionally ignored: donationsReceived, defenseWins, trophy changes,
        // builder-base trophy changes and automatic progression. Those values can
        // change without the player performing an action at that moment.
        return ActivitySignal.none();
    }

    static ActivitySignal latestExactLeagueActivity(JsonElement leagueHistory) {
        Instant latest = findLatestOwnAttackCreationTime(leagueHistory);
        return latest == null ? ActivitySignal.none() : new ActivitySignal(latest, "ranked_attack");
    }

    private static ActivitySignal chooseLatest(
            Instant previousActivity,
            String previousSource,
            ActivitySignal observed,
            ActivitySignal exact
    ) {
        List<ActivitySignal> candidates = new ArrayList<>();
        if (previousActivity != null) candidates.add(new ActivitySignal(previousActivity, previousSource));
        if (observed.at() != null) candidates.add(observed);
        if (exact.at() != null) candidates.add(exact);
        return candidates.stream()
                .filter(signal -> signal.at() != null)
                .max(Comparator.comparing(ActivitySignal::at))
                .orElse(ActivitySignal.none());
    }

    static Instant findLatestOwnAttackCreationTime(JsonElement element) {
        return findLatestOwnAttackCreationTime(element, false);
    }

    private static Instant findLatestOwnAttackCreationTime(JsonElement element, boolean ownAttackContext) {
        if (element == null || element.isJsonNull()) return null;

        if (element.isJsonArray()) {
            Instant latest = null;
            for (JsonElement child : element.getAsJsonArray()) {
                Instant candidate = findLatestOwnAttackCreationTime(child, ownAttackContext);
                latest = later(latest, candidate);
            }
            return latest;
        }
        if (!element.isJsonObject()) return null;

        JsonObject object = element.getAsJsonObject();
        ActivityKind kind = readActivityKind(object);
        if (kind == ActivityKind.DEFENSE) return null;

        boolean localAttackContext = ownAttackContext || kind == ActivityKind.ATTACK;
        Instant latest = null;

        for (Map.Entry<String, JsonElement> entry : object.entrySet()) {
            String normalizedKey = normalizeJsonKey(entry.getKey());
            JsonElement value = entry.getValue();

            if (DEFENSE_KEYS.contains(normalizedKey)) {
                continue;
            }
            if (OWN_ATTACK_KEYS.contains(normalizedKey)) {
                latest = later(latest, findLatestOwnAttackCreationTime(value, true));
                continue;
            }
            if (localAttackContext && isCreationTimeKey(normalizedKey)) {
                Instant candidate = parseClashInstant(value == null || value.isJsonNull() ? "" : value.getAsString());
                if (candidate != null && !candidate.isAfter(Instant.now().plusSeconds(300))) {
                    latest = later(latest, candidate);
                }
                continue;
            }
            if (value != null && (value.isJsonArray() || value.isJsonObject())) {
                latest = later(latest, findLatestOwnAttackCreationTime(value, localAttackContext));
            }
        }
        return latest;
    }

    static Instant parseClashInstant(String value) {
        if (value == null || value.isBlank()) return null;
        String clean = value.trim();
        try {
            return Instant.parse(clean);
        } catch (DateTimeParseException ignored) {
            // Clash also uses compact UTC timestamps such as 20260720T123456.000Z.
        }
        if (clean.matches("^\\d{8}T\\d{6}(?:\\.\\d{1,3})?Z$")) {
            String fraction = clean.contains(".")
                    ? clean.substring(clean.indexOf('.') + 1, clean.length() - 1)
                    : "000";
            String millis = (fraction + "000").substring(0, 3);
            String normalized = clean.substring(0, 4) + "-" + clean.substring(4, 6) + "-" + clean.substring(6, 8)
                    + "T" + clean.substring(9, 11) + ":" + clean.substring(11, 13) + ":" + clean.substring(13, 15)
                    + "." + millis + "Z";
            try {
                return Instant.parse(normalized);
            } catch (DateTimeParseException ignored) {
                return null;
            }
        }
        return null;
    }

    static String fingerprintOwnBattleLog(JsonElement battleLog) {
        if (battleLog == null || battleLog.isJsonNull()) return "";

        Set<String> canonicalEntries = new LinkedHashSet<>();
        collectOwnBattleEntries(battleLog, false, canonicalEntries);

        Set<String> hashes = new java.util.TreeSet<>();
        for (String entry : canonicalEntries) {
            hashes.add(sha256(entry));
        }
        return OWN_BATTLE_FINGERPRINT_PREFIX + String.join(",", hashes);
    }

    static boolean hasNewOwnBattleEntry(String previousFingerprint, String currentFingerprint) {
        Set<String> previousEntries = parseOwnBattleFingerprint(previousFingerprint);
        Set<String> currentEntries = parseOwnBattleFingerprint(currentFingerprint);

        // A legacy full-log fingerprint is used as a baseline once. This prevents
        // the deployment of the stricter algorithm from creating fake activity.
        if (previousEntries == null || currentEntries == null || currentEntries.isEmpty()) {
            return false;
        }
        for (String entry : currentEntries) {
            if (!previousEntries.contains(entry)) return true;
        }
        return false;
    }

    private static Set<String> parseOwnBattleFingerprint(String fingerprint) {
        if (fingerprint == null || !fingerprint.startsWith(OWN_BATTLE_FINGERPRINT_PREFIX)) {
            return null;
        }

        String payload = fingerprint.substring(OWN_BATTLE_FINGERPRINT_PREFIX.length());
        Set<String> entries = new HashSet<>();
        if (payload.isBlank()) return entries;

        for (String entry : payload.split(",")) {
            String clean = entry.trim();
            if (!clean.isBlank()) entries.add(clean);
        }
        return entries;
    }

    private static void collectOwnBattleEntries(
            JsonElement element,
            boolean ownAttackContext,
            Set<String> entries
    ) {
        if (element == null || element.isJsonNull()) return;

        if (element.isJsonArray()) {
            for (JsonElement child : element.getAsJsonArray()) {
                collectOwnBattleEntries(child, ownAttackContext, entries);
            }
            return;
        }
        if (!element.isJsonObject()) return;

        JsonObject object = element.getAsJsonObject();
        ActivityKind kind = readActivityKind(object);
        if (kind == ActivityKind.DEFENSE) return;

        boolean localAttackContext = ownAttackContext || kind == ActivityKind.ATTACK;
        if (localAttackContext) {
            entries.add(canonicalOwnAttackJson(object));
            return;
        }

        for (Map.Entry<String, JsonElement> entry : object.entrySet()) {
            String normalizedKey = normalizeJsonKey(entry.getKey());
            if (DEFENSE_KEYS.contains(normalizedKey)) continue;

            if (OWN_ATTACK_KEYS.contains(normalizedKey)) {
                addOwnAttackContainerEntries(entry.getValue(), entries);
            } else if (entry.getValue() != null
                    && (entry.getValue().isJsonArray() || entry.getValue().isJsonObject())) {
                collectOwnBattleEntries(entry.getValue(), false, entries);
            }
        }
    }

    private static void addOwnAttackContainerEntries(JsonElement element, Set<String> entries) {
        if (element == null || element.isJsonNull()) return;
        if (element.isJsonArray()) {
            for (JsonElement child : element.getAsJsonArray()) {
                if (child != null && child.isJsonObject()
                        && readActivityKind(child.getAsJsonObject()) == ActivityKind.DEFENSE) {
                    continue;
                }
                entries.add(canonicalOwnAttackJson(child));
            }
            return;
        }
        entries.add(canonicalOwnAttackJson(element));
    }

    private static String canonicalOwnAttackJson(JsonElement element) {
        if (element == null || element.isJsonNull()) return "null";
        if (element.isJsonPrimitive()) return element.toString();

        if (element.isJsonArray()) {
            StringBuilder result = new StringBuilder("[");
            boolean first = true;
            for (JsonElement child : element.getAsJsonArray()) {
                if (!first) result.append(',');
                result.append(canonicalOwnAttackJson(child));
                first = false;
            }
            return result.append(']').toString();
        }

        TreeMap<String, JsonElement> sorted = new TreeMap<>();
        for (Map.Entry<String, JsonElement> entry : element.getAsJsonObject().entrySet()) {
            if (!DEFENSE_KEYS.contains(normalizeJsonKey(entry.getKey()))) {
                sorted.put(entry.getKey(), entry.getValue());
            }
        }

        StringBuilder result = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, JsonElement> entry : sorted.entrySet()) {
            if (!first) result.append(',');
            result.append('"').append(escapeJson(entry.getKey())).append('"');
            result.append(':').append(canonicalOwnAttackJson(entry.getValue()));
            first = false;
        }
        return result.append('}').toString();
    }

    private static String escapeJson(String value) {
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte item : digest) hex.append(String.format("%02x", item));
            return hex.toString();
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is not available", impossible);
        }
    }

    private static ActivityKind readActivityKind(JsonObject object) {
        if (object == null) return ActivityKind.UNKNOWN;

        for (Map.Entry<String, JsonElement> entry : object.entrySet()) {
            if (!ACTIVITY_TYPE_KEYS.contains(normalizeJsonKey(entry.getKey()))) continue;
            JsonElement value = entry.getValue();
            if (value == null || value.isJsonNull() || !value.isJsonPrimitive()) continue;

            String normalizedValue = normalizeJsonKey(value.getAsString());
            if (normalizedValue.contains("defense") || normalizedValue.contains("defence")) {
                return ActivityKind.DEFENSE;
            }
            if (normalizedValue.contains("attack")
                    || normalizedValue.contains("offense")
                    || normalizedValue.contains("offence")) {
                return ActivityKind.ATTACK;
            }
        }
        return ActivityKind.UNKNOWN;
    }

    private static boolean isCreationTimeKey(String normalizedKey) {
        return "creationtime".equals(normalizedKey)
                || "battletime".equals(normalizedKey)
                || "eventtime".equals(normalizedKey);
    }

    private static String normalizeJsonKey(String value) {
        if (value == null) return "";
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private static Instant later(Instant first, Instant second) {
        if (first == null) return second;
        if (second == null) return first;
        return second.isAfter(first) ? second : first;
    }

    private enum ActivityKind {
        ATTACK,
        DEFENSE,
        UNKNOWN
    }

    private JsonObject buildResponse(JsonArray memberships, JsonArray accountRows) {
        Map<String, List<JsonObject>> accountsByUser = new HashMap<>();
        for (JsonElement element : accountRows) {
            JsonObject account = element.getAsJsonObject();
            String userId = readString(account, "user_id");
            accountsByUser.computeIfAbsent(userId, ignored -> new ArrayList<>()).add(account);
        }

        JsonArray members = new JsonArray();
        for (JsonElement membershipElement : memberships) {
            String userId = readString(membershipElement.getAsJsonObject(), "user_id");
            List<JsonObject> accounts = accountsByUser.getOrDefault(userId, List.of());
            JsonObject result = new JsonObject();
            result.addProperty("userId", userId);
            result.addProperty("accountCount", accounts.size());

            if (accounts.isEmpty()) {
                result.addProperty("status", "no_accounts");
                members.add(result);
                continue;
            }

            JsonObject latest = accounts.stream()
                    .filter(account -> readInstant(account, "last_activity_at") != null)
                    .max(Comparator.comparing(account -> readInstant(account, "last_activity_at")))
                    .orElse(null);

            if (latest == null) {
                boolean allFailed = accounts.stream().allMatch(account -> readBoolean(account, "refresh_failed"));
                result.addProperty("status", allFailed ? "unavailable" : "unmeasured");
                members.add(result);
                continue;
            }

            result.addProperty("status", "ok");
            result.addProperty("lastActivityAt", readString(latest, "last_activity_at"));
            result.addProperty("source", readString(latest, "last_activity_source"));
            result.addProperty("accountTag", readString(latest, "player_tag"));
            result.addProperty("accountName", readString(latest, "player_name"));
            members.add(result);
        }

        JsonObject response = new JsonObject();
        response.add("members", members);
        response.addProperty("checkedAt", Instant.now().toString());
        response.addProperty("estimated", true);
        return response;
    }

    private static boolean increased(JsonObject previous, JsonObject current, String field) {
        Long before = readLong(previous, field);
        Long after = readLong(current, field);
        return before != null && after != null && after > before;
    }

    private static void copyNumber(JsonObject source, JsonObject target, String field) {
        JsonElement value = source.get(field);
        if (value != null && !value.isJsonNull() && value.isJsonPrimitive() && value.getAsJsonPrimitive().isNumber()) {
            target.addProperty(field, value.getAsLong());
        }
    }

    private static Long readLong(JsonObject object, String field) {
        if (object == null) return null;
        JsonElement value = object.get(field);
        if (value == null || value.isJsonNull()) return null;
        try {
            return value.getAsLong();
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static JsonObject readObject(JsonObject object, String field) {
        JsonElement value = object.get(field);
        return value != null && value.isJsonObject() ? value.getAsJsonObject() : new JsonObject();
    }

    private static String readString(JsonObject object, String field) {
        if (object == null) return "";
        JsonElement value = object.get(field);
        if (value == null || value.isJsonNull()) return "";
        try {
            return value.getAsString();
        } catch (RuntimeException ignored) {
            return "";
        }
    }

    private static Instant readInstant(JsonObject object, String field) {
        return parseClashInstant(readString(object, field));
    }

    private static boolean readBoolean(JsonObject object, String field) {
        JsonElement value = object.get(field);
        return value != null && !value.isJsonNull() && value.getAsBoolean();
    }

    private static String normalizeTag(String value) {
        if (value == null) return "";
        String tag = value.trim().toUpperCase();
        if (tag.isBlank()) return "";
        return tag.startsWith("#") ? tag : "#" + tag;
    }

    record ActivitySignal(Instant at, String source) {
        static ActivitySignal none() {
            return new ActivitySignal(null, "");
        }
    }
}