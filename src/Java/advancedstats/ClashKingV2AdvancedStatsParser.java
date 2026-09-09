package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.AttackObservation;
import Java.advancedstats.AdvancedStatsHistoryModels.Checkpoint;
import Java.advancedstats.AdvancedStatsHistoryModels.Coverage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryPage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;
import Java.advancedstats.AdvancedStatsHistoryModels.Provenance;
import Java.advancedstats.AdvancedStatsHistoryModels.UnitObservation;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.array;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.integer;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.instant;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.longValue;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.number;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.object;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.percentage;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.positive;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.text;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.textPrimitive;

/** Decodes ClashKing V2 normal, ranked/legend, and war payloads. */
final class ClashKingV2AdvancedStatsParser {
    private static final ArmyShareCodeParser ARMY_PARSER = new ArmyShareCodeParser();

    private ClashKingV2AdvancedStatsParser() {}

    static HistoryPage normal(JsonObject response, HistoryRequest request) {
        List<AttackObservation> observations = new ArrayList<>();
        JsonArray items = array(response, "items");
        for (int index = 0; index < items.size(); index++) {
            JsonObject row = object(items.get(index));
            if (row != null) observations.add(observation(row, request, "normal", index, true));
        }
        return page(observations, request, "v2-normal-history-v2",
                "GET /v2/player/{tag}/battlelog/history; local watermark; duration is transient");
    }

    /** Compatibility for the original ranked battlelogs envelope. */
    static HistoryPage ranked(JsonObject response, HistoryRequest request, long season) {
        List<AttackObservation> observations = new ArrayList<>();
        JsonArray items = array(response, "battlelogs");
        for (int index = 0; index < items.size(); index++) {
            JsonObject row = object(items.get(index));
            if (row != null && isAttack(row, false)) {
                observations.add(observation(row, request, "ranked-season:" + season, index, false));
            }
        }
        return page(observations, request, "v2-ranked-battlelog-v2",
                "GET /v2/player/{tag}/ranked/{season}/battlelog; attacks only; no cursor",
                numericSeason(Long.toString(season)));
    }

    /**
     * Merges the new ranked and legend envelopes into the existing RANKED scope.
     * Only rows under attacks are observations; defenses are intentionally ignored.
     */
    static HistoryPage league(JsonObject ranked, String seasonId, JsonObject legend, String day,
                              HistoryRequest request) {
        List<AttackObservation> observations = new ArrayList<>();
        appendLeagueAttacks(observations, ranked, "ranked", seasonId, day, request);
        appendLeagueAttacks(observations, legend, "legend", seasonId, day, request);
        String seasonKey = numericSeason(seasonId);
        return page(observations, request, "v2-league-battlelog-v1",
                "GET /v2/player/{tag}/ranked/{seasonId}/battlelog and /v2/player/{tag}/legend/{day}/battlelog; attacks only",
                seasonKey);
    }

    static HistoryPage war(JsonObject response, HistoryRequest request) {
        List<AttackObservation> observations = new ArrayList<>();
        JsonArray items = array(response, "items");
        for (int index = 0; index < items.size(); index++) {
            JsonObject row = object(items.get(index));
            if (row != null) observations.add(warObservation(row, request, index));
        }
        return page(observations, request, "v2-war-attacks-v2",
                "GET /v2/player/{tag}/war/attacks; no upstream cursor or total", "");
    }

    private static void appendLeagueAttacks(List<AttackObservation> target, JsonObject envelope,
                                            String type, String season, String day,
                                            HistoryRequest request) {
        JsonArray attacks = array(envelope, "attacks");
        for (int index = 0; index < attacks.size(); index++) {
            JsonObject row = object(attacks.get(index));
            if (row != null) target.add(leagueObservation(row, type, season, day, request, index));
        }
    }

    private static AttackObservation observation(JsonObject row, HistoryRequest request,
                                                 String prefix, int index, boolean defaultAttack) {
        Instant occurredAt = instant(row, request.requestedAt(),
                "battleTime", "time", "timestamp", "created_at");
        boolean attack = isAttack(row, defaultAttack);
        String id = text(row, "battle_id", "battleId", "id");
        String key = stableKey(prefix, id, occurredAt, row, index);
        return new AttackObservation(key, request.scope(), occurredAt, attack,
                text(row, "battle_type", "battleType", "type"), opponentTag(row),
                positive(integer(row, "player_townhall", "player_town_hall", "playerTownHall",
                        "townHallLevel", "townhallLevel")), opponentTownHall(row), integer(row, "stars"),
                percentage(row, "destruction_percentage", "destructionPercentage", "destruction"),
                units(row), loot(row, "gold", "gold_looted", "goldLooted"),
                loot(row, "elixir", "elixir_looted", "elixirLooted"),
                loot(row, "dark_elixir", "darkElixir", "dark_elixir_looted", "darkElixirLooted"));
    }

