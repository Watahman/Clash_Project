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
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Decodes the three route-specific V2 payloads into transient attack observations. */
final class ClashKingV2AdvancedStatsParser {
    private static final ArmyShareCodeParser ARMY_PARSER = new ArmyShareCodeParser();
    private static final List<DateTimeFormatter> CLASH_TIME_FORMATS = List.of(
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss.SSSX").withZone(ZoneOffset.UTC),
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmssX").withZone(ZoneOffset.UTC)
    );

    private ClashKingV2AdvancedStatsParser() {}

    static HistoryPage normal(JsonObject response, HistoryRequest request) {
        JsonArray items = array(response, "items");
        List<AttackObservation> observations = new ArrayList<>();
        for (int index = 0; index < items.size(); index++) {
            if (items.get(index).isJsonObject()) {
                observations.add(observation(items.get(index), request, "normal", index));
            }
        }
        return page(observations, request, "v2-normal-history-v1",
                "GET /v2/player/{tag}/battlelog/history; no upstream cursor or total");
    }

    static HistoryPage ranked(JsonObject response, HistoryRequest request, long season) {
        JsonArray items = array(response, "battlelogs");
        List<AttackObservation> observations = new ArrayList<>();
        for (int index = 0; index < items.size(); index++) {
            JsonElement value = items.get(index);
            if (!value.isJsonObject() || !isAttack(value.getAsJsonObject(), false)) continue;
            observations.add(observation(value, request, "ranked-season:" + season, index));
        }
        return page(observations, request, "v2-ranked-battlelog-v1",
                "GET /v2/player/{tag}/ranked/{season}/battlelog; season is explicit; no cursor",
                Long.toString(season));
    }

    static HistoryPage war(JsonObject response, HistoryRequest request) {
        JsonArray items = array(response, "items");
        List<AttackObservation> observations = new ArrayList<>();
        for (int index = 0; index < items.size(); index++) {
            if (items.get(index).isJsonObject()) {
                observations.add(warObservation(items.get(index), request, index));
            }
        }
        return page(observations, request, "v2-war-attacks-v1",
                "GET /v2/player/{tag}/war/attacks; no upstream cursor or total", "");
    }

    private static AttackObservation observation(JsonElement value, HistoryRequest request,
                                                 String prefix, int index) {
        JsonObject row = object(value);
        Instant occurredAt = instant(row, request.requestedAt(), "timestamp", "time", "created_at");
        String id = text(row, "battle_id", "battleId", "id");
        if (id.isBlank()) id = prefix + ":" + occurredAt + ":" + index;
        boolean attack = isAttack(row, true);
        return new AttackObservation(prefix + ":" + id, request.scope(), occurredAt, attack,
                text(row, "battle_type", "battleType", "type"),
                text(row, "opponent_tag", "opponentTag", "defenderTag"),
                positive(integer(row, "player_townhall", "player_town_hall", "playerTownHall", "attackerTownHall")),
                positive(integer(row, "opponent_townhall", "opponent_town_hall", "opponentTownHall", "defenderTownHall")),
                integer(row, "stars"), decimal(row, "destruction_percentage", "destructionPercentage", "destruction"),
                units(row), loot(row, "gold", "gold_looted", "goldLooted"),
                loot(row, "elixir", "elixir_looted", "elixirLooted"),
                loot(row, "dark_elixir", "darkElixir", "dark_elixir_looted", "darkElixirLooted"));
    }

