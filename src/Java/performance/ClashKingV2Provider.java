package Java.performance;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Reads historical player performance exclusively from documented V2 routes. */
public final class ClashKingV2Provider implements HistoricalPlayerDataProvider {
    // Covers the 90-day scoring baseline plus 90 days of season-boundary headroom.
    static final int HISTORY_DAYS = 180;
    private static final int MAX_RESULTS = 500;
    private final ClashKingHttpClient client;
    private final ExecutorService fetchPool = Executors.newFixedThreadPool(8, runnable -> {
        Thread thread = new Thread(runnable, "clashking-v2-player-history");
        thread.setDaemon(true);
        return thread;
    });

    public ClashKingV2Provider(String baseUrl) {
        client = new ClashKingHttpClient(baseUrl, "ClashKing V2");
    }

    @Override
    public Map<String, HistoricalPlayerData> getPlayerWarHistory(List<String> playerTags) {
        Map<String, CompletableFuture<HistoricalPlayerData>> pending = new LinkedHashMap<>();
        for (String requestedTag : playerTags) {
            String tag = HistoricalJson.normalizeTag(requestedTag);
            pending.put(tag, CompletableFuture.supplyAsync(() -> fetchOne(tag), fetchPool));
        }
        Map<String, HistoricalPlayerData> result = new LinkedHashMap<>();
        pending.forEach((tag, future) -> result.put(tag, future.join()));
        return result;
    }

    private HistoricalPlayerData fetchOne(String tag) {
        List<HistoricalAttack> attacks = new ArrayList<>();
        List<HistoricalParticipation> participation = new ArrayList<>();
        boolean cwlAvailable = tryFetchType(
                tag, "cwl", HistoricalWarType.CWL, attacks, participation
        );
        boolean regularAvailable = tryFetchType(
                tag, "random", HistoricalWarType.REGULAR, attacks, participation
        );
        return new HistoricalPlayerData(
                tag, attacks, participation, providerName(), cwlAvailable || regularAvailable
        );
    }

    private boolean tryFetchType(
            String tag,
            String apiType,
            HistoricalWarType warType,
            List<HistoricalAttack> attacks,
            List<HistoricalParticipation> participation
    ) {
        try {
            JsonObject response = client.get(warStatsPath(tag, apiType));
            normalizePlayer(tag, warType, response, attacks, participation);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private static String warStatsPath(String tag, String type) {
        return warStatsPath(tag, type, historyStart(type));
    }

    static String warStatsPath(String tag, String type, Instant start) {
        return "/v2/player/" + encoded(tag) + "/war/stats"
                + "?type=" + type
                + "&time%5Bafter%5D=" + encoded(start.toString())
                + "&limit=" + MAX_RESULTS;
    }

    private static Instant historyStart(String type) {
        return historyStart(type, Instant.now());
    }

    static Instant historyStart(String type, Instant now) {
        return ZonedDateTime.ofInstant(now, ZoneOffset.UTC)
                .minus(HISTORY_DAYS, ChronoUnit.DAYS)
                .toInstant();
    }

    static HistoricalPlayerData normalizePlayer(
            String requestedTag,
            HistoricalWarType type,
            JsonObject response
    ) {
        String tag = HistoricalJson.normalizeTag(requestedTag);
        List<HistoricalAttack> attacks = new ArrayList<>();
        List<HistoricalParticipation> participation = new ArrayList<>();
        normalizePlayer(tag, type, response, attacks, participation);
        return new HistoricalPlayerData(tag, attacks, participation, "v2", true);
    }

    private static void normalizePlayer(
            String tag,
            HistoricalWarType type,
            JsonObject response,
            List<HistoricalAttack> attacks,
            List<HistoricalParticipation> participation
    ) {
        JsonArray wars = HistoricalJson.array(response, "items");
        if (wars == null) return;
        for (JsonElement element : wars) {
            if (!element.isJsonObject()) continue;
            normalizeWar(tag, type, element.getAsJsonObject(), attacks, participation);
        }
    }

    private static void normalizeWar(
            String tag,
            HistoricalWarType type,
            JsonObject war,
            List<HistoricalAttack> attacks,
            List<HistoricalParticipation> participation
    ) {
        JsonObject player = HistoricalJson.object(war, "player");
        String playerTag = HistoricalJson.normalizeTag(HistoricalJson.string(player, "tag"));
        if (!playerTag.isBlank() && !playerTag.equals(tag)) return;
        Instant endTime = HistoricalJson.instant(war, "endTime");
        String warId = warId(war, type);
        JsonArray warAttacks = HistoricalJson.array(war, "attacks");
        appendAttacks(tag, type, player, warAttacks, endTime, warId, attacks);
        int available = HistoricalJson.integer(war, 0, "attacksPerMember");
        if (available <= 0) return;
        int used = warAttacks == null ? 0 : warAttacks.size();
        participation.add(new HistoricalParticipation(
                tag, type, endTime, available, used, warId, true
        ));
    }

    private static void appendAttacks(
            String tag,
            HistoricalWarType type,
            JsonObject player,
            JsonArray rows,
            Instant endTime,
            String warId,
            List<HistoricalAttack> result
    ) {
        if (rows == null) return;
        int attackerTownHall = HistoricalJson.integer(player, 0, "townhallLevel");
        for (JsonElement element : rows) {
            if (!element.isJsonObject()) continue;
            JsonObject attack = element.getAsJsonObject();
            JsonObject defender = HistoricalJson.object(attack, "player");
            int order = HistoricalJson.integer(attack, -1, "order");
            result.add(new HistoricalAttack(
                    tag, type, endTime, attackerTownHall,
                    HistoricalJson.integer(defender, 0, "townhallLevel"),
                    HistoricalJson.integer(attack, 0, "stars"),
                    HistoricalJson.decimal(attack, 0, "destructionPercentage"),
                    order < 0 ? null : order, warId
            ));
        }
    }

    private static String warId(JsonObject war, HistoricalWarType type) {
        String endTime = HistoricalJson.string(war, "endTime");
        String clan = HistoricalJson.string(HistoricalJson.object(war, "clan"), "tag");
        String opponent = HistoricalJson.string(HistoricalJson.object(war, "opponent"), "tag");
        return type.name().toLowerCase() + ":" + endTime + ":" + clan + ":" + opponent;
    }

    private static String encoded(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    @Override
    public String providerName() {
        return "v2";
    }
}