    private static AttackObservation leagueObservation(JsonObject row, String type, String season, String day,
                                                       HistoryRequest request, int index) {
        Instant occurredAt = instant(row, request.requestedAt(), "time", "battleTime", "timestamp", "date");
        JsonObject opponent = object(row.get("opponent"));
        String opponentTag = firstText(text(opponent, "tag", "playerTag", "player_tag"),
                text(row, "opponentTag", "opponent_tag", "defenderTag"));
        Integer opponentTownHall = positive(integer(opponent, "townHallLevel", "townhallLevel", "town_hall_level"));
        if (opponentTownHall == null) opponentTownHall = positive(integer(row, "opponentTownHall", "opponent_townhall"));
        Integer playerTownHall = positive(integer(row, "townHallLevel", "townhallLevel", "town_hall_level"));
        String id = text(row, "battle_id", "battleId", "id", "battleKey", "key");
        String eventKey = leagueKey(type, season, day, id, occurredAt, opponentTag, row, index);
        return new AttackObservation(eventKey, request.scope(), occurredAt, true, type, opponentTag,
                playerTownHall, opponentTownHall, integer(row, "stars"),
                percentage(row, "destructionPercentage", "destruction_percentage", "destruction"),
                units(row), loot(row, "gold", "gold_looted", "goldLooted"),
                loot(row, "elixir", "elixir_looted", "elixirLooted"),
                loot(row, "darkElixir", "dark_elixir", "dark_elixir_looted", "darkElixirLooted"));
    }

    private static AttackObservation warObservation(JsonObject row, HistoryRequest request, int index) {
        boolean attack = isAttack(row, false);
        String side = text(row, "side", "battle_side");
        String warId = text(row, "war_id", "warId", "warTag");
        String order = text(row, "attackOrder", "attack_order", "order");
        if (order.isBlank()) order = text(row, "battle_id", "battleId", "id");
        if (order.isBlank()) order = Integer.toString(index);
        String eventKey = "war:" + (warId.isBlank() ? "unknown" : warId) + ":"
                + (side.isBlank() ? (attack ? "attack" : "defense") : side) + ":" + order;
        Instant occurredAt = instant(row, request.requestedAt(), "warEndTime", "war_end_time", "timestamp");
        return new AttackObservation(eventKey, AdvancedStatsScope.WAR, occurredAt, attack,
                text(row, "warType", "war_type", "type"),
                text(row, "defenderTag", "defender_tag", "opponentTag", "opponent_tag"),
                townHall(row, true), townHall(row, false), integer(row, "stars"),
                percentage(row, "destructionPercentage", "destruction_percentage", "destruction"),
                units(row), loot(row, "gold", "gold_looted", "goldLooted"),
                loot(row, "elixir", "elixir_looted", "elixirLooted"),
                loot(row, "dark_elixir", "darkElixir", "dark_elixir_looted", "darkElixirLooted"));
    }

    private static Integer townHall(JsonObject row, boolean attacker) {
        String[] names = attacker
                ? new String[]{"attackerTownHall", "attackerTownhall", "attacker_th", "playerTownHall"}
                : new String[]{"defenderTownHall", "defenderTownhall", "defender_th", "opponentTownHall"};
        Integer value = integer(row, names);
        if (value != null) return positive(value);
        JsonObject ths = object(row == null ? null : row.get("THs"));
        if (ths == null) ths = object(row == null ? null : row.get("ths"));
        return ths == null ? null : positive(integer(ths, attacker ? "attacker" : "defender",
                attacker ? "player" : "opponent"));
    }

    private static String opponentTag(JsonObject row) {
        JsonObject opponent = object(row == null ? null : row.get("opponent"));
        return firstText(text(opponent, "tag", "playerTag", "player_tag"),
                text(row, "opponent_tag", "opponentTag", "defenderTag"));
    }

    private static Integer opponentTownHall(JsonObject row) {
        JsonObject opponent = object(row == null ? null : row.get("opponent"));
        Integer value = positive(integer(opponent, "townHallLevel", "townhallLevel", "town_hall_level"));
        if (value != null) return value;
        return positive(integer(row, "opponent_townhall", "opponentTownHall", "defenderTownHall"));
    }

    private static List<UnitObservation> units(JsonObject row) {
        String shareCode = text(row, "shareCode", "share_code", "army_share_code", "armyShareCode");
        if (!shareCode.isBlank()) {
            try {
                return ARMY_PARSER.parse(shareCode).units().stream()
                        .map(unit -> new UnitObservation(unit.unitKey(), unit.unitName(), unit.category(),
                                unit.quantity(), unit.unitLevel())).toList();
            } catch (Exception ignored) { /* Fall through to normalized arrays. */ }
        }
        return arrayUnits(row == null ? null : row.get("army_items"), row == null ? null : row.get("army_counts"));
    }