    private static AttackObservation warObservation(JsonElement value, HistoryRequest request, int index) {
        JsonObject row = object(value);
        boolean attack = isAttack(row, false);
        String side = text(row, "side", "battle_side");
        String warId = text(row, "war_id", "warId", "warTag");
        String order = text(row, "attackOrder", "attack_order", "order");
        if (order.isBlank()) order = text(row, "battle_id", "battleId", "id");
        if (order.isBlank()) order = Integer.toString(index);
        String eventKey = "war:" + (warId.isBlank() ? "unknown" : warId)
                + ":" + (side.isBlank() ? (attack ? "attack" : "defense") : side) + ":" + order;
        Instant occurredAt = instant(row, request.requestedAt(), "warEndTime", "war_end_time", "timestamp");
        Integer playerTh = townHall(row, true);
        Integer opponentTh = townHall(row, false);
        return new AttackObservation(eventKey, AdvancedStatsScope.WAR, occurredAt, attack,
                text(row, "warType", "war_type", "type"),
                text(row, "defenderTag", "defender_tag", "opponentTag", "opponent_tag"),
                playerTh, opponentTh, integer(row, "stars"),
                decimal(row, "destructionPercentage", "destruction_percentage", "destruction"),
                units(row), loot(row, "gold", "gold_looted", "goldLooted"),
                loot(row, "elixir", "elixir_looted", "elixirLooted"),
                loot(row, "dark_elixir", "darkElixir", "dark_elixir_looted", "darkElixirLooted"));
    }

    private static Integer townHall(JsonObject row, boolean attacker) {
        String[] direct = attacker
                ? new String[]{"attackerTownHall", "attackerTownhall", "attacker_th", "playerTownHall"}
                : new String[]{"defenderTownHall", "defenderTownhall", "defender_th", "opponentTownHall"};
        Integer value = integer(row, direct);
        if (value != null) return positive(value);
        JsonObject ths = object(row.get("THs"));
        if (ths == null) ths = object(row.get("ths"));
        if (ths == null) return null;
        return positive(integer(ths, attacker ? "attacker" : "defender",
                attacker ? "player" : "opponent"));
    }

