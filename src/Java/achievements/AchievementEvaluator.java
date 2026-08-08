package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class AchievementEvaluator {
    public List<AchievementProgress> evaluate(Map<String, Long> metrics) {
        List<AchievementProgress> progress = new ArrayList<>();
        for (AchievementDefinition definition : AchievementCatalog.definitions()) {
            long value = Math.max(0, metrics.getOrDefault(definition.metric(), 0L));
            progress.add(new AchievementProgress(definition, value, value >= definition.target()));
        }
        return List.copyOf(progress);
    }

    public JsonArray toJson(List<AchievementProgress> values) {
        JsonArray result = new JsonArray();
        for (AchievementProgress value : values) {
            AchievementDefinition definition = value.definition();
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
            item.addProperty("source", AchievementSources.forMetric(definition.metric()));
            item.addProperty("progress", value.progress());
            item.addProperty("target", definition.target());
            item.addProperty("unlocked", value.unlocked());
            result.add(item);
        }
        return result;
    }
}
