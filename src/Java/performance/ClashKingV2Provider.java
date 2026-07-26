package Java.performance;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class ClashKingV2Provider implements HistoricalPlayerDataProvider {
    private final ClashKingHttpClient client;

    public ClashKingV2Provider(String baseUrl) {
        client = new ClashKingHttpClient(baseUrl, "ClashKing V2");
    }

    @Override
    public Map<String, HistoricalPlayerData> getPlayerWarHistory(List<String> playerTags) throws Exception {
        JsonArray players = new JsonArray();
        playerTags.forEach(players::add);
        JsonObject request = new JsonObject();
        request.add("players", players);
        return normalizeBatch(playerTags, client.post("/v2/war/players/warhits", request));
    }

    static Map<String, HistoricalPlayerData> normalizeBatch(
            List<String> requestedTags,
            JsonObject response
    ) {
        Map<String, HistoricalPlayerData> result = new LinkedHashMap<>();
        requestedTags.forEach(tag -> result.put(
                HistoricalJson.normalizeTag(tag),
                HistoricalPlayerData.unavailable(HistoricalJson.normalizeTag(tag), "v2")
        ));

        JsonArray items = HistoricalJson.array(response, "items");
        if (items == null) return result;
        for (JsonElement element : items) {
            if (!element.isJsonObject()) continue;
            HistoricalPlayerData data = normalizePlayer(element.getAsJsonObject());
            if (!data.playerTag().isBlank()) result.put(data.playerTag(), data);
        }
        return result;
    }

    private static HistoricalPlayerData normalizePlayer(JsonObject item) {
        String tag = HistoricalJson.normalizeTag(
                HistoricalJson.string(item, "tag", "playerTag", "player_tag")
        );
        List<HistoricalAttack> attacks = new ArrayList<>();
        List<HistoricalParticipation> participation = new ArrayList<>();
        JsonArray wars = HistoricalJson.array(item, "wars");
        if (wars == null) return HistoricalPlayerData.unavailable(tag, "v2");

        for (JsonElement element : wars) {
            if (!element.isJsonObject()) continue;
            normalizeWar(tag, element.getAsJsonObject(), attacks, participation);
        }
        return new HistoricalPlayerData(tag, attacks, participation, "v2", true);
    }

    private static void normalizeWar(
            String tag,
            JsonObject wrapper,
            List<HistoricalAttack> attacks,
            List<HistoricalParticipation> participation
    ) {
        JsonObject war = HistoricalJson.object(wrapper, "war_data", "warData", "war");
        JsonArray members = HistoricalJson.array(wrapper, "members");
        JsonObject member = findMember(members, tag);
        if (war == null || member == null) return;

        String explicitType = HistoricalJson.string(war, "type", "warType");
        HistoricalWarType type = HistoricalWarType.from(explicitType);
        if (type == HistoricalWarType.UNKNOWN) {
            type = HistoricalJson.string(war, "tag", "warTag").isBlank()
                    ? HistoricalWarType.REGULAR
                    : HistoricalWarType.CWL;
        }
        Instant endTime = HistoricalJson.instant(war, "endTime", "warEndTime");
        String warId = HistoricalJson.string(war, "tag", "warTag", "id", "war_id");
        int attackerTownHall = HistoricalJson.integer(
                member, 0, "townhallLevel", "townHallLevel"
        );
        JsonArray memberAttacks = HistoricalJson.array(member, "attacks");
        if (memberAttacks != null) {
            for (JsonElement attackElement : memberAttacks) {
                if (!attackElement.isJsonObject()) continue;
                JsonObject attack = attackElement.getAsJsonObject();
                int defenderTownHall = findDefenderTownHall(
                        war, HistoricalJson.string(attack, "defenderTag", "defender_tag")
                );
                int order = HistoricalJson.integer(attack, -1, "attackOrder", "attack_order", "order");
                attacks.add(new HistoricalAttack(
                        tag,
                        type,
                        endTime,
                        attackerTownHall,
                        defenderTownHall,
                        HistoricalJson.integer(attack, 0, "stars"),
                        HistoricalJson.decimal(attack, 0, "destructionPercentage", "destruction"),
                        order < 0 ? null : order,
                        warId
                ));
            }
        }

        int missed = HistoricalJson.integer(
                wrapper, -1, "missedAttacks", "missed_attacks"
        );
        if (missed >= 0 && memberAttacks != null) {
            int used = memberAttacks.size();
            participation.add(new HistoricalParticipation(
                    tag, type, endTime, used + missed, used, warId, true
            ));
        }
    }

    private static JsonObject findMember(JsonArray members, String tag) {
        if (members == null) return null;
        for (JsonElement element : members) {
            if (!element.isJsonObject()) continue;
            JsonObject member = element.getAsJsonObject();
            if (tag.equals(HistoricalJson.normalizeTag(HistoricalJson.string(member, "tag", "playerTag")))) {
                return member;
            }
        }
        return null;
    }

    private static int findDefenderTownHall(JsonObject war, String defenderTag) {
        String normalized = HistoricalJson.normalizeTag(defenderTag);
        for (String sideName : List.of("clan", "opponent")) {
            JsonObject side = HistoricalJson.object(war, sideName);
            JsonArray members = HistoricalJson.array(side, "members");
            JsonObject defender = findMember(members, normalized);
            if (defender != null) {
                return HistoricalJson.integer(defender, 0, "townhallLevel", "townHallLevel");
            }
        }
        return 0;
    }

    @Override
    public String providerName() {
        return "v2";
    }
}
