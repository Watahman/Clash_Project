package Java.cwlhistory;

import java.util.List;

public record HistoricalCwlSeason(
        String season,
        Clan clan,
        League league,
        Integer position,
        Record record,
        List<Standing> standings,
        List<War> wars,
        List<Player> roster,
        String state,
        String source,
        String dataQuality,
        boolean warDetailsComplete
) {
    public HistoricalCwlSeason {
        standings = standings == null ? List.of() : List.copyOf(standings);
        wars = wars == null ? List.of() : List.copyOf(wars);
        roster = roster == null ? List.of() : List.copyOf(roster);
    }

    public record Clan(String tag, String name) {}

    public record League(Integer id, String name) {}

    public record Record(int wins, int losses, int draws) {}

    public record Standing(
            int rank,
            String tag,
            String name,
            int wins,
            int losses,
            int draws,
            int stars,
            double destruction
    ) {}

    public record Player(String tag, String name, int townHall) {}

    public record War(
            int day,
            String id,
            String state,
            String result,
            int teamSize,
            int attacksPerMember,
            WarSide clan,
            WarSide opponent,
            boolean detailsComplete
    ) {}

    public record WarSide(
            String tag,
            String name,
            int stars,
            double destruction,
            int attacks,
            List<Member> members
    ) {
        public WarSide {
            members = members == null ? List.of() : List.copyOf(members);
        }
    }

    public record Member(
            String tag,
            String name,
            int townHall,
            List<Attack> attacks
    ) {
        public Member {
            attacks = attacks == null ? List.of() : List.copyOf(attacks);
        }
    }

    public record Attack(
            String attackerTag,
            String defenderTag,
            int attackerTownHall,
            int defenderTownHall,
            int stars,
            double destruction,
            Integer order
    ) {}
}
