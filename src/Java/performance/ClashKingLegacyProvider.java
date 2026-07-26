package Java.performance;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class ClashKingLegacyProvider implements HistoricalPlayerDataProvider {
    private static final int HISTORY_DAYS = 180;
    private final ClashKingHttpClient client;
    private final ExecutorService fetchPool = Executors.newFixedThreadPool(8, runnable -> {
        Thread thread = new Thread(runnable, "clashking-legacy-fetch");
        thread.setDaemon(true);
        return thread;
    });

    public ClashKingLegacyProvider(String baseUrl) {
        client = new ClashKingHttpClient(baseUrl, "ClashKing legacy");
    }

    @Override
    public Map<String, HistoricalPlayerData> getPlayerWarHistory(List<String> playerTags) {
        Map<String, CompletableFuture<HistoricalPlayerData>> pending = new LinkedHashMap<>();
        for (String tag : playerTags) {
            pending.put(tag, CompletableFuture.supplyAsync(() -> fetchOne(tag), fetchPool));
        }
        Map<String, HistoricalPlayerData> result = new LinkedHashMap<>();
        pending.forEach((tag, future) -> result.put(tag, future.join()));
        return result;
    }

    private HistoricalPlayerData fetchOne(String tag) {
        try {
            long start = Instant.now().minus(HISTORY_DAYS, ChronoUnit.DAYS).getEpochSecond();
            String encoded = URLEncoder.encode(tag, StandardCharsets.UTF_8);
            JsonObject response = client.get(
                    "/player/" + encoded + "/warhits?timestamp_start=" + start + "&limit=500"
            );
            return normalizePlayer(tag, response);
        } catch (Exception upstreamFailure) {
            return HistoricalPlayerData.unavailable(tag, providerName());
        }
    }

    static HistoricalPlayerData normalizePlayer(String requestedTag, JsonObject response) {
        String tag = HistoricalJson.normalizeTag(requestedTag);
        JsonArray wars = HistoricalJson.array(response, "items");
        if (wars == null) return HistoricalPlayerData.unavailable(tag, "legacy");

        List<HistoricalAttack> attacks = new ArrayList<>();
        List<HistoricalParticipation> participation = new ArrayList<>();
        for (JsonElement element : wars) {
            if (!element.isJsonObject()) continue;
            normalizeWar(tag, element.getAsJsonObject(), attacks, participation);
        }
        return new HistoricalPlayerData(tag, attacks, participation, "legacy", true);
    }

    private static void normalizeWar(
            String tag,
            JsonObject item,
            List<HistoricalAttack> attacks,
            List<HistoricalParticipation> participation
    ) {
        JsonObject war = HistoricalJson.object(item, "war_data", "warData");
        JsonObject member = HistoricalJson.object(item, "member_data", "memberData");
        if (war == null || member == null) return;

        HistoricalWarType type = HistoricalWarType.from(
                HistoricalJson.string(war, "type", "warType")
        );
        Instant endTime = HistoricalJson.instant(war, "endTime", "warEndTime");
        String warId = HistoricalJson.string(war, "tag", "warTag", "id", "war_id");
        int attackerTownHall = HistoricalJson.integer(
                member, 0, "townhallLevel", "townHallLevel", "attackerTownhall"
        );
        JsonArray memberAttacks = HistoricalJson.array(item, "attacks");
        if (memberAttacks != null) {
            for (JsonElement attackElement : memberAttacks) {
                if (!attackElement.isJsonObject()) continue;
                JsonObject attack = attackElement.getAsJsonObject();
                String attackerTag = HistoricalJson.normalizeTag(
                        HistoricalJson.string(attack, "attackerTag", "attacker_tag")
                );
                if (!attackerTag.isBlank() && !attackerTag.equals(tag)) continue;
                JsonObject defender = HistoricalJson.object(attack, "defender");
                int defenderTownHall = HistoricalJson.integer(
                        defender, 0, "townhallLevel", "townHallLevel"
                );
                attacks.add(toAttack(tag, type, endTime, attackerTownHall, defenderTownHall, warId, attack));
            }
        }

        boolean memberMatches = tag.equals(HistoricalJson.normalizeTag(
                HistoricalJson.string(member, "tag", "playerTag")
        ));
        int missed = HistoricalJson.integer(item, -1, "missedAttacks", "missed_attacks");
        if (memberMatches && memberAttacks != null && missed >= 0) {
            int used = memberAttacks.size();
            participation.add(new HistoricalParticipation(
                    tag, type, endTime, used + missed, used, warId, true
            ));
        }
    }

    private static HistoricalAttack toAttack(
            String tag,
            HistoricalWarType type,
            Instant endTime,
            int attackerTownHall,
            int defenderTownHall,
            String warId,
            JsonObject attack
    ) {
        int order = HistoricalJson.integer(attack, -1, "attack_order", "attackOrder", "order");
        return new HistoricalAttack(
                tag,
                type,
                endTime,
                attackerTownHall,
                defenderTownHall,
                HistoricalJson.integer(attack, 0, "stars"),
                HistoricalJson.decimal(attack, 0, "destructionPercentage", "destruction"),
                order < 0 ? null : order,
                warId
        );
    }

    @Override
    public String providerName() {
        return "legacy";
    }
}
