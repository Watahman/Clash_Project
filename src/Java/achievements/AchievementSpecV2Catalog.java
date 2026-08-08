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
 * Exact runtime catalog generated from ClashPanel_Advanced_Achievements_Spec_v2.md.
 * The embedded payload contains the 340 catalog rows and 1,331 fixed tiers from
 * the specification. Do not hand-edit achievement content here; update the source
 * specification and regenerate this payload instead.
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
""";
}
