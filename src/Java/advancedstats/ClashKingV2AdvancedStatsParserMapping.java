package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.AttackObservation;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;
import Java.advancedstats.AdvancedStatsHistoryModels.UnitObservation;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.integer;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.instant;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.longValue;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.number;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.object;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.percentage;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.positive;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.text;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.textPrimitive;

/** Converts one normalized ClashKing V2 row into an Advanced Stats observation. */
final class ClashKingV2AdvancedStatsParserMapping {
    private static final ArmyShareCodeParser ARMY_PARSER = new ArmyShareCodeParser();

    private ClashKingV2AdvancedStatsParserMapping() {}

    static AttackObservation normalObservation(JsonObject row, HistoryRequest request,
                                               String prefix, boolean defaultAttack) {
        Instant occurredAt = instant(row, request.requestedAt(),
                "battleTime", "time", "timestamp", "created_at");
        boolean attack = ClashKingV2AdvancedStatsParserIdentity.isAttack(row, defaultAttack);
        String id = text(row, "battle_id", "battleId", "id");
        String key = ClashKingV2AdvancedStatsParserIdentity.stableKey(prefix, id, row);
        LootValues loot = lootValues(row);
        return new AttackObservation(key, request.scope(), occurredAt, attack,
                text(row, "battle_type", "battleType", "type"), opponentTag(row),
                positive(integer(row, "player_townhall", "player_town_hall", "playerTownHall",
                        "townHallLevel", "townhallLevel")), opponentTownHall(row), integer(row, "stars"),
                percentage(row, "destruction_percentage", "destructionPercentage", "destruction"),
                units(row), loot.gold(), loot.elixir(), loot.darkElixir(), loot.available());
    }

    static AttackObservation leagueObservation(JsonObject row, String type, String season,
                                               HistoryRequest request) {
        Instant occurredAt = instant(row, request.requestedAt(), "time", "battleTime", "timestamp", "date");
        JsonObject opponent = object(row.get("opponent"));
        String opponentTag = firstText(text(opponent, "tag", "playerTag", "player_tag"),
                text(row, "opponentTag", "opponent_tag", "defenderTag"));
        Integer opponentTownHall = positive(integer(opponent, "townHallLevel", "townhallLevel", "town_hall_level"));
        if (opponentTownHall == null) opponentTownHall = positive(integer(row, "opponentTownHall", "opponent_townhall"));
        Integer playerTownHall = positive(integer(row, "townHallLevel", "townhallLevel", "town_hall_level"));
        String id = text(row, "battle_id", "battleId", "id", "battleKey", "key");
        String eventKey = ClashKingV2AdvancedStatsParserIdentity.leagueKey(type, season, id, opponentTag, row);
        LootValues loot = lootValues(row);
        return new AttackObservation(eventKey, request.scope(), occurredAt, true, type, opponentTag,
                playerTownHall, opponentTownHall, integer(row, "stars"),
                percentage(row, "destructionPercentage", "destruction_percentage", "destruction"),
                units(row), loot.gold(), loot.elixir(), loot.darkElixir(), loot.available());
    }

    static AttackObservation warObservation(JsonObject row, HistoryRequest request) {
        boolean attack = playerIsAttacker(row, request.playerTag());
        String side = attack ? "attack" : "defense";
        String warId = text(row, "war_id", "warId", "warTag");
        String order = text(row, "attackOrder", "attack_order", "order");
        if (order.isBlank()) order = text(row, "battle_id", "battleId", "id");
        if (order.isBlank()) order = stableWarOrder(row, request.playerTag());
        String eventKey = "war:" + (warId.isBlank() ? "unknown" : warId) + ":" + side + ":" + order;
        Instant occurredAt = instant(row, request.requestedAt(), "warEndTime", "war_end_time", "timestamp");
        String opponentTag = warOpponentTag(row, attack);
        Integer playerTownHall = warTownHall(row, attack);
        Integer opponentTownHall = warTownHall(row, !attack);
        return new AttackObservation(eventKey, AdvancedStatsScope.WAR, occurredAt, attack,
                text(row, "warType", "war_type", "type"), opponentTag, playerTownHall, opponentTownHall,
                integer(row, "stars"), percentage(row, "destructionPercentage", "destruction_percentage", "destruction"),
                units(row), loot(row, "gold", "gold_looted", "goldLooted"),
                loot(row, "elixir", "elixir_looted", "elixirLooted"),
                loot(row, "dark_elixir", "darkElixir", "dark_elixir_looted", "darkElixirLooted"), false);
    }

