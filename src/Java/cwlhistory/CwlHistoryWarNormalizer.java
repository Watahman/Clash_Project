package Java.cwlhistory;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

final class CwlHistoryWarNormalizer {
    private CwlHistoryWarNormalizer() {}

    static List<HistoricalCwlSeason.War> normalize(
            JsonObject source,
            String clanTag,
            String season
    ) {
        JsonArray items = warItems(source);
        if (items == null) return List.of();
        String selectedTag = CwlHistoryJson.tag(clanTag);
        List<TimedWar> normalized = new ArrayList<>();
        for (JsonElement item : items) {
            if (!item.isJsonObject()) continue;
            JsonObject war = unwrapWar(item.getAsJsonObject());
            Instant endTime = CwlHistoryJson.instant(war, "endTime", "warEndTime");
            if (!belongsToSeason(endTime, season)) continue;
            TimedWar candidate = normalizeWar(war, selectedTag, endTime);
            if (candidate != null) normalized.add(candidate);
        }
        normalized.sort(Comparator
                .comparing(TimedWar::endTime, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(item -> item.war().id()));
        List<HistoricalCwlSeason.War> result = new ArrayList<>();
        for (int index = 0; index < normalized.size(); index++) {
            HistoricalCwlSeason.War war = normalized.get(index).war();
            int day = war.day() > 0 ? war.day() : index + 1;
            result.add(new HistoricalCwlSeason.War(
                    day, war.id(), war.state(), war.result(), war.teamSize(),
                    war.attacksPerMember(), war.clan(), war.opponent(),
                    war.detailsComplete()
            ));
        }
        return List.copyOf(result);
    }

    private static JsonArray warItems(JsonObject source) {
        JsonArray direct = CwlHistoryJson.array(
                source, "items", "wars", "leagueWars"
        );
        if (direct != null) return direct;
        JsonArray rounds = CwlHistoryJson.array(source, "rounds");
        if (rounds == null) return null;
        JsonArray wars = new JsonArray();
        for (JsonElement roundItem : rounds) {
            if (!roundItem.isJsonObject()) continue;
            JsonArray warTags = CwlHistoryJson.array(
                    roundItem.getAsJsonObject(), "warTags", "wars"
            );
            if (warTags == null) continue;
            for (JsonElement war : warTags) {
                if (war.isJsonObject()) wars.add(war);
            }
        }
        return wars;
    }

    private static TimedWar normalizeWar(
            JsonObject war,
            String selectedTag,
            Instant endTime
    ) {
        JsonObject first = CwlHistoryJson.object(war, "clan");
        JsonObject second = CwlHistoryJson.object(war, "opponent");
        if (first == null || second == null) return null;
        if (!selectedTag.equals(sideTag(first)) && selectedTag.equals(sideTag(second))) {
            JsonObject swap = first;
            first = second;
            second = swap;
        }
        if (!selectedTag.equals(sideTag(first))) return null;

        int attacksPerMember = Math.max(
                1, CwlHistoryJson.integer(war, 1, "attacksPerMember", "attacks_per_member")
        );
        int teamSize = CwlHistoryJson.integer(war, 0, "teamSize", "team_size", "warSize");
        Map<String, Integer> townHalls = townHallMap(first, second);
        SideResult own = normalizeSide(first, townHalls);
        SideResult enemy = normalizeSide(second, townHalls);
        if (teamSize <= 0) teamSize = own.side().members().size();
        String state = normalizeState(CwlHistoryJson.string(war, "state", "status"));
        boolean concluded = "completed".equals(state);
        boolean detailsComplete = concluded
                && teamSize > 0
                && !own.side().members().isEmpty()
                && !enemy.side().members().isEmpty()
                && own.side().attacks() == own.memberAttackCount()
                && enemy.side().attacks() == enemy.memberAttackCount();
        String id = CwlHistoryJson.string(war, "tag", "warTag", "id", "_warTag");
        int day = CwlHistoryJson.integer(war, 0, "_round", "round", "day", "warDay");
        HistoricalCwlSeason.War normalized = new HistoricalCwlSeason.War(
                day,
                id,
                state,
                result(own.side(), enemy.side(), concluded),
                teamSize,
                attacksPerMember,
                own.side(),
                enemy.side(),
                detailsComplete
        );
        return new TimedWar(endTime, normalized);
    }

    private static SideResult normalizeSide(
            JsonObject side,
            Map<String, Integer> townHalls
    ) {
        JsonArray members = CwlHistoryJson.array(side, "members", "roster");
        List<HistoricalCwlSeason.Member> normalized = new ArrayList<>();
        int memberAttackCount = 0;
        if (members != null) {
            for (JsonElement item : members) {
                if (!item.isJsonObject()) continue;
                JsonObject member = item.getAsJsonObject();
                String memberTag = CwlHistoryJson.tag(
                        CwlHistoryJson.string(member, "tag", "playerTag", "player_tag")
                );
                int townHall = CwlHistoryJson.integer(
                        member, 0, "townhallLevel", "townHallLevel", "townHall"
                );
                JsonArray attacks = CwlHistoryJson.array(member, "attacks");
                List<HistoricalCwlSeason.Attack> normalizedAttacks = new ArrayList<>();
                if (attacks != null) {
                    for (JsonElement attackItem : attacks) {
                        if (!attackItem.isJsonObject()) continue;
                        normalizedAttacks.add(normalizeAttack(
                                attackItem.getAsJsonObject(), memberTag, townHall, townHalls
                        ));
                    }
                }
                memberAttackCount += normalizedAttacks.size();
                normalized.add(new HistoricalCwlSeason.Member(
                        memberTag,
                        CwlHistoryJson.string(member, "name", "playerName"),
                        townHall,
                        normalizedAttacks
                ));
            }
        }
        int sideAttacks = CwlHistoryJson.integer(
                side, memberAttackCount, "attacks", "attacksUsed", "attack_count"
        );
        return new SideResult(
                new HistoricalCwlSeason.WarSide(
                        sideTag(side),
                        CwlHistoryJson.string(side, "name", "clanName"),
                        CwlHistoryJson.integer(side, 0, "stars"),
                        CwlHistoryJson.decimal(
                                side, 0, "destructionPercentage", "destruction"
                        ),
                        sideAttacks,
                        normalized
                ),
                memberAttackCount
        );
    }

    private static HistoricalCwlSeason.Attack normalizeAttack(
            JsonObject attack,
            String fallbackAttacker,
            int fallbackTownHall,
            Map<String, Integer> townHalls
    ) {
        String attackerTag = CwlHistoryJson.tag(
                CwlHistoryJson.string(attack, "attackerTag", "attacker_tag")
        );
        if (attackerTag.isBlank()) attackerTag = fallbackAttacker;
        String defenderTag = CwlHistoryJson.tag(
                CwlHistoryJson.string(attack, "defenderTag", "defender_tag")
        );
        int order = CwlHistoryJson.integer(
                attack, -1, "order", "attackOrder", "attack_order"
        );
        return new HistoricalCwlSeason.Attack(
                attackerTag,
                defenderTag,
                townHalls.getOrDefault(attackerTag, fallbackTownHall),
                townHalls.getOrDefault(defenderTag, 0),
                CwlHistoryJson.integer(attack, 0, "stars"),
                CwlHistoryJson.decimal(
                        attack, 0, "destructionPercentage", "destruction"
                ),
                order < 0 ? null : order
        );
    }

    private static Map<String, Integer> townHallMap(JsonObject... sides) {
        Map<String, Integer> result = new HashMap<>();
        for (JsonObject side : sides) {
            JsonArray members = CwlHistoryJson.array(side, "members", "roster");
            if (members == null) continue;
            for (JsonElement item : members) {
                if (!item.isJsonObject()) continue;
                JsonObject member = item.getAsJsonObject();
                result.put(
                        CwlHistoryJson.tag(CwlHistoryJson.string(member, "tag", "playerTag")),
                        CwlHistoryJson.integer(member, 0, "townhallLevel", "townHallLevel")
                );
            }
        }
        return result;
    }

    private static String result(
            HistoricalCwlSeason.WarSide own,
            HistoricalCwlSeason.WarSide enemy,
            boolean concluded
    ) {
        if (!concluded) return "unknown";
        if (own.stars() != enemy.stars()) return own.stars() > enemy.stars() ? "win" : "loss";
        if (Double.compare(own.destruction(), enemy.destruction()) == 0) return "draw";
        return own.destruction() > enemy.destruction() ? "win" : "loss";
    }

    private static boolean belongsToSeason(Instant endTime, String season) {
        if (endTime == null) return true;
        try {
            return YearMonth.from(endTime.atZone(ZoneOffset.UTC)).equals(YearMonth.parse(season));
        } catch (RuntimeException invalidSeason) {
            return false;
        }
    }

    private static JsonObject unwrapWar(JsonObject wrapper) {
        JsonObject nested = CwlHistoryJson.object(wrapper, "war", "war_data", "warData");
        return nested == null ? wrapper : nested;
    }

    private static String sideTag(JsonObject side) {
        return CwlHistoryJson.tag(CwlHistoryJson.string(side, "tag", "clanTag"));
    }

    private static String normalizeState(String state) {
        return switch (state == null ? "" : state.trim().toLowerCase()) {
            case "warended", "ended", "complete", "completed" -> "completed";
            case "inwar", "live" -> "live";
            case "preparation", "preparationday" -> "preparation";
            default -> "unknown";
        };
    }

    private record SideResult(HistoricalCwlSeason.WarSide side, int memberAttackCount) {}

    private record TimedWar(Instant endTime, HistoricalCwlSeason.War war) {}
}