    private static List<UnitObservation> arrayUnits(JsonElement items, JsonElement counts) {
        if (items == null || items.isJsonNull()) return List.of();
        List<UnitObservation> result = new ArrayList<>();
        if (items.isJsonObject()) {
            for (var entry : items.getAsJsonObject().entrySet()) {
                int quantity = number(entry.getValue(), 0);
                if (quantity > 0) result.add(unit(entry.getKey(), entry.getKey(), quantity));
            }
            return List.copyOf(result);
        }
        if (!items.isJsonArray()) return List.of();
        JsonArray itemArray = items.getAsJsonArray();
        JsonArray countArray = counts != null && counts.isJsonArray() ? counts.getAsJsonArray() : null;
        JsonObject countObject = counts != null && counts.isJsonObject() ? counts.getAsJsonObject() : null;
        for (int index = 0; index < itemArray.size(); index++) {
            JsonElement item = itemArray.get(index);
            JsonObject itemObject = object(item);
            String key = itemObject == null ? textPrimitive(item) : text(itemObject, "id", "key", "unit_key", "name");
            int quantity = itemObject == null ? count(countObject, countArray, key, index)
                    : number(itemObject.get("count"), number(itemObject.get("quantity"), 0));
            if (!key.isBlank() && quantity > 0) result.add(unit(key, key, quantity));
        }
        return List.copyOf(result);
    }

    private static int count(JsonObject object, JsonArray array, String key, int index) {
        if (object != null) return number(object.get(key), 0);
        return array == null || index >= array.size() ? 0 : number(array.get(index), 0);
    }

    private static UnitObservation unit(String key, String name, int quantity) {
        return new UnitObservation(key, name, AdvancedStatsUnitCategory.TROOP, quantity, null);
    }

    private static long loot(JsonObject row, String... names) {
        for (JsonObject source : new JsonObject[]{row, object(row == null ? null : row.get("loot")),
                object(row == null ? null : row.get("lootedResources"))}) {
            Long value = longValue(source, names);
            if (value != null) return Math.max(0, value);
        }
        return 0;
    }

    private static HistoryPage page(List<AttackObservation> observations, HistoryRequest request,
                                    String version, String note, String rankedSeasonKey) {
        List<AttackObservation> filtered = observations.stream().filter(item -> after(item, request.checkpoint()))
                .sorted(Comparator.comparing(AttackObservation::occurredAt).thenComparing(AttackObservation::eventKey))
                .toList();
        Checkpoint next = filtered.stream()
                .max(Comparator.comparing(AttackObservation::occurredAt).thenComparing(AttackObservation::eventKey))
                .map(item -> new Checkpoint("", item.occurredAt(), item.eventKey()))
                .orElse(request.checkpoint());
        return new HistoryPage(filtered, next, false, Coverage.PARTIAL,
                new Provenance("clashking-v2", version, request.requestedAt(), note, rankedSeasonKey));
    }

    private static HistoryPage page(List<AttackObservation> observations, HistoryRequest request,
                                    String version, String note) {
        return page(observations, request, version, note, "");
    }

    private static boolean after(AttackObservation observation, Checkpoint checkpoint) {
        if (checkpoint == null || !checkpoint.present() || checkpoint.watermark() == null) return true;
        int time = observation.occurredAt().compareTo(checkpoint.watermark());
        return time > 0 || (time == 0 && observation.eventKey().compareTo(checkpoint.watermarkKey()) > 0);
    }

    private static boolean isAttack(JsonObject row, boolean defaultValue) {
        JsonElement value = row == null ? null : row.get("attack");
        if (value != null && !value.isJsonNull()) {
            try { return value.getAsBoolean(); } catch (RuntimeException ignored) { }
        }
        String side = text(row, "side", "battle_side").toLowerCase();
        if (side.contains("defen")) return false;
        if (side.contains("attack") || side.contains("offen")) return true;
        return defaultValue;
    }

    private static String stableKey(String prefix, String id, Instant time, JsonObject row, int index) {
        if (!id.isBlank()) return prefix + ":" + id;
        String basis = time + "|" + text(row, "shareCode", "share_code", "armyHash", "army_hash") + "|"
                + opponentTag(row) + "|" + row;
        return prefix + ":" + BattleFingerprint.sha256(basis) + ":" + index;
    }

    private static String firstText(String first, String fallback) {
        return first.isBlank() ? fallback : first;
    }

    private static String leagueKey(String type, String season, String day, String id, Instant time,
                                    String opponentTag, JsonObject row, int index) {
        String key = id.isBlank() ? BattleFingerprint.sha256(time + "|" + day + "|" + opponentTag + "|" + row)
                : id;
        String seasonKey = numericSeason(season);
        String prefix = "ranked-season:" + (seasonKey.isBlank() ? "unknown" : seasonKey);
        return prefix + ":" + type + ":" + key + (id.isBlank() ? ":" + index : "");
    }

    private static String numericSeason(String value) {
        if (value == null || !value.trim().matches("[1-9][0-9]{0,18}")) return "";
        return value.trim();
    }

    private static Integer positive(Integer value) { return value == null || value <= 0 ? null : value; }
}