    private static boolean playerIsAttacker(JsonObject row, String playerTag) {
        String requested = ClashKingV2AdvancedStatsParserIdentity.canonicalTag(playerTag);
        String attacker = ClashKingV2AdvancedStatsParserIdentity.canonicalTag(
                text(row, "attackerTag", "attacker_tag"));
        String defender = ClashKingV2AdvancedStatsParserIdentity.canonicalTag(
                text(row, "defenderTag", "defender_tag"));
        if (!requested.isBlank() && requested.equals(attacker)) return true;
        if (!requested.isBlank() && requested.equals(defender)) return false;
        return ClashKingV2AdvancedStatsParserIdentity.isAttack(row, false);
    }

    private static Integer warTownHall(JsonObject row, boolean attacker) {
        String[] names = attacker
                ? new String[]{"attackerTownhall", "attackerTownHall", "attacker_th", "playerTownHall"}
                : new String[]{"defenderTownhall", "defenderTownHall", "defender_th", "opponentTownHall"};
        Integer value = integer(row, names);
        return value == null ? townHall(row, attacker) : positive(value);
    }

    private static String warOpponentTag(JsonObject row, boolean attack) {
        String[] names = attack
                ? new String[]{"defenderTag", "defender_tag", "opponentTag", "opponent_tag"}
                : new String[]{"attackerTag", "attacker_tag", "opponentTag", "opponent_tag"};
        return text(row, names);
    }

    private static String stableWarOrder(JsonObject row, String playerTag) {
        String basis = String.join("|", text(row, "war_id", "warId", "warTag"),
                text(row, "attackerTag", "attacker_tag"), text(row, "defenderTag", "defender_tag"),
                text(row, "warEndTime", "war_end_time", "timestamp"),
                ClashKingV2AdvancedStatsParserIdentity.canonicalTag(playerTag), text(row, "stars"),
                text(row, "destructionPercentage", "destruction_percentage"));
        return BattleFingerprint.sha256(basis);
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
        return value == null
                ? positive(integer(row, "opponent_townhall", "opponentTownHall", "defenderTownHall")) : value;
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

    private record LootValues(long gold, long elixir, long darkElixir, boolean available) {}

    private static LootValues lootValues(JsonObject row) {
        JsonObject reliable = object(row == null ? null : row.get("lootedResources"));
        if (reliable != null) {
            Long gold = firstLong(reliable, "gold", "gold_looted", "goldLooted");
            Long elixir = firstLong(reliable, "elixir", "elixir_looted", "elixirLooted");
            Long dark = firstLong(reliable, "darkElixir", "dark_elixir", "dark_elixir_looted", "darkElixirLooted");
            return new LootValues(nonNegative(gold), nonNegative(elixir), nonNegative(dark),
                    gold != null || elixir != null || dark != null);
        }
        return new LootValues(loot(row, "gold", "gold_looted", "goldLooted"),
                loot(row, "elixir", "elixir_looted", "elixirLooted"),
                loot(row, "dark_elixir", "darkElixir", "dark_elixir_looted", "darkElixirLooted"), false);
    }

    private static Long firstLong(JsonObject row, String... names) {
        Long value = longValue(row, names);
        return value == null || value < 0 ? null : value;
    }

    private static long nonNegative(Long value) {
        return value == null ? 0L : value;
    }

    private static long loot(JsonObject row, String... names) {
        for (JsonObject source : new JsonObject[]{row, object(row == null ? null : row.get("loot")),
                object(row == null ? null : row.get("lootedResources"))}) {
            Long value = longValue(source, names);
            if (value != null) return Math.max(0, value);
        }
        return 0;
    }

    private static String firstText(String first, String fallback) {
        return first.isBlank() ? fallback : first;
    }
}
