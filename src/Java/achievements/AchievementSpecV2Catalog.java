package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.GZIPInputStream;

/**
 * Exact runtime projection generated from ClashPanel_Achievements_Seed_v2.json,
 * which accompanies ClashPanel_Advanced_Achievements_Spec_v2.md. The embedded
 * payload contains all evaluator fields, including subject scope, for the 340 catalog rows and 1,331 fixed
 * tiers. Do not hand-edit achievement content here; update the authoritative v2
 * source and regenerate this payload instead.
 */
public final class AchievementSpecV2Catalog {
    public static final int EXPECTED_FAMILY_COUNT = 340;
    public static final int EXPECTED_FIXED_TIER_COUNT = 1331;
    public static final String DYNAMIC_TEMPLATE_ID = "DYN_OFFICIAL_ACHIEVEMENT";

    private static final Catalog CATALOG = load();

    private AchievementSpecV2Catalog() {}

    public static List<AchievementDefinition> definitions() {
        return CATALOG.definitions();
    }

    public static Metadata metadata(String achievementKey) {
        return CATALOG.metadata().get(achievementKey);
    }

    public static int sourceFamilyCount() {
        return CATALOG.familyCount();
    }

    public static int sourceFixedTierCount() {
        return CATALOG.fixedTierCount();
    }

    public static boolean isDynamicTemplate(AchievementDefinition definition) {
        return definition != null && DYNAMIC_TEMPLATE_ID.equals(definition.familyKey());
    }

    private static Catalog load() {
        try {
            String json = inflate(GZIP_BASE64);
            JsonObject root = JsonParser.parseString(json).getAsJsonObject();
            int familyCount = root.get("familyCount").getAsInt();
            int fixedTierCount = root.get("fixedTierCount").getAsInt();
            if (familyCount != EXPECTED_FAMILY_COUNT || fixedTierCount != EXPECTED_FIXED_TIER_COUNT) {
                throw new IllegalStateException("Achievement spec header count mismatch");
            }

            List<AchievementDefinition> definitions = new ArrayList<>(fixedTierCount);
            Map<String, Metadata> metadata = new LinkedHashMap<>();
            JsonArray families = root.getAsJsonArray("families");
            if (families.size() != familyCount) {
                throw new IllegalStateException("Achievement spec family count mismatch: " + families.size());
            }

            for (JsonElement familyElement : families) {
                JsonObject family = familyElement.getAsJsonObject();
                String familyId = requiredString(family, "id");
                String familyName = requiredString(family, "name");
                String scope = requiredString(family, "scope");
                String categoryLabel = requiredString(family, "category");
                String description = requiredString(family, "description");
                String specMetric = requiredString(family, "metric");
                String evaluationMode = requiredString(family, "evaluationMode");
                String priority = requiredString(family, "priority");
                String notes = requiredString(family, "notes");
                List<String> sourceCodes = stringList(family.getAsJsonArray("sourceCodes"));
                AchievementSpecV2Bindings.Binding binding = AchievementSpecV2Bindings.forFamily(familyId);
                String category = categorySlug(categoryLabel);

                JsonArray tiers = family.getAsJsonArray("tiers");
                for (JsonElement tierElement : tiers) {
                    JsonObject tier = tierElement.getAsJsonObject();
                    int tierNumber = tier.get("tier").getAsInt();
                    String tierLabel = requiredString(tier, "label");
                    JsonElement threshold = tier.get("threshold");
                    String thresholdText = requiredString(tier, "thresholdText");
                    String rarity = requiredString(tier, "rarity").toLowerCase(Locale.ROOT);
                    int xp = tier.get("xp").getAsInt();
                    boolean simpleNumeric = threshold != null && threshold.isJsonPrimitive()
                            && threshold.getAsJsonPrimitive().isNumber();
                    boolean measurableRule = binding.supports(simpleNumeric, threshold);
                    long target = binding.target(threshold, measurableRule);
                    String achievementKey = familyId + "_" + tierNumber;

                    AchievementDefinition definition = new AchievementDefinition(
                            achievementKey,
                            familyId,
                            familyName,
                            description,
                            category,
                            rarity,
                            binding.metric(),
                            target,
                            tierNumber,
                            xp
                    );
                    definitions.add(definition);
                    metadata.put(achievementKey, new Metadata(
                            familyId,
                            familyName,
                            scope,
                            categoryLabel,
                            description,
                            specMetric,
                            sourceCodes,
                            evaluationMode,
                            priority,
                            notes,
                            tierLabel,
                            threshold == null ? null : threshold.deepCopy(),
                            thresholdText,
                            binding.comparison(),
                            measurableRule
                    ));
                }
            }

            if (definitions.size() != fixedTierCount || metadata.size() != fixedTierCount) {
                throw new IllegalStateException("Achievement spec tier count mismatch: " + definitions.size());
            }
            long uniqueFamilies = definitions.stream().map(AchievementDefinition::familyKey).distinct().count();
            if (uniqueFamilies != familyCount) {
                throw new IllegalStateException("Achievement spec unique family count mismatch: " + uniqueFamilies);
            }
            return new Catalog(List.copyOf(definitions), Map.copyOf(metadata), familyCount, fixedTierCount);
        } catch (Exception error) {
            throw new ExceptionInInitializerError(error);
        }
    }

    private static String inflate(String base64) throws Exception {
        byte[] compressed = Base64.getMimeDecoder().decode(base64);
        try (GZIPInputStream gzip = new GZIPInputStream(new ByteArrayInputStream(compressed));
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            gzip.transferTo(output);
            return output.toString(StandardCharsets.UTF_8);
        }
    }

    private static String requiredString(JsonObject object, String key) {
        JsonElement value = object.get(key);
        if (value == null || !value.isJsonPrimitive()) {
            throw new IllegalArgumentException("Missing achievement spec field: " + key);
        }
        return value.getAsString();
    }

    private static List<String> stringList(JsonArray array) {
        List<String> values = new ArrayList<>();
        if (array == null) return List.of();
        for (JsonElement value : array) values.add(value.getAsString());
        return List.copyOf(values);
    }

    private static String categorySlug(String value) {
        return value.toLowerCase(Locale.ROOT)
                .replace("&", " and ")
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
    }

    public record Metadata(
            String familyId,
            String familyName,
            String scope,
            String categoryLabel,
            String description,
            String specMetric,
            List<String> sourceCodes,
            String evaluationMode,
            String priority,
            String notes,
            String tierLabel,
            JsonElement threshold,
            String thresholdText,
            AchievementSpecV2Bindings.Comparison comparison,
            boolean measurableRule
    ) {
        public Metadata {
            sourceCodes = List.copyOf(sourceCodes == null ? List.of() : sourceCodes);
            threshold = threshold == null ? null : threshold.deepCopy();
        }
    }

    private record Catalog(
            List<AchievementDefinition> definitions,
            Map<String, Metadata> metadata,
            int familyCount,
            int fixedTierCount
    ) {}

    private static final String GZIP_BASE64 = """
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
f//3P60ag8ZB7gMA
""";
}
