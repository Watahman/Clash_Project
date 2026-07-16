package Java.cache;

public final class CachePolicy {
    private CachePolicy() {}

    public static final long PLAYER_INFO = minutes(5);
    public static final long PLAYER_BATTLE_LOG = minutes(2);
    public static final long PLAYER_LEAGUE_HISTORY = hours(6);
    public static final long CLAN_INFO = hours(6);
    public static final long CLAN_MEMBERS = minutes(2);
    public static final long CLAN_CURRENT_WAR = seconds(60);
    public static final long CLAN_LEAGUE_GROUP = minutes(2);
    public static final long CLAN_LEAGUE_WAR = seconds(60);
    public static final long CLAN_WAR_LOG = minutes(15);
    public static final long CLAN_RAID_SEASONS = minutes(30);
    public static final long CLAN_SEARCH = minutes(5);

    private static long seconds(long value) {
        return value * 1000;
    }

    private static long minutes(long value) {
        return seconds(value * 60);
    }

    private static long hours(long value) {
        return minutes(value * 60);
    }
}
