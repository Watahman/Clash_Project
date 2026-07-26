package Java.performance;

public final class MatchupDifficulty {
    private MatchupDifficulty() {}

    public static double multiplier(int attackerTownHall, int defenderTownHall) {
        if (attackerTownHall <= 0 || defenderTownHall <= 0) return 1.0;
        int townHallDelta = attackerTownHall - defenderTownHall;
        return clamp(1 - townHallDelta * 0.12, 0.7, 1.35);
    }

    public static double adjustedAttackQuality(HistoricalAttack attack) {
        double quality = 75 * (clamp(attack.stars(), 0, 3) / 3.0)
                + 25 * (clamp(attack.destruction(), 0, 100) / 100.0);
        return quality * multiplier(attack.attackerTownHall(), attack.defenderTownHall());
    }

    private static double clamp(double value, double minimum, double maximum) {
        return Math.min(maximum, Math.max(minimum, value));
    }
}
