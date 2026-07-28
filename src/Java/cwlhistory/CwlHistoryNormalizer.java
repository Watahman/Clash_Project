package Java.cwlhistory;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class CwlHistoryNormalizer {
    private CwlHistoryNormalizer() {}

    static HistoricalCwlSeason normalizeSeason(
            String clanTag,
            String season,
            JsonObject groupResponse,
            JsonObject warsResponse,
            String source
    ) {
        JsonObject group = unwrapGroup(groupResponse);
        String normalizedTag = CwlHistoryJson.tag(clanTag);
        JsonObject selectedClan = findClan(group, normalizedTag);
        HistoricalCwlSeason.League league = normalizeLeague(group, selectedClan);
        List<HistoricalCwlSeason.Standing> standings = normalizeStandings(group);
        HistoricalCwlSeason.Standing selectedStanding = standings.stream()
                .filter(row -> row.tag().equals(normalizedTag))
                .findFirst()
                .orElse(null);
        JsonObject warSource = warsResponse == null ? group : warsResponse;
        List<HistoricalCwlSeason.War> wars =
                CwlHistoryWarNormalizer.normalize(warSource, normalizedTag, season);
        HistoricalCwlSeason.Record record = selectedStanding == null
                ? recordFromWars(wars)
                : new HistoricalCwlSeason.Record(
                        selectedStanding.wins(),
                        selectedStanding.losses(),
                        selectedStanding.draws()
                );
        List<HistoricalCwlSeason.Player> roster =
                normalizeRoster(selectedClan, wars);
        List<HistoricalCwlSeason.War> completedWars = wars.stream()
                .filter(war -> "completed".equals(war.state()))
                .toList();
        boolean detailsComplete = !completedWars.isEmpty()
                && completedWars.stream()
                .allMatch(HistoricalCwlSeason.War::detailsComplete);
        String quality = dataQuality(league, standings, wars, detailsComplete);
        String clanName = selectedClan == null
                ? normalizedTag
                : CwlHistoryJson.string(selectedClan, "name", "clanName");
        return new HistoricalCwlSeason(
                season,
                new HistoricalCwlSeason.Clan(normalizedTag, clanName),
                league,
                selectedStanding == null ? null : selectedStanding.rank(),
                record,
                standings,
                wars,
                roster,
                CwlHistoryJson.string(group, "state", "status"),
                source,
                quality,
                detailsComplete
        );
    }

    private static List<HistoricalCwlSeason.Standing> normalizeStandings(JsonObject group) {
        JsonArray rows = CwlHistoryJson.array(
                group, "clan_rankings", "clanRankings", "standings", "rankings"
        );
        if (rows == null) return List.of();
        List<StandingCandidate> candidates = new ArrayList<>();
        for (JsonElement item : rows) {
            if (!item.isJsonObject()) continue;
            JsonObject row = item.getAsJsonObject();
            JsonObject rounds = CwlHistoryJson.object(row, "rounds", "record");
            candidates.add(new StandingCandidate(
                    CwlHistoryJson.integer(row, 0, "rank", "groupRank", "position"),
                    CwlHistoryJson.tag(CwlHistoryJson.string(row, "tag", "clanTag")),
                    CwlHistoryJson.string(row, "name", "clanName"),
                    CwlHistoryJson.integer(row, CwlHistoryJson.integer(rounds, 0, "won"), "wins"),
                    CwlHistoryJson.integer(row, CwlHistoryJson.integer(rounds, 0, "lost"), "losses"),
                    CwlHistoryJson.integer(row, CwlHistoryJson.integer(rounds, 0, "tied"), "ties", "draws"),
                    CwlHistoryJson.integer(row, 0, "stars"),
                    CwlHistoryJson.decimal(row, 0, "destruction", "destructionPercentage")
            ));
        }
        candidates.sort(Comparator
                .comparingInt(StandingCandidate::stars).reversed()
                .thenComparing(StandingCandidate::destruction, Comparator.reverseOrder()));
        List<HistoricalCwlSeason.Standing> result = new ArrayList<>();
        for (int index = 0; index < candidates.size(); index++) {
            StandingCandidate row = candidates.get(index);
            result.add(new HistoricalCwlSeason.Standing(
                    row.rank() > 0 ? row.rank() : index + 1,
                    row.tag(), row.name(), row.wins(), row.losses(), row.draws(),
                    row.stars(), row.destruction()
            ));
        }
        result.sort(Comparator.comparingInt(HistoricalCwlSeason.Standing::rank));
        return List.copyOf(result);
    }

    private static List<HistoricalCwlSeason.Player> normalizeRoster(
            JsonObject clan,
            List<HistoricalCwlSeason.War> wars
    ) {
        Map<String, HistoricalCwlSeason.Player> players = new LinkedHashMap<>();
        addRosterMembers(players, CwlHistoryJson.array(clan, "members", "roster"));
        wars.forEach(war -> war.clan().members().forEach(member -> players.put(
                member.tag(),
                new HistoricalCwlSeason.Player(
                        member.tag(),
                        member.name().isBlank() ? member.tag() : member.name(),
                        member.townHall()
                )
        )));
        return players.values().stream()
                .sorted(Comparator.comparingInt(HistoricalCwlSeason.Player::townHall)
                        .reversed().thenComparing(HistoricalCwlSeason.Player::name))
                .toList();
    }

    private static void addRosterMembers(
            Map<String, HistoricalCwlSeason.Player> players,
            JsonArray members
    ) {
        if (members == null) return;
        for (JsonElement item : members) {
            if (!item.isJsonObject()) continue;
            JsonObject member = item.getAsJsonObject();
            String tag = CwlHistoryJson.tag(
                    CwlHistoryJson.string(member, "tag", "playerTag")
            );
            if (tag.isBlank()) continue;
            players.put(tag, new HistoricalCwlSeason.Player(
                    tag,
                    CwlHistoryJson.string(member, "name", "playerName"),
                    CwlHistoryJson.integer(
                            member, 0, "townHallLevel", "townhallLevel", "townHall"
                    )
            ));
        }
    }

    private static HistoricalCwlSeason.Record recordFromWars(
            List<HistoricalCwlSeason.War> wars
    ) {
        int wins = 0;
        int losses = 0;
        int draws = 0;
        for (HistoricalCwlSeason.War war : wars) {
            if ("win".equals(war.result())) wins++;
            else if ("loss".equals(war.result())) losses++;
            else if ("draw".equals(war.result())) draws++;
        }
        return new HistoricalCwlSeason.Record(wins, losses, draws);
    }

    private static HistoricalCwlSeason.League normalizeLeague(
            JsonObject group,
            JsonObject clan
    ) {
        JsonObject league = CwlHistoryJson.object(clan, "warLeague", "league");
        if (league == null) league = CwlHistoryJson.object(group, "warLeague", "league");
        int id = CwlHistoryJson.integer(
                league, CwlHistoryJson.integer(group, 0, "cwlLeagueId", "leagueId"), "id"
        );
        String name = CwlHistoryJson.string(league, "name");
        if (name.isBlank()) name = CwlHistoryJson.string(group, "leagueName");
        if (name.isBlank()) name = CwlHistoryIndexNormalizer.leagueName(id);
        return new HistoricalCwlSeason.League(id > 0 ? id : null, name);
    }

    private static JsonObject findClan(JsonObject group, String clanTag) {
        JsonArray clans = CwlHistoryJson.array(group, "clans");
        if (clans == null) {
            JsonObject clan = CwlHistoryJson.object(group, "clan");
            return clan != null
                    && clanTag.equals(CwlHistoryJson.tag(CwlHistoryJson.string(clan, "tag", "clanTag")))
                    ? clan : null;
        }
        for (JsonElement item : clans) {
            if (!item.isJsonObject()) continue;
            JsonObject clan = item.getAsJsonObject();
            if (clanTag.equals(CwlHistoryJson.tag(
                    CwlHistoryJson.string(clan, "tag", "clanTag")
            ))) return clan;
        }
        return null;
    }

    private static JsonObject unwrapGroup(JsonObject response) {
        if (response == null) return new JsonObject();
        JsonObject data = CwlHistoryJson.object(response, "data");
        JsonObject root = data == null ? response : data;
        JsonObject group = CwlHistoryJson.object(root, "group", "leagueGroup");
        return group == null ? root : group;
    }

    private static String dataQuality(
            HistoricalCwlSeason.League league,
            List<HistoricalCwlSeason.Standing> standings,
            List<HistoricalCwlSeason.War> wars,
            boolean detailsComplete
    ) {
        if (detailsComplete && !standings.isEmpty()) return "Complete";
        if (!wars.isEmpty() || !standings.isEmpty() || !league.name().isBlank()) {
            return "Partial history";
        }
        return "Insufficient data";
    }

    private record StandingCandidate(
            int rank,
            String tag,
            String name,
            int wins,
            int losses,
            int draws,
            int stars,
            Double destruction
    ) {}
}