    private static List<UnitObservation> units(JsonObject row) {
        if (row == null) return List.of();
        String shareCode = text(row, "army_share_code", "armyShareCode");
        if (!shareCode.isBlank()) {
            try {
                return ARMY_PARSER.parse(shareCode).units().stream()
                        .map(unit -> new UnitObservation(unit.unitKey(), unit.unitName(), unit.category(),
                                unit.quantity(), unit.unitLevel())).toList();
            } catch (Exception ignored) {
                // Fall through to the normalized item/count arrays when available.
            }
        }
        return arrayUnits(row.get("army_items"), row.get("army_counts"));
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
            String key = item.isJsonObject() ? text(item.getAsJsonObject(), "id", "key", "unit_key", "name")
                    : item.isJsonPrimitive() ? item.getAsString() : "";
            int quantity = item.isJsonObject()
                    ? number(item.getAsJsonObject().get("count"),
                    number(item.getAsJsonObject().get("quantity"), 0))
                    : countObject != null ? number(countObject.get(key), 0)
                    : countArray == null || index >= countArray.size() ? 0
                    : number(countArray.get(index), 0);
            if (!key.isBlank() && quantity > 0) result.add(unit(key, key, quantity));
        }
        return List.copyOf(result);
    }

    private static UnitObservation unit(String key, String name, int quantity) {
        return new UnitObservation(key, name, AdvancedStatsUnitCategory.TROOP, quantity, null);
    }

    private static long loot(JsonObject row, String... names) {
        if (row == null) return 0;
        JsonObject loot = object(row.get("loot"));
        Long direct = longValue(row, names);
        if (direct != null) return Math.max(0, direct);
        if (loot == null) return 0;
        for (String name : names) {
            Long nested = longValue(loot, name);
            if (nested != null) return Math.max(0, nested);
        }
        return 0;
    }

    private static HistoryPage page(List<AttackObservation> observations, HistoryRequest request,
                                    String version, String note) {
        return page(observations, request, version, note, "");
    }

    private static HistoryPage page(List<AttackObservation> observations, HistoryRequest request,
                                    String version, String note, String rankedSeasonKey) {
        List<AttackObservation> filtered = observations.stream()
                .filter(item -> after(item, request.checkpoint())).toList();
        Checkpoint next = filtered.stream()
                .max(Comparator.comparing(AttackObservation::occurredAt).thenComparing(AttackObservation::eventKey))
                .map(item -> new Checkpoint("", item.occurredAt(), item.eventKey()))
                .orElse(request.checkpoint());
        return new HistoryPage(filtered, next, false, Coverage.PARTIAL,
                new Provenance("clashking-v2", version, request.requestedAt(), note, rankedSeasonKey));
    }

    private static boolean after(AttackObservation observation, Checkpoint checkpoint) {
        if (checkpoint == null || !checkpoint.present() || checkpoint.watermark() == null) return true;
        int time = observation.occurredAt().compareTo(checkpoint.watermark());
        return time > 0 || (time == 0 && observation.eventKey().compareTo(checkpoint.watermarkKey()) > 0);
    }

    private static boolean isAttack(JsonObject row, boolean defaultValue) {
        if (row == null) return defaultValue;
        JsonElement value = row.get("attack");
        if (value != null && !value.isJsonNull()) return value.getAsBoolean();
        String side = text(row, "side", "battle_side").toLowerCase();
        if (side.contains("defen")) return false;
        if (side.contains("attack") || side.contains("offen")) return true;
        return defaultValue;
    }

    private static JsonArray array(JsonObject row, String name) {
        JsonElement value = row == null ? null : row.get(name);
        return value != null && value.isJsonArray() ? value.getAsJsonArray() : new JsonArray();
    }

    private static JsonObject object(JsonElement value) {
        return value != null && value.isJsonObject() ? value.getAsJsonObject() : null;
    }

    private static String text(JsonObject row, String... names) {
        if (row == null) return "";
        for (String name : names) {
            JsonElement value = row.get(name);
            if (value != null && !value.isJsonNull() && value.isJsonPrimitive()) return value.getAsString().trim();
        }
        return "";
    }

    private static Integer integer(JsonObject row, String... names) {
        if (row == null) return null;
        for (String name : names) {
            JsonElement value = row.get(name);
            if (value == null || value.isJsonNull()) continue;
            try { return value.getAsInt(); } catch (RuntimeException ignored) { }
        }
        return null;
    }

    private static Double decimal(JsonObject row, String... names) {
        if (row == null) return null;
        for (String name : names) {
            JsonElement value = row.get(name);
            if (value == null || value.isJsonNull()) continue;
            try { return value.getAsDouble(); } catch (RuntimeException ignored) { }
        }
        return null;
    }

    private static int number(JsonElement value, int fallback) {
        if (value == null || value.isJsonNull()) return fallback;
        try { return value.getAsInt(); } catch (RuntimeException ignored) { return fallback; }
    }

    private static Long longValue(JsonObject row, String... names) {
        if (row == null) return null;
        for (String name : names) {
            JsonElement value = row.get(name);
            if (value == null || value.isJsonNull()) continue;
            try { return value.getAsLong(); } catch (RuntimeException ignored) { }
        }
        return null;
    }

    private static Instant instant(JsonObject row, Instant fallback, String... names) {
        String value = text(row, names);
        if (value.isBlank()) return fallback;

        if (value.chars().allMatch(Character::isDigit)) {
            try {
                long timestamp = Long.parseLong(value);
                return Instant.ofEpochSecond(timestamp > 10_000_000_000L ? timestamp / 1000 : timestamp);
            } catch (NumberFormatException ignored) {
                // Continue with textual timestamp formats.
            }
        }

        try {
            return Instant.parse(value);
        } catch (DateTimeParseException ignored) {
            // Continue with other documented/upstream timestamp formats.
        }

        try {
            return OffsetDateTime.parse(value).toInstant();
        } catch (DateTimeParseException ignored) {
            // Clash war history also returns compact timestamps such as 20260809T200137.000Z.
        }

        for (DateTimeFormatter formatter : CLASH_TIME_FORMATS) {
            try {
                return Instant.from(formatter.parse(value));
            } catch (DateTimeParseException ignored) {
                // Try the next known Clash timestamp format.
            }
        }

        throw new IllegalArgumentException("Unsupported ClashKing timestamp: " + value);
    }

    private static Integer positive(Integer value) {
        return value == null || value <= 0 ? null : value;
    }
}
