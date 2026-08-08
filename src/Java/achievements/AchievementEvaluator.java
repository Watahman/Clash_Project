package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class AchievementEvaluator {
    public List<AchievementProgress> evaluate(Map<String, Long> metrics) {
        List<AchievementProgress> progress = new ArrayList<>();
        Map<String, Long> values = metrics == null ? Map.of() : metrics;

        for (AchievementDefinition definition : AchievementCatalog.definitions()) {
            AchievementSpecV2Catalog.Metadata metadata = AchievementSpecV2Catalog.metadata(definition.key());
            boolean measurable = metadata != null
                    && metadata.measurableRule()
                    && values.containsKey(definition.metric());
            long value = measurable ? Math.max(0, values.getOrDefault(definition.metric(), 0L)) : 0L;
            boolean unlocked = measurable && switch (metadata.comparison()) {
                case GTE -> value >= definition.target();
                case LTE -> value > 0 && value <= definition.target();
                case BOOLEAN -> value > 0;
                case UNSUPPORTED -> false;
            };
            progress.add(new AchievementProgress(definition, value, unlocked, measurable));
        }
        return List.copyOf(progress);
    }

    public JsonArray toJson(List<AchievementProgress> values) {
        JsonArray result = new JsonArray();
        for (AchievementProgress value : values) {
            AchievementDefinition definition = value.definition();
            AchievementSpecV2Catalog.Metadata metadata = AchievementSpecV2Catalog.metadata(definition.key());
            JsonObject item = new JsonObject();
            item.addProperty("achievement_key", definition.key());
            item.addProperty("family_key", definition.familyKey());
            item.addProperty("title", definition.title());
            item.addProperty("description", definition.description());
            item.addProperty("category", definition.category());
            item.addProperty("rarity", definition.rarity());
            item.addProperty("tier", definition.tier());
            item.addProperty("xp", definition.xp());
            item.addProperty("metric", definition.metric());
            item.addProperty("source", AchievementSources.forDefinition(definition));
            item.addProperty("progress", value.progress());
            item.addProperty("target", definition.target());
            item.addProperty("unlocked", value.unlocked());
            item.addProperty("progress_known", value.measurable());
            item.addProperty("catalog_template", AchievementSpecV2Catalog.isDynamicTemplate(definition));

            if (metadata != null) {
                item.addProperty("category_label", metadata.categoryLabel());
                item.addProperty("spec_metric", metadata.specMetric());
                item.addProperty("evaluation_mode", metadata.evaluationMode());
                item.addProperty("priority", metadata.priority());
                item.addProperty("notes", metadata.notes());
                item.addProperty("tier_label", metadata.tierLabel());
                item.addProperty("threshold_text", metadata.thresholdText());
                if (metadata.threshold() != null) item.add("threshold", metadata.threshold().deepCopy());
                JsonArray sourceCodes = new JsonArray();
                metadata.sourceCodes().forEach(sourceCodes::add);
                item.add("source_codes", sourceCodes);
            }
            result.add(item);
        }
        return result;
    }

    /** Runtime badges required by spec v2 for official Supercell achievements. */
    public JsonArray dynamicOfficialAchievements(JsonArray officialAchievements, boolean sourceAvailable) {
        JsonArray result = new JsonArray();
        if (officialAchievements == null) return result;

        for (JsonElement element : officialAchievements) {
            if (!element.isJsonObject()) continue;
            JsonObject official = element.getAsJsonObject();
            String name = string(official, "name");
            if (name.isBlank()) continue;
            String village = string(official, "village");
            long progress = nonNegativeLong(official, "value");
            long target = nonNegativeLong(official, "target");
            String hash = stableOfficialHash(village, name);
            String key = "OFFICIAL_" + hash;

            JsonObject item = new JsonObject();
            item.addProperty("achievement_key", key);
            item.addProperty("family_key", key);
            item.addProperty("title", name);
            item.addProperty("description", firstNonBlank(string(official, "completionInfo"), string(official, "info")));
            item.addProperty("category", "dynamic_official_achievements");
            item.addProperty("category_label", "Dynamic official achievements");
            item.addProperty("rarity", "uncommon");
            item.addProperty("tier", 1);
            item.addProperty("xp", 100);
            item.addProperty("metric", "official:" + hash);
            item.addProperty("spec_metric", "achievement.value >= achievement.target");
            item.addProperty("source", AchievementSources.LIVE_PROFILE);
            item.addProperty("progress", progress);
            item.addProperty("target", Math.max(1L, target));
            item.addProperty("unlocked", sourceAvailable && target > 0 && progress >= target);
            item.addProperty("progress_known", sourceAvailable);
            item.addProperty("source_available", sourceAvailable);
            item.addProperty("has_stored_progress", false);
            item.addProperty("catalog_template", false);
            item.addProperty("dynamic_official", true);
            item.addProperty("evaluation_mode", "DIRECT");
            item.addProperty("priority", "P0");
            item.addProperty("tier_label", "Unlocked");
            item.addProperty("threshold_text", target > 0 ? String.valueOf(target) : "achievement target");
            JsonArray sourceCodes = new JsonArray();
            sourceCodes.add("COC-P");
            item.add("source_codes", sourceCodes);
            result.add(item);
        }
        return result;
    }

    private static String stableOfficialHash(String village, String name) {
        try {
            String normalized = village.trim().toLowerCase(Locale.ROOT)
                    + ":"
                    + name.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(normalized.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest).substring(0, 16);
        } catch (Exception impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }

    private static long nonNegativeLong(JsonObject object, String field) {
        JsonElement value = object.get(field);
        if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isNumber()) return 0L;
        return Math.max(0L, value.getAsLong());
    }

    private static String string(JsonObject object, String field) {
        JsonElement value = object.get(field);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isString()
                ? value.getAsString().trim()
                : "";
    }

    private static String firstNonBlank(String first, String second) {
        return first != null && !first.isBlank() ? first : second == null ? "" : second;
    }
}
