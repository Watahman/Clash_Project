package Java;

import Java.achievements.AchievementBaseSnapshotMetrics;
import Java.achievements.AchievementEvaluator;
import Java.achievements.AchievementMetricCollector;
import Java.achievements.AchievementProgress;
import Java.achievements.AchievementSources;
import Java.achievements.AchievementSpecV2Catalog;
import Java.achievements.AchievementScopedProgress;
import Java.achievements.ClanAchievementLedger;
import Java.achievements.BaseDataSnapshot;
import Java.achievements.DynamicOfficialAchievementProgress;
import Java.achievements.HistoricalAchievementMetrics;
import Java.cache.CacheKeys;
import Java.cwlhistory.HistoricalCwlService;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class SUPABASE_Achievements {
    static final String IMPORT_ROUTE = "/AchievementsImport";
    static final String GET_ROUTE = "/Achievements";

    private final HttpServer server;
    private final API_Utils utils;
    private final AchievementEvaluator evaluator = new AchievementEvaluator();
    private final AchievementMetricCollector metricCollector;
    private final ClanAchievementLedger clanLedger = new ClanAchievementLedger();

    public SUPABASE_Achievements(HttpServer server, Config conf) {
        this.server = server;
        this.utils = new API_Utils(conf);
        this.metricCollector = new AchievementMetricCollector(conf);
    }

    SUPABASE_Achievements(
            HttpServer server,
            Config conf,
            HistoricalCwlService cwlService
    ) {
        this.server = server;
        this.utils = new API_Utils(conf);
        this.metricCollector = new AchievementMetricCollector(conf, cwlService);
    }

    public void registerRoutes() {
        server.createContext(IMPORT_ROUTE, exchange -> utils.handlePost(exchange, this::importBaseData));
        server.createContext(GET_ROUTE, exchange -> utils.handleGet(exchange, this::getAchievements));
    }

    private void importBaseData(HttpExchange exchange) throws Exception {
        JsonObject body = utils.parseBody(exchange);
        String userId = utils.requireAuthenticatedUser(exchange);
        JsonObject baseData = unwrapBaseData(body);
        BaseDataSnapshot snapshot = BaseDataSnapshot.parse(baseData);

        ensureOwnedAccount(userId, snapshot.playerTag());

        Map<String, Long> combinedMetrics = new LinkedHashMap<>(snapshot.metrics());
        List<HistoricalAchievementMetrics.Snapshot> history = loadHistoricalSnapshots(userId, snapshot.playerTag());
        history.add(new HistoricalAchievementMetrics.Snapshot(snapshot.sourceTimestamp(), snapshot.metrics()));
        combinedMetrics.putAll(HistoricalAchievementMetrics.extract(history));

        List<AchievementProgress> evaluated = evaluator.evaluate(combinedMetrics).stream()
                .filter(AchievementProgress::measurable)
                .filter(item -> !"clan".equalsIgnoreCase(
                        AchievementSpecV2Catalog.metadata(item.definition().key()).scope()
                ))
                .filter(item -> {
                    String source = AchievementSources.forDefinition(item.definition());
                    return AchievementSources.BASE_DATA.equals(source)
                            || AchievementSources.BASE_HISTORY.equals(source);
                })
                .toList();
        JsonArray progressJson = evaluator.toJson(evaluated);
        long unlockedCount = evaluated.stream().filter(AchievementProgress::unlocked).count();

        JsonObject rpcBody = new JsonObject();
        rpcBody.addProperty("p_user_id", userId);
        rpcBody.addProperty("p_player_tag", snapshot.playerTag());
        rpcBody.addProperty("p_source_timestamp", snapshot.sourceTimestamp());
        rpcBody.addProperty("p_checksum", snapshot.checksum());
        rpcBody.add("p_payload", snapshot.payload());
        rpcBody.add("p_metrics", metricsJson(combinedMetrics));
        rpcBody.add("p_progress", progressJson);

        String persistenceResult = SUPABASE_Client.rpc("save_achievement_import", rpcBody.toString());

        JsonObject response = new JsonObject();
        response.addProperty("success", true);
        response.addProperty("playerTag", snapshot.playerTag());
        response.addProperty("sourceTimestamp", snapshot.sourceTimestamp());
        response.addProperty("checksum", snapshot.checksum());
        response.addProperty("unlockedCount", unlockedCount);
        response.addProperty("achievementCount", evaluated.size());
        response.add("metrics", metricsJson(combinedMetrics));
        response.add("history", historySummaryJson(combinedMetrics));
        response.add("achievements", progressJson);
        response.add("persistence", parseAnyJson(persistenceResult));
        utils.sendJsonResponse(exchange, response.toString(), 200);
    }

    private void getAchievements(HttpExchange exchange) throws Exception {
        String userId = utils.requireAuthenticatedUser(exchange);
        Map<String, String> query = queryParameters(exchange.getRequestURI().getRawQuery());
        String playerTag = CacheKeys.requireValidTag(requiredQueryParameter(query, "playerTag"));
        boolean deepHistory = "1".equals(query.get("deepHistory"))
                || "true".equalsIgnoreCase(query.getOrDefault("deepHistory", ""));
        ensureOwnedAccount(userId, playerTag);

        String userFilter = "user_id=" + SUPABASE_Client.eq(userId);
        String tagFilter = "player_tag=" + SUPABASE_Client.eq(playerTag);

        String progress = SUPABASE_Client.getWithBody(
                "achievement_progress",
                "select=achievement_key,family_key,title,description,category,rarity,tier,xp,metric,progress,target,unlocked,unlocked_at,updated_at"
                        + "&" + userFilter + "&" + tagFilter + "&order=category.asc,family_key.asc,tier.asc"
        );
        String snapshots = SUPABASE_Client.getWithBody(
                "achievement_base_snapshots",
                "select=source_timestamp,imported_at,checksum,metrics,payload"
                        + "&" + userFilter + "&" + tagFilter + "&order=source_timestamp.desc&limit=1"
        );

        JsonElement latestSnapshot = firstOrNull(snapshots);
        Map<String, Long> snapshotMetrics = new LinkedHashMap<>();
        JsonElement latestSnapshotForResponse = latestSnapshot.deepCopy();
        if (latestSnapshot.isJsonObject()) {
            JsonObject snapshotObject = latestSnapshot.getAsJsonObject();
            JsonElement metrics = snapshotObject.get("metrics");
            Map<String, Long> storedMetrics = metrics != null && metrics.isJsonObject()
                    ? numericMap(metrics.getAsJsonObject())
                    : Map.of();
            JsonElement payload = snapshotObject.get("payload");
            if (payload != null && payload.isJsonObject()) {
                snapshotMetrics.putAll(AchievementBaseSnapshotMetrics.enrich(payload.getAsJsonObject(), storedMetrics));
            } else {
                snapshotMetrics.putAll(storedMetrics);
            }
            if (latestSnapshotForResponse.isJsonObject()) latestSnapshotForResponse.getAsJsonObject().remove("payload");
        }

        AchievementMetricCollector.Result collected = metricCollector.collect(userId, playerTag, snapshotMetrics, deepHistory);
        String clanProgress = clanLedger.readCurrent(collected.clanTag());
        JsonArray fixedAchievements = completeAchievementCatalog(progress, clanProgress, collected.metrics());
        boolean liveProfileAvailable = sourceAvailable(collected.sources(), AchievementSources.LIVE_PROFILE);
        JsonArray officialAchievements = DynamicOfficialAchievementProgress.merge(
                progress,
                evaluator.dynamicOfficialAchievements(collected.officialAchievements(), liveProfileAvailable),
                liveProfileAvailable
        );

        JsonArray achievements = fixedAchievements.deepCopy();
        officialAchievements.forEach(achievements::add);
        boolean persisted = persistObservedProgress(userId, playerTag, progress, achievements);
        boolean clanPersisted = persistObservedClanProgress(
                collected.clanTag(), clanProgress, achievements,
                sourceAvailable(collected.sources(), AchievementSources.CLAN_PROFILE)
        );

        JsonObject response = new JsonObject();
        response.addProperty("playerTag", playerTag);
        response.addProperty("deepHistory", deepHistory);
        response.addProperty("progressPersisted", persisted);
        response.addProperty("clanProgressPersisted", clanPersisted);
        if (!collected.clanTag().isBlank()) response.addProperty("currentClanTag", collected.clanTag());
        response.addProperty("fixedFamilyCount", 340);
        response.addProperty("fixedTierCount", 1331);
        response.addProperty("dynamicOfficialCount", officialAchievements.size());
        response.add("achievements", achievements);
        response.add("latestSnapshot", latestSnapshotForResponse);
        response.add("sources", collected.sources());
        response.add("history", historySummaryJson(collected.metrics()));
        utils.sendJsonResponse(exchange, response.toString(), 200);
    }

    private JsonArray completeAchievementCatalog(
            String storedProgressJson,
            String storedClanProgressJson,
            Map<String, Long> currentMetrics
    ) {
        JsonArray storedRows = JsonParser.parseString(storedProgressJson).getAsJsonArray();
        Map<String, JsonObject> personalStoredByKey = storedRowsByKey(storedRows);
        Map<String, JsonObject> clanStoredByKey = storedRowsByKey(
                JsonParser.parseString(storedClanProgressJson).getAsJsonArray()
        );
        JsonArray catalog = evaluator.toJson(evaluator.evaluate(currentMetrics));
        JsonArray result = new JsonArray();

        for (JsonElement element : catalog) {
            JsonObject row = element.getAsJsonObject().deepCopy();
            String key = stringValue(row, "achievement_key");
            JsonObject stored = AchievementScopedProgress.storedFor(
                    row, personalStoredByKey, clanStoredByKey
            );
            boolean progressKnown = booleanValue(row, "progress_known");
            boolean currentUnlock = booleanValue(row, "unlocked");

            if (stored != null) {
                long storedProgress = longValue(stored, "progress");
                long progress = progressKnown
                        ? AchievementProgressMerge.best(key, longValue(row, "progress"), storedProgress)
                        : storedProgress;
                boolean previouslyUnlocked = booleanValue(stored, "unlocked");
                row.addProperty("progress", progress);
                row.addProperty("unlocked", previouslyUnlocked || currentUnlock);
                copyOptional(stored, row, "unlocked_at");
                copyOptional(stored, row, "updated_at");
            }

            boolean hasStoredProgress = stored != null
                    && (longValue(stored, "progress") > 0 || booleanValue(stored, "unlocked"));
            row.addProperty("source_available", progressKnown);
            row.addProperty("has_stored_progress", hasStoredProgress);
            result.add(row);
        }
        return result;
    }

    private boolean persistObservedClanProgress(
            String clanTag,
            String storedProgressJson,
            JsonArray completeRows,
            boolean evidenceAvailable
    ) {
        if (clanTag == null || clanTag.isBlank() || !evidenceAvailable) return true;
        try {
            Map<String, JsonObject> storedByKey = storedRowsByKey(
                    JsonParser.parseString(storedProgressJson).getAsJsonArray()
            );
            JsonArray changed = AchievementScopedProgress.changedClanRows(storedByKey, completeRows);
            if (changed.isEmpty()) return true;

            JsonObject body = new JsonObject();
            body.addProperty("p_clan_tag", clanTag);
            body.addProperty("p_evidence_timestamp", Instant.now().getEpochSecond());
            body.addProperty("p_evidence_source", "official_clan_profile_and_members");
            body.add("p_progress", changed);
            SUPABASE_Client.rpc("reconcile_clan_achievement_progress_v1", body.toString());
            return true;
        } catch (Exception persistenceFailure) {
            System.err.println("[Achievements] Could not persist shared clan progress: " + persistenceFailure.getMessage());
            return false;
        }
    }

    private boolean persistObservedProgress(
            String userId,
            String playerTag,
            String storedProgressJson,
            JsonArray completeRows
    ) {
        try {
            Map<String, JsonObject> storedByKey = storedRowsByKey(JsonParser.parseString(storedProgressJson).getAsJsonArray());
            JsonArray changed = new JsonArray();
            long now = Instant.now().getEpochSecond();
            String unlockedNow = Instant.now().toString();

            for (JsonElement element : completeRows) {
                if (!element.isJsonObject()) continue;
                JsonObject row = element.getAsJsonObject();
                if (!booleanValue(row, "progress_known")) continue;
                if (booleanValue(row, "catalog_template")) continue;
                // Shared clan badges have their own clan-tag ledger. Never let
                // them enter the player-owned XP/unlock table.
                if ("clan".equalsIgnoreCase(stringValue(row, "scope"))) continue;

                String key = stringValue(row, "achievement_key");
                JsonObject stored = storedByKey.get(key);
                long progress = longValue(row, "progress");
                long target = longValue(row, "target");
                boolean unlocked = booleanValue(row, "unlocked");

                // The catalog itself is virtual/read-only. Do not create a DB row
                // merely because a measurable achievement currently has zero progress.
                if (stored == null && progress == 0 && !unlocked) continue;

                boolean changedProgress = stored == null
                        ? progress > 0
                        : AchievementProgressMerge.improved(key, progress, longValue(stored, "progress"));
                boolean changedUnlock = stored == null
                        ? unlocked
                        : unlocked && !booleanValue(stored, "unlocked");
                boolean changedTarget = stored != null && target != longValue(stored, "target");
                if (!changedProgress && !changedUnlock && !changedTarget) continue;

                JsonObject db = new JsonObject();
                db.addProperty("user_id", userId);
                db.addProperty("player_tag", playerTag);
                copyRequired(row, db, "achievement_key");
                copyRequired(row, db, "family_key");
                copyRequired(row, db, "title");
                copyRequired(row, db, "description");
                copyRequired(row, db, "category");
                copyRequired(row, db, "rarity");
                copyRequired(row, db, "tier");
                copyRequired(row, db, "xp");
                copyRequired(row, db, "metric");
                db.addProperty("progress", progress);
                db.addProperty("target", target);
                db.addProperty("unlocked", unlocked);
                JsonElement existingUnlockedAt = stored == null ? null : stored.get("unlocked_at");
                if (existingUnlockedAt != null && !existingUnlockedAt.isJsonNull()) {
                    db.add("unlocked_at", existingUnlockedAt.deepCopy());
                } else if (unlocked) {
                    db.addProperty("unlocked_at", unlockedNow);
                }
                db.addProperty("source_timestamp", now);
                changed.add(db);
            }

            if (changed.isEmpty()) return true;
            SUPABASE_Client.upsert("achievement_progress", "user_id,player_tag,achievement_key,tier", changed.toString());
            return true;
        } catch (Exception persistenceFailure) {
            System.err.println("[Achievements] Could not persist observed progress: " + persistenceFailure.getMessage());
            return false;
        }
    }

    private Map<String, JsonObject> storedRowsByKey(JsonArray storedRows) {
        Map<String, JsonObject> storedByKey = new HashMap<>();
        for (JsonElement element : storedRows) {
            if (!element.isJsonObject()) continue;
            JsonObject row = element.getAsJsonObject();
            String key = stringValue(row, "achievement_key");
            if (!key.isBlank()) storedByKey.put(key, row);
        }
        return storedByKey;
    }

    private void copyRequired(JsonObject source, JsonObject target, String field) {
        JsonElement value = source.get(field);
        if (value == null || value.isJsonNull()) throw new IllegalArgumentException("Missing achievement field: " + field);
        target.add(field, value.deepCopy());
    }

    private void copyOptional(JsonObject source, JsonObject target, String field) {
        JsonElement value = source.get(field);
        if (value != null && !value.isJsonNull()) target.add(field, value.deepCopy());
    }

    private String stringValue(JsonObject object, String field) {
        JsonElement value = object.get(field);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isString()
                ? value.getAsString() : "";
    }

    private long longValue(JsonObject object, String field) {
        JsonElement value = object.get(field);
        if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isNumber()) return 0;
        return Math.max(0, value.getAsLong());
    }

    private boolean booleanValue(JsonObject object, String field) {
        JsonElement value = object.get(field);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isBoolean() && value.getAsBoolean();
    }

    private boolean sourceAvailable(JsonObject sources, String source) {
        if (sources == null || source == null || !sources.has(source) || !sources.get(source).isJsonObject()) return false;
        return booleanValue(sources.getAsJsonObject(source), "available");
    }

    private List<HistoricalAchievementMetrics.Snapshot> loadHistoricalSnapshots(String userId, String playerTag) throws Exception {
        String response = SUPABASE_Client.getWithBody(
                "achievement_base_snapshots",
                "select=source_timestamp,metrics&user_id=" + SUPABASE_Client.eq(userId)
                        + "&player_tag=" + SUPABASE_Client.eq(playerTag)
                        + "&order=source_timestamp.asc&limit=250"
        );
        JsonArray rows = JsonParser.parseString(response).getAsJsonArray();
        return new ArrayList<>(HistoricalAchievementMetrics.snapshotsFromJson(rows));
    }

    private JsonObject unwrapBaseData(JsonObject body) {
        JsonElement nested = body.get("baseData");
        if (nested == null) return body;
        if (!nested.isJsonObject()) throw new IllegalArgumentException("Veld 'baseData' moet een JSON-object zijn");
        return nested.getAsJsonObject();
    }

    private void ensureOwnedAccount(String userId, String playerTag) throws Exception {
        String result = SUPABASE_Client.getWithBody("users", "select=accounts&id=" + SUPABASE_Client.eq(userId) + "&limit=1");
        JsonArray users = JsonParser.parseString(result).getAsJsonArray();
        if (users.isEmpty()) throw new HttpException(404, "{\"error\":\"Gebruiker niet gevonden\"}");

        JsonElement accounts = users.get(0).getAsJsonObject().get("accounts");
        if (!containsPlayerTag(accounts, playerTag)) {
            throw new HttpException(403, "{\"error\":\"Deze speler is niet als geverifieerd account gekoppeld\",\"code\":\"ACCOUNT_NOT_LINKED\"}");
        }
    }

    private boolean containsPlayerTag(JsonElement element, String playerTag) {
        if (element == null || element.isJsonNull()) return false;
        if (element.isJsonPrimitive() && element.getAsJsonPrimitive().isString()) {
            try { return playerTag.equals(CacheKeys.requireValidTag(element.getAsString())); }
            catch (IllegalArgumentException ignored) { return false; }
        }
        if (element.isJsonArray()) {
            for (JsonElement child : element.getAsJsonArray()) if (containsPlayerTag(child, playerTag)) return true;
            return false;
        }
        if (!element.isJsonObject()) return false;
        JsonObject object = element.getAsJsonObject();
        for (String key : List.of("tag", "playerTag", "accountTag", "clashTag")) {
            if (object.has(key) && containsPlayerTag(object.get(key), playerTag)) return true;
        }
        return false;
    }

    private String requiredQueryParameter(Map<String, String> parameters, String name) {
        String value = parameters.get(name);
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Queryparameter ontbreekt: " + name);
        return value;
    }

    private Map<String, String> queryParameters(String query) {
        Map<String, String> result = new HashMap<>();
        if (query == null || query.isBlank()) return result;
        for (String pair : query.split("&")) {
            String[] parts = pair.split("=", 2);
            String key = URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
            String value = parts.length > 1 ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8) : "";
            result.put(key, value);
        }
        return result;
    }

    private JsonObject metricsJson(Map<String, Long> metrics) {
        JsonObject result = new JsonObject();
        metrics.forEach(result::addProperty);
        return result;
    }

    private Map<String, Long> numericMap(JsonObject object) {
        Map<String, Long> result = new LinkedHashMap<>();
        for (Map.Entry<String, JsonElement> entry : object.entrySet()) {
            JsonElement value = entry.getValue();
            if (value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isNumber()) {
                result.put(entry.getKey(), Math.max(0, value.getAsLong()));
            }
        }
        return Map.copyOf(result);
    }

    private JsonObject historySummaryJson(Map<String, Long> metrics) {
        JsonObject result = new JsonObject();
        for (String key : List.of(
                "snapshot_import_count", "tracked_days", "tracked_progress_intervals",
                "tracked_home_building_levels", "tracked_home_trap_levels", "tracked_home_wall_levels",
                "tracked_home_hero_levels", "tracked_equipment_levels", "tracked_helper_levels",
                "tracked_army_levels", "tracked_builder_building_levels", "tracked_builder_wall_levels",
                "tracked_cosmetics_added", "tracked_active_upgrade_observations", "tracked_largest_progress_jump"
        )) result.addProperty(key, Math.max(0, metrics.getOrDefault(key, 0L)));
        return result;
    }

    private JsonElement parseAnyJson(String value) {
        if (value == null || value.isBlank()) return new JsonObject();
        return JsonParser.parseString(value);
    }

    private JsonElement firstOrNull(String jsonArray) {
        JsonArray values = JsonParser.parseString(jsonArray).getAsJsonArray();
        return values.isEmpty() ? com.google.gson.JsonNull.INSTANCE : values.get(0);
    }
}
