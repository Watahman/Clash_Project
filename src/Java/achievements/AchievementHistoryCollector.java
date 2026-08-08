package Java.achievements;

import Java.API_Utils;
import Java.Config;
import Java.cache.CachePolicy;
import Java.cwlhistory.HistoricalCwlProviderFactory;
import Java.cwlhistory.HistoricalCwlSeason;
import Java.cwlhistory.HistoricalCwlSeasonSummary;
import Java.cwlhistory.HistoricalCwlService;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class AchievementHistoryCollector {
    public record RefreshResult(
            boolean changed,
            int cwlProcessed,
            int cwlRemaining,
            boolean cwlAvailable,
            boolean warAvailable,
            String cwlError,
            String warError
    ) {}

    private static final int CWL_BATCH_SIZE = 4;
    private static final int PERFECT_CWL_ATTACKS = 7;
    private final API_Utils utils;
    private final AchievementSourceCache cache = new AchievementSourceCache();
    private final HistoricalCwlService cwlService;

    public AchievementHistoryCollector(Config config) {
        this.utils = new API_Utils(config);
        this.cwlService = new HistoricalCwlService(HistoricalCwlProviderFactory.create(config));
    }

    public RefreshResult refresh(
            String userId,
            String playerTag,
            String clanTag
    ) {
        if (clanTag == null || clanTag.isBlank()) {
            return new RefreshResult(false, 0, 0, false, false, "NO_CLAN", "NO_CLAN");
        }

        boolean changed = false;
        int cwlProcessed = 0;
        int cwlRemaining = 0;
        boolean cwlAvailable = false;
        boolean warAvailable = false;
        String cwlError = "";
        String warError = "";

        try {
            CwlRefresh cwl = refreshCwl(userId, playerTag, clanTag);
            changed |= cwl.changed();
            cwlProcessed = cwl.processed();
            cwlRemaining = cwl.remaining();
            cwlAvailable = true;
        } catch (Exception error) {
            cwlError = sourceError(error);
            safeMarkFailure(userId, playerTag, AchievementSources.CWL, clanTag, cwlError);
        }

        try {
            changed |= refreshCurrentWar(userId, playerTag, clanTag);
            warAvailable = true;
        } catch (Exception error) {
            warError = sourceError(error);
            safeMarkFailure(userId, playerTag, AchievementSources.WAR, clanTag, warError);
        }

        return new RefreshResult(
                changed,
                cwlProcessed,
                cwlRemaining,
                cwlAvailable,
                warAvailable,
                cwlError,
                warError
        );
    }

    private CwlRefresh refreshCwl(
            String userId,
            String playerTag,
            String clanTag
    ) throws Exception {
        Map<String, AchievementSourceCache.RecordState> stored = cache.records(
                userId, playerTag, AchievementSources.CWL, clanTag
        );
        List<HistoricalCwlSeasonSummary> available = new ArrayList<>(
                cwlService.getAvailableSeasons(clanTag, HistoricalCwlService.MAX_SEASON_LIMIT)
        );
        available.sort(Comparator.comparing(HistoricalCwlSeasonSummary::season).reversed());

        List<HistoricalCwlSeasonSummary> pending = new ArrayList<>();
        for (HistoricalCwlSeasonSummary summary : available) {
            AchievementSourceCache.RecordState existing = stored.get(summary.season());
            if (existing == null || !bool(existing.metadata(), "final")) pending.add(summary);
        }

        int processed = 0;
        boolean changed = false;
        for (HistoricalCwlSeasonSummary summary : pending) {
            if (processed >= CWL_BATCH_SIZE) break;
            HistoricalCwlSeason season = cwlService.getSeason(clanTag, summary.season());
            Map<String, Long> metrics = cwlMetrics(season, playerTag);
            JsonObject metadata = new JsonObject();
            metadata.addProperty("season", season.season());
            metadata.addProperty("final", cwlSeasonFinal(season));
            metadata.addProperty("playerPresent", metrics.getOrDefault("cwl_seasons_played", 0L) > 0);
            metadata.addProperty("dataQuality", season.dataQuality() == null ? "" : season.dataQuality());
            metadata.addProperty("warDetailsComplete", season.warDetailsComplete());
            cache.upsertRecord(
                    userId,
                    playerTag,
                    AchievementSources.CWL,
                    clanTag,
                    summary.season(),
                    null,
                    metrics,
                    metadata
            );
            processed++;
            changed = true;
        }

        int remaining = Math.max(0, pending.size() - processed);
        JsonObject cursor = new JsonObject();
        if (!available.isEmpty()) cursor.addProperty("latestSeason", available.getFirst().season());
        JsonObject coverage = new JsonObject();
        coverage.addProperty("availableRecords", available.size());
        coverage.addProperty("cachedRecords", Math.min(available.size(), stored.size() + processed));
        coverage.addProperty("remainingRecords", remaining);
        coverage.addProperty("backfillComplete", remaining == 0);
        coverage.addProperty("batchSize", CWL_BATCH_SIZE);
        cache.markChecked(
                userId,
                playerTag,
                AchievementSources.CWL,
                clanTag,
                cursor,
                coverage,
                null
        );
        return new CwlRefresh(changed, processed, remaining);
    }

    private boolean refreshCurrentWar(
            String userId,
            String playerTag,
            String clanTag
    ) throws Exception {
        String path = "/clans/"
                + URLEncoder.encode(clanTag, StandardCharsets.UTF_8)
                + "/currentwar";
        JsonObject war = JsonParser.parseString(
                utils.clashGetCachedValue(path, CachePolicy.CLAN_CURRENT_WAR)
        ).getAsJsonObject();

        String state = string(war, "state");
        JsonObject cursor = new JsonObject();
        cursor.addProperty("state", state);
        JsonObject coverage = new JsonObject();

        if (state.equalsIgnoreCase("notInWar") || state.isBlank()) {
            coverage.addProperty("currentWarFound", false);
            cache.markChecked(
                    userId, playerTag, AchievementSources.WAR, clanTag,
                    cursor, coverage, null
            );
            return false;
        }

        String recordKey = firstNonBlank(
                string(war, "preparationStartTime"),
                string(war, "startTime"),
                string(war, "endTime") + ":" + nestedString(war, "opponent", "tag")
        );
        if (recordKey.isBlank()) recordKey = Integer.toHexString(war.toString().hashCode());
        cursor.addProperty("recordKey", recordKey);

        Map<String, AchievementSourceCache.RecordState> stored = cache.records(
                userId, playerTag, AchievementSources.WAR, clanTag
        );
        AchievementSourceCache.RecordState existing = stored.get(recordKey);
        boolean finalWar = state.equalsIgnoreCase("warEnded");
        if (existing != null && bool(existing.metadata(), "final") && finalWar) {
            coverage.addProperty("currentWarFound", true);
            coverage.addProperty("cachedFinal", true);
            cache.markChecked(
                    userId, playerTag, AchievementSources.WAR, clanTag,
                    cursor, coverage, null
            );
            return false;
        }

        Map<String, Long> metrics = regularWarMetrics(war, playerTag);
        JsonObject metadata = new JsonObject();
        metadata.addProperty("final", finalWar);
        metadata.addProperty("state", state);
        metadata.addProperty("playerPresent", metrics.getOrDefault("war_recorded_wars", 0L) > 0);
        metadata.addProperty("opponentTag", nestedString(war, "opponent", "tag"));
        cache.upsertRecord(
                userId,
                playerTag,
                AchievementSources.WAR,
                clanTag,
                recordKey,
                null,
                metrics,
                metadata
        );
        coverage.addProperty("currentWarFound", true);
        coverage.addProperty("cachedFinal", finalWar);
        cache.markChecked(
                userId, playerTag, AchievementSources.WAR, clanTag,
                cursor, coverage, null
        );
        return true;
    }

    private Map<String, Long> cwlMetrics(HistoricalCwlSeason season, String playerTag) {
        Map<String, Long> metrics = new LinkedHashMap<>();
        boolean rostered = season.roster().stream().anyMatch(player -> sameTag(player.tag(), playerTag));
        long warsPlayed = 0;
        long attacks = 0;
        long stars = 0;
        long triples = 0;
        long twos = 0;
        long perfectAttacks = 0;
        long uphitTriples = 0;
        boolean allAttacksPerfect = true;

        for (HistoricalCwlSeason.War war : season.wars()) {
            HistoricalCwlSeason.Member member = findMember(war.clan(), playerTag);
            if (member == null) continue;
            warsPlayed++;
            if (member.attacks().isEmpty()) allAttacksPerfect = false;
            for (HistoricalCwlSeason.Attack attack : member.attacks()) {
                attacks++;
                stars += Math.max(0, attack.stars());
                if (attack.stars() == 3) triples++;
                if (attack.stars() == 2) twos++;
                boolean perfect = attack.stars() == 3 && attack.destruction() >= 99.999;
                if (perfect) perfectAttacks++;
                else allAttacksPerfect = false;
                if (attack.stars() == 3 && attack.attackerTownHall() < attack.defenderTownHall()) {
                    uphitTriples++;
                }
            }
        }

        boolean playedSeason = rostered || warsPlayed > 0;
        long clanWins = playedSeason && season.record() != null
                ? Math.max(0, season.record().wins())
                : 0;
        boolean perfectSeason = playedSeason
                && season.warDetailsComplete()
                && attacks == PERFECT_CWL_ATTACKS
                && triples == PERFECT_CWL_ATTACKS
                && stars == PERFECT_CWL_ATTACKS * 3L
                && allAttacksPerfect;
        boolean podium = playedSeason
                && season.position() != null
                && season.position() > 0
                && season.position() <= 3;

        metrics.put("cwl_seasons_played", playedSeason ? 1L : 0L);
        metrics.put("cwl_wars_played", warsPlayed);
        metrics.put("cwl_attacks", attacks);
        metrics.put("cwl_stars", stars);
        metrics.put("cwl_three_stars", triples);
        metrics.put("cwl_two_stars", twos);
        metrics.put("cwl_perfect_attacks", perfectAttacks);
        metrics.put("cwl_uphit_three_stars", uphitTriples);
        metrics.put("cwl_perfect_seasons", perfectSeason ? 1L : 0L);
        metrics.put("cwl_clan_wins", clanWins);
        metrics.put("cwl_top3_finishes", podium ? 1L : 0L);
        metrics.put("fun_cwl_cleaner", perfectAttacks);
        return Map.copyOf(metrics);
    }

    private Map<String, Long> regularWarMetrics(JsonObject war, String playerTag) {
        Map<String, Long> metrics = new LinkedHashMap<>();
        JsonObject clan = object(war.get("clan"));
        JsonObject member = findMember(clan, playerTag);
        if (member == null) {
            metrics.put("war_recorded_wars", 0L);
            return Map.copyOf(metrics);
        }

        long attacks = 0;
        long stars = 0;
        long destruction = 0;
        long triples = 0;
        long twos = 0;
        long uphitTriples = 0;
        int attackerTownHall = integer(member, "townhallLevel", "townHallLevel");
        JsonArray attackRows = array(member.get("attacks"));
        JsonArray opponents = array(object(war.get("opponent")).get("members"));

        for (JsonElement element : attackRows) {
            if (!element.isJsonObject()) continue;
            JsonObject attack = element.getAsJsonObject();
            attacks++;
            int attackStars = integer(attack, "stars");
            stars += Math.max(0, attackStars);
            destruction += Math.max(0, Math.round(number(attack, "destructionPercentage")));
            if (attackStars == 3) triples++;
            if (attackStars == 2) twos++;
            String defenderTag = string(attack, "defenderTag");
            int defenderTownHall = memberTownHall(opponents, defenderTag);
            if (attackStars == 3 && attackerTownHall > 0 && defenderTownHall > attackerTownHall) uphitTriples++;
        }

        metrics.put("war_recorded_wars", 1L);
        metrics.put("war_recorded_attacks", attacks);
        metrics.put("war_recorded_stars", stars);
        metrics.put("war_recorded_destruction", destruction);
        metrics.put("war_recorded_three_stars", triples);
        metrics.put("war_recorded_two_stars", twos);
        metrics.put("war_recorded_uphit_three_stars", uphitTriples);
        return Map.copyOf(metrics);
    }

    private boolean cwlSeasonFinal(HistoricalCwlSeason season) {
        try {
            YearMonth month = YearMonth.parse(season.season());
            if (month.isBefore(YearMonth.now())) return true;
        } catch (RuntimeException ignored) {
            // Fall back to war states below.
        }
        return !season.wars().isEmpty() && season.wars().stream().allMatch(war -> {
            String state = war.state() == null ? "" : war.state().toLowerCase();
            return state.contains("ended") || state.contains("warended");
        });
    }

    private HistoricalCwlSeason.Member findMember(HistoricalCwlSeason.WarSide side, String playerTag) {
        if (side == null) return null;
        return side.members().stream()
                .filter(member -> sameTag(member.tag(), playerTag))
                .findFirst()
                .orElse(null);
    }

    private JsonObject findMember(JsonObject side, String playerTag) {
        for (JsonElement element : array(side.get("members"))) {
            if (!element.isJsonObject()) continue;
            JsonObject member = element.getAsJsonObject();
            if (sameTag(string(member, "tag"), playerTag)) return member;
        }
        return null;
    }

    private int memberTownHall(JsonArray members, String tag) {
        for (JsonElement element : members) {
            if (!element.isJsonObject()) continue;
            JsonObject member = element.getAsJsonObject();
            if (sameTag(string(member, "tag"), tag)) {
                return integer(member, "townhallLevel", "townHallLevel");
            }
        }
        return 0;
    }

    private void safeMarkFailure(
            String userId,
            String playerTag,
            String source,
            String sourceKey,
            String code
    ) {
        try {
            cache.markChecked(
                    userId, playerTag, source, sourceKey,
                    new JsonObject(), new JsonObject(), code
            );
        } catch (Exception ignored) {
            // The source failure is more useful than a secondary cache write failure.
        }
    }

    private static boolean sameTag(String left, String right) {
        return left != null && right != null && left.trim().equalsIgnoreCase(right.trim());
    }

    private static boolean bool(JsonObject object, String field) {
        JsonElement value = object == null ? null : object.get(field);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isBoolean() && value.getAsBoolean();
    }

    private static JsonObject object(JsonElement value) {
        return value != null && value.isJsonObject() ? value.getAsJsonObject() : new JsonObject();
    }

    private static JsonArray array(JsonElement value) {
        return value != null && value.isJsonArray() ? value.getAsJsonArray() : new JsonArray();
    }

    private static String string(JsonObject object, String field) {
        JsonElement value = object == null ? null : object.get(field);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isString()
                ? value.getAsString()
                : "";
    }

    private static String nestedString(JsonObject object, String parent, String field) {
        return string(AchievementHistoryCollector.object(object.get(parent)), field);
    }

    private static int integer(JsonObject object, String... fields) {
        for (String field : fields) {
            JsonElement value = object == null ? null : object.get(field);
            if (value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isNumber()) {
                return value.getAsInt();
            }
        }
        return 0;
    }

    private static double number(JsonObject object, String field) {
        JsonElement value = object == null ? null : object.get(field);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isNumber()
                ? value.getAsDouble()
                : 0;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return "";
    }

    private static String sourceError(Exception error) {
        String name = error.getClass().getSimpleName();
        return name == null || name.isBlank() ? "SOURCE_ERROR" : name.toUpperCase();
    }

    private record CwlRefresh(boolean changed, int processed, int remaining) {}
}
