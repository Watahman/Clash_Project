package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.AttackObservation;
import Java.advancedstats.AdvancedStatsHistoryModels.Checkpoint;
import Java.advancedstats.AdvancedStatsHistoryModels.Coverage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryPage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;
import Java.advancedstats.AdvancedStatsHistoryModels.Provenance;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.array;
import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.object;

/** Decodes ClashKing V2 normal, ranked/legend, and war payloads. */
final class ClashKingV2AdvancedStatsParser {
    private ClashKingV2AdvancedStatsParser() {}

    static HistoryPage normal(JsonObject response, HistoryRequest request) {
        List<AttackObservation> observations = new ArrayList<>();
        JsonArray items = array(response, "items");
        for (JsonElement item : items) {
            JsonObject row = object(item);
            if (row != null) observations.add(ClashKingV2AdvancedStatsParserMapping.normalObservation(
                    row, request, "normal", true));
        }
        return page(observations, request, "v2-normal-history-v2",
                "GET /v2/player/{tag}/battlelog/history; local watermark; duration is transient");
    }

    /** Compatibility for the original ranked battlelogs envelope. */
    static HistoryPage ranked(JsonObject response, HistoryRequest request, long season) {
        String seasonKey = ClashKingV2AdvancedStatsParserIdentity.numericSeason(Long.toString(season));
        if (seasonKey.isBlank()) {
            return page(List.of(), request, "v2-ranked-battlelog-v2",
                    "GET /v2/player/{tag}/ranked/{season}/battlelog; no valid season; events omitted", "");
        }
        List<AttackObservation> observations = new ArrayList<>();
        JsonArray items = array(response, "battlelogs");
        for (JsonElement item : items) {
            JsonObject row = object(item);
            if (row != null && ClashKingV2AdvancedStatsParserIdentity.isAttack(row, false)) {
                observations.add(ClashKingV2AdvancedStatsParserMapping.normalObservation(
                        row, request, "ranked-season:" + seasonKey, false));
            }
        }
        return page(observations, request, "v2-ranked-battlelog-v2",
                "GET /v2/player/{tag}/ranked/{season}/battlelog; attacks only; no cursor",
                seasonKey);
    }

    /**
     * Merges the new ranked and legend envelopes into the existing RANKED scope.
     * Only rows under attacks are observations; defenses are intentionally ignored.
     */
    static HistoryPage league(JsonObject ranked, String seasonId, JsonObject legend, String day,
                              HistoryRequest request) {
        String seasonKey = ClashKingV2AdvancedStatsParserIdentity.numericSeason(seasonId);
        if (seasonKey.isBlank()) {
            return page(List.of(), request, "v2-league-battlelog-v1",
                    "GET /v2/player/{tag}/ranked/{seasonId}/battlelog and "
                            + "/v2/player/{tag}/legend/{day}/battlelog; no valid season; events omitted", "");
        }
        List<AttackObservation> observations = new ArrayList<>();
        appendLeagueAttacks(observations, ranked, "ranked", seasonKey, request);
        appendLeagueAttacks(observations, legend, "legend", seasonKey, request);
        return page(observations, request, "v2-league-battlelog-v1",
                "GET /v2/player/{tag}/ranked/{seasonId}/battlelog and /v2/player/{tag}/legend/{day}/battlelog; attacks only",
                seasonKey);
    }

    static HistoryPage war(JsonObject response, HistoryRequest request) {
        List<AttackObservation> observations = new ArrayList<>();
        JsonArray items = array(response, "items");
        for (JsonElement item : items) {
            JsonObject row = object(item);
            if (row != null) observations.add(ClashKingV2AdvancedStatsParserMapping.warObservation(row, request));
        }
        return page(observations, request, "v2-war-attacks-v2",
                "GET /v2/player/{tag}/war/attacks; no upstream cursor or total", "");
    }

    private static void appendLeagueAttacks(List<AttackObservation> target, JsonObject envelope,
                                            String type, String season, HistoryRequest request) {
        JsonArray attacks = array(envelope, "attacks");
        for (JsonElement attack : attacks) {
            JsonObject row = object(attack);
            if (row != null) target.add(ClashKingV2AdvancedStatsParserMapping.leagueObservation(
                    row, type, season, request));
        }
    }

    private static HistoryPage page(List<AttackObservation> observations, HistoryRequest request,
                                    String version, String note, String rankedSeasonKey) {
        List<AttackObservation> filtered = observations.stream().filter(item -> after(item, request.checkpoint()))
                .sorted(Comparator.comparing(AttackObservation::occurredAt).thenComparing(AttackObservation::eventKey))
                .toList();
        Checkpoint next = filtered.stream()
                .max(Comparator.comparing(AttackObservation::occurredAt).thenComparing(AttackObservation::eventKey))
                .map(item -> new Checkpoint("", item.occurredAt(), item.eventKey()))
                .orElse(request.checkpoint());
        return new HistoryPage(filtered, next, false, Coverage.PARTIAL,
                new Provenance("clashking-v2", version, request.requestedAt(), note, rankedSeasonKey));
    }

    private static HistoryPage page(List<AttackObservation> observations, HistoryRequest request,
                                    String version, String note) {
        return page(observations, request, version, note, "");
    }

    private static boolean after(AttackObservation observation, Checkpoint checkpoint) {
        if (checkpoint == null || !checkpoint.present() || checkpoint.watermark() == null) return true;
        int time = observation.occurredAt().compareTo(checkpoint.watermark());
        return time > 0 || (time == 0 && observation.eventKey().compareTo(checkpoint.watermarkKey()) > 0);
    }

}
