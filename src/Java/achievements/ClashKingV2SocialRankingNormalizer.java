package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.HashSet;
import java.util.Set;

/** Normalizes public social totals, live rankings and legacy legend history. */
public final class ClashKingV2SocialRankingNormalizer {
    private ClashKingV2SocialRankingNormalizer() {}

    public record Slice(Map<String, Long> metrics, int records)
            implements ClashKingV2AchievementSlice {
        public Slice {
            metrics = Map.copyOf(metrics == null ? Map.of() : metrics);
        }
    }

    public static Slice joinLeaveTotals(JsonElement response) {
        JsonArray rows = items(response, "Join/leave response");
        long visits = 0L;
        long minutes = 0L;
        long longest = 0L;
        long returns = 0L;
        Set<String> clans = new HashSet<>();
        for (JsonElement element : rows) {
            JsonObject row = object(element, "Join/leave item");
            JsonObject clan = object(row.get("clan"), "Join/leave clan");
            String clanTag = ClashKingV2PlayerHistoryJson.requiredString(clan, "tag");
            ClashKingV2PlayerHistoryJson.requiredString(clan, "name");
            clans.add(ClashKingV2PlayerHistoryJson.normalizedTag(clanTag));
            long rowVisits = requiredNumber(row, "visits");
            long rowMinutes = requiredNumber(row, "minutes");
            visits = safeAdd(visits, rowVisits);
            minutes = safeAdd(minutes, rowMinutes);
            longest = Math.max(longest, rowMinutes);
            returns = safeAdd(returns, Math.max(0L, rowVisits - 1L));
        }
        Map<String, Long> metrics = new LinkedHashMap<>();
        metrics.put("social_clans_visited", (long) clans.size());
        metrics.put("social_clan_visits", visits);
        metrics.put("social_tenure_minutes", minutes);
        metrics.put("social_longest_clan_minutes", longest);
        metrics.put("social_returns", returns);
        metrics.put("soc_clans_visited", (long) clans.size());
        metrics.put("soc_returns", returns);
        metrics.put("soc_tenure_minutes", minutes);
        return new Slice(Map.copyOf(metrics), rows.size());
    }

    public static Slice rankings(JsonElement response, String requestedTag) {
        if (response == null || !response.isJsonObject()) throw new IllegalArgumentException("Rankings response is not an object");
        JsonObject root = response.getAsJsonObject();
        String actualTag = ClashKingV2PlayerHistoryJson.requiredString(root, "tag");
        if (!ClashKingV2PlayerHistoryJson.normalizedTag(requestedTag)
                .equals(ClashKingV2PlayerHistoryJson.normalizedTag(actualTag))) {
            throw new IllegalArgumentException("Rankings player tag mismatch");
        }
        Category home = category(root, "homeVillage");
        Category builder = category(root, "builderBase");
        long bestGlobal = minPositive(home.globalRank, builder.globalRank);
        long bestLocal = minPositive(home.localRank, builder.localRank);
        long doubleRank = bestGlobal > 0 && bestLocal > 0 ? 1L : 0L;
        Map<String, Long> metrics = new LinkedHashMap<>();
        addCategory(metrics, "home", home);
        addCategory(metrics, "builder", builder);
        metrics.put("ranking_best_global_rank", bestGlobal);
        metrics.put("ranking_best_local_rank", bestLocal);
        metrics.put("ranking_double_rank", doubleRank);
        metrics.put("tr_global_rank", bestGlobal);
        metrics.put("tr_local_rank", bestLocal);
        metrics.put("tr_double_rank", doubleRank);
        return new Slice(Map.copyOf(metrics), 1);
    }

    public static Slice legendHistory(LegendHistoryNormalizer.History history) {
        Map<String, Long> metrics = new LinkedHashMap<>();
        long seasons = history == null ? 0L : history.records().size();
        long bestTrophies = 0L;
        long bestRank = 0L;
        if (history != null) for (LegendHistoryNormalizer.SeasonRecord record : history.records()) {
            bestTrophies = Math.max(bestTrophies, value(record, "legend_best_season_trophies"));
            bestRank = minPositive(bestRank, value(record, "legend_best_season_rank"));
        }
        metrics.put("legend_ranked_seasons", seasons);
        metrics.put("legend_best_season_trophies", bestTrophies);
        metrics.put("legend_best_season_rank", bestRank);
        metrics.put("ranking_best_global_rank", bestRank);
        return new Slice(Map.copyOf(metrics), Math.toIntExact(seasons));
    }

    private static void addCategory(Map<String, Long> metrics, String prefix, Category category) {
        metrics.put("ranking_" + prefix + "_trophies", category.trophies);
        metrics.put("ranking_" + prefix + "_global_rank", category.globalRank);
        metrics.put("ranking_" + prefix + "_local_rank", category.localRank);
    }

    private static Category category(JsonObject root, String field) {
        JsonElement value = root.get(field);
        if (value == null || value.isJsonNull()) return new Category(0L, 0L, 0L);
        JsonObject object = object(value, "Ranking category");
        return new Category(
                optionalNumber(object, "trophies"),
                optionalNumber(object, "globalRank"),
                optionalNumber(object, "localRank")
        );
    }

    private static JsonArray items(JsonElement response, String label) {
        if (response == null || !response.isJsonObject()) throw new IllegalArgumentException(label + " is not an object");
        JsonElement value = response.getAsJsonObject().get("items");
        if (value == null || !value.isJsonArray()) throw new IllegalArgumentException(label + " has no items array");
        return value.getAsJsonArray();
    }

    private static JsonObject object(JsonElement value, String label) {
        if (value == null || !value.isJsonObject()) throw new IllegalArgumentException(label + " is not an object");
        return value.getAsJsonObject();
    }

    private static long requiredNumber(JsonObject object, String field) {
        Long value = ClashKingV2PlayerHistoryJson.optionalNumber(object, field);
        if (value == null) throw new IllegalArgumentException("Missing numeric field: " + field);
        return Math.max(0L, value);
    }

    private static long optionalNumber(JsonObject object, String field) {
        Long value = ClashKingV2PlayerHistoryJson.optionalNumber(object, field);
        return value == null ? 0L : Math.max(0L, value);
    }

    private static long value(LegendHistoryNormalizer.SeasonRecord record, String key) {
        return Math.max(0L, record.metrics().getOrDefault(key, 0L));
    }

    private static long minPositive(long left, long right) {
        if (left <= 0) return Math.max(0L, right);
        if (right <= 0) return left;
        return Math.min(left, right);
    }

    private static long safeAdd(long left, long right) {
        if (right <= 0) return left;
        if (Long.MAX_VALUE - left < right) return Long.MAX_VALUE;
        return left + right;
    }

    private record Category(long trophies, long globalRank, long localRank) {}
}
