package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.AttackObservation;
import Java.advancedstats.AdvancedStatsHistoryModels.UnitObservation;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.Locale;

/** Produces durable dedupe keys from normalized observations, without retaining source payloads. */
public final class AdvancedStatsCompactEventFingerprint {
    private static final Comparator<UnitObservation> UNIT_ORDER = Comparator
            .comparing((UnitObservation unit) -> unit.category().name())
            .thenComparing(UnitObservation::unitKey)
            .thenComparingInt(UnitObservation::quantity);

    private AdvancedStatsCompactEventFingerprint() {}

    public static String forObservation(AttackObservation observation) {
        if (observation == null) throw new IllegalArgumentException("observation is required");
        NormalizedArmy army = normalizedArmy(observation);
        String opponent = observation.scope() == AdvancedStatsScope.WAR ? "" : canonicalTag(observation.opponentTag());
        String eventIdentity = observation.scope() == AdvancedStatsScope.WAR
                ? canonicalWarIdentity(observation.eventKey()) : "";
        String value = String.join("\u001f", observation.scope().apiValue(), observation.occurredAt().toString(),
                Boolean.toString(observation.attack()), opponent, eventIdentity, canonicalInteger(observation.stars()),
                canonicalNumber(observation.destructionPercentage()), Long.toString(observation.goldLooted()),
                Long.toString(observation.elixirLooted()), Long.toString(observation.darkElixirLooted()), army.hash());
        return sha256(value);
    }

    public static NormalizedArmy normalizedArmy(AttackObservation observation) {
        if (observation.units().isEmpty()) return NormalizedArmy.unavailable();
        JsonArray stableUnits = new JsonArray();
        JsonArray displayUnits = new JsonArray();
        observation.units().stream().sorted(UNIT_ORDER).forEach(unit -> {
            stableUnits.add(stableUnitJson(unit));
            displayUnits.add(unitJson(unit));
        });
        return new NormalizedArmy(sha256(stableUnits.toString()), displayUnits.toString(), true);
    }

    private static JsonObject stableUnitJson(UnitObservation unit) {
        JsonObject json = new JsonObject();
        json.addProperty("unit_key", unit.unitKey());
        json.addProperty("category", unit.category().name());
        json.addProperty("quantity", unit.quantity());
        return json;
    }

    private static JsonObject unitJson(UnitObservation unit) {
        JsonObject json = new JsonObject();
        json.addProperty("unit_key", unit.unitKey());
        json.addProperty("unit_name", unit.unitName());
        json.addProperty("category", unit.category().name());
        json.addProperty("quantity", unit.quantity());
        if (unit.level() != null) json.addProperty("level", unit.level());
        return json;
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }

    private static String canonicalTag(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private static String canonicalWarIdentity(String eventKey) {
        if (eventKey == null || eventKey.isBlank()) return "";
        String[] parts = eventKey.trim().split(":", 4);
        if (parts.length != 4 || !"war".equalsIgnoreCase(parts[0])) return "";
        String warId = canonicalTag(parts[1]);
        String side = parts[2].trim().toLowerCase(Locale.ROOT);
        String order = canonicalOrder(parts[3]);
        if (warId.isBlank() || order.isBlank()) return "";
        String canonicalSide = side.contains("defen") ? "defense"
                : side.contains("attack") || side.contains("offen") ? "attack" : side;
        return warId + "\u001f" + canonicalSide + "\u001f" + order;
    }

    private static String canonicalOrder(String value) {
        String normalized = value == null ? "" : value.trim();
        if (!normalized.matches("[0-9]+")) return normalized;
        return normalized.replaceFirst("^0+(?!$)", "");
    }

    private static String canonicalInteger(Integer value) {
        return value == null ? "" : Integer.toString(value);
    }

    private static String canonicalNumber(Double value) {
        return value == null ? "" : BigDecimal.valueOf(value).stripTrailingZeros().toPlainString();
    }

    public record NormalizedArmy(String hash, String json, boolean available) {
        public NormalizedArmy {
            hash = hash == null ? "" : hash.trim();
            json = json == null ? "" : json.trim();
            if (available && (hash.isBlank() || json.isBlank())) {
                throw new IllegalArgumentException("normalized army requires hash and json");
            }
            if (!available && (!hash.isBlank() || !json.isBlank())) {
                throw new IllegalArgumentException("unavailable army cannot contain payload");
            }
        }

        public static NormalizedArmy unavailable() {
            return new NormalizedArmy("", "", false);
        }
    }
}
