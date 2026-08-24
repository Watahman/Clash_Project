package Java.advancedstats;

import com.google.gson.JsonObject;

/** Removes internal adapter identifiers before compact metadata reaches a user-facing endpoint. */
final class AdvancedStatsPublicSourceMetadata {
    private AdvancedStatsPublicSourceMetadata() {}

    static JsonObject sanitizeOverview(JsonObject overview) {
        if (overview == null) return new JsonObject();
        JsonObject copy = overview.deepCopy();
        JsonObject tracking = object(copy, "tracking");
        sanitizeTracking(tracking);
        return copy;
    }

    private static void sanitizeTracking(JsonObject tracking) {
        if (tracking == null) return;
        sanitizeSource(object(tracking, "source"));
        if (!tracking.has("scopes") || !tracking.get("scopes").isJsonArray()) return;
        tracking.getAsJsonArray("scopes").forEach(item -> {
            if (!item.isJsonObject()) return;
            sanitizeTracking(object(item.getAsJsonObject(), "tracking"));
        });
    }

    private static void sanitizeSource(JsonObject source) {
        if (source == null) return;
        String internal = text(source, "sourceId");
        if (internal.isBlank()) internal = text(source, "source_id");
        if (internal.isBlank()) internal = text(source, "provider");
        AdvancedStatsSourcePresentation presentation =
                AdvancedStatsSourcePresentation.fromInternalId(internal);
        source.addProperty("provider", presentation.kind());
        source.addProperty("label", presentation.label());
        source.remove("sourceId");
        source.remove("source_id");
        source.remove("providerId");
        JsonObject provenance = object(source, "provenance");
        if (provenance != null) {
            provenance.remove("sourceId");
            provenance.remove("source_id");
            provenance.remove("provider");
        }
    }

    private static JsonObject object(JsonObject source, String field) {
        if (source == null || !source.has(field) || !source.get(field).isJsonObject()) return null;
        return source.getAsJsonObject(field);
    }

    private static String text(JsonObject source, String field) {
        if (source == null || !source.has(field) || source.get(field).isJsonNull()) return "";
        try {
            return source.get(field).getAsString().trim();
        } catch (RuntimeException ignored) {
            return "";
        }
    }
}
