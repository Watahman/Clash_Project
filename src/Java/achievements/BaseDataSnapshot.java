package Java.achievements;

import Java.cache.CacheKeys;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;

public record BaseDataSnapshot(
        String playerTag,
        long sourceTimestamp,
        JsonObject payload,
        Map<String, Long> metrics,
        String checksum
) {
    private static final long MIN_TIMESTAMP = 1_577_836_800L;
    private static final long MAX_FUTURE_SECONDS = 172_800L;

    public static BaseDataSnapshot parse(JsonObject input) {
        if (input == null) throw new IllegalArgumentException("Base-data ontbreekt");

        JsonElement tagElement = input.get("tag");
        if (tagElement == null || !tagElement.isJsonPrimitive() || !tagElement.getAsJsonPrimitive().isString()) {
            throw new IllegalArgumentException("Base-data bevat geen geldige spelerstag");
        }
        String playerTag = CacheKeys.requireValidTag(tagElement.getAsString());

        JsonElement timestampElement = input.get("timestamp");
        if (timestampElement == null || !timestampElement.isJsonPrimitive() || !timestampElement.getAsJsonPrimitive().isNumber()) {
            throw new IllegalArgumentException("Base-data bevat geen geldige timestamp");
        }
        long timestamp = timestampElement.getAsLong();
        long now = Instant.now().getEpochSecond();
        if (timestamp < MIN_TIMESTAMP || timestamp > now + MAX_FUTURE_SECONDS) {
            throw new IllegalArgumentException("Base-data timestamp valt buiten het toegestane bereik");
        }

        int recognizedSections = 0;
        String[] requiredEvidence = {"buildings", "units", "heroes", "buildings2", "equipment"};
        for (String section : requiredEvidence) {
            JsonElement element = input.get(section);
            if (element != null && element.isJsonArray()) recognizedSections++;
        }
        if (recognizedSections < 2) {
            throw new IllegalArgumentException("JSON lijkt geen volledige Clash of Clans base-data export te zijn");
        }

        JsonObject payload = input.deepCopy();
        Map<String, Long> metrics = AchievementBaseSnapshotMetrics.enrich(
                payload,
                BaseDataMetrics.extract(payload)
        );
        return new BaseDataSnapshot(playerTag, timestamp, payload, metrics, sha256(payload.toString()));
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception impossible) {
            throw new IllegalStateException("SHA-256 is niet beschikbaar", impossible);
        }
    }
}
