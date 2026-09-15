package Java.achievements;

import com.google.gson.JsonObject;

import java.util.Set;

import static Java.achievements.ClashKingV2AchievementJson.decimal;
import static Java.achievements.ClashKingV2AchievementJson.object;
import static Java.achievements.ClashKingV2AchievementJson.text;
import static Java.achievements.ClashKingV2AchievementJson.whole;

/** Accumulates one player's ordered CWL attacks for the aggregate reducer. */
final class ClashKingV2CwlSeasonValues {
    long attacks;
    long stars;
    long triples;
    long twos;
    long ones;
    long zeros;
    long destruction;
    long destructionSamples;
    long same;
    long uphit;
    long plusTwo;
    long uphitTriples;
    long over95;
    long over99;
    long perfectAttacks;
    boolean allPerfect = true;

    void add(JsonObject attack, int ownTownHall, Set<String> warsSeen, String seasonKey) {
        attacks++;
        String warTag = text(attack, "warTag").trim();
        if (!warTag.isBlank()) warsSeen.add(seasonKey + "\u001f" + warTag);
        Long starValue = whole(attack, "stars");
        int star = starValue == null ? -1 : Math.max(0, Math.min(3, starValue.intValue()));
        if (star < 0) allPerfect = false;
        if (star >= 0) {
            stars += star;
            if (star == 3) triples++;
            if (star == 2) twos++;
            if (star == 1) ones++;
            if (star == 0) zeros++;
        }
        Double destructionValue = decimal(attack, "destructionPercentage");
        if (destructionValue != null) {
            destruction += Math.max(0, Math.round(destructionValue * 100));
            destructionSamples++;
            if (destructionValue >= 95) over95++;
            if (destructionValue >= 99) over99++;
        }
        boolean perfect = star == 3 && destructionValue != null && destructionValue >= 100;
        if (perfect) perfectAttacks++;
        if (!perfect) allPerfect = false;
        addTownHallRelation(attack, ownTownHall, star == 3);
    }

    private void addTownHallRelation(JsonObject attack, int ownTownHall, boolean triple) {
        JsonObject defender = object(attack, "defender");
        int defenderTownHall = integer(defender, "townHallLevel", "townhallLevel");
        if (ownTownHall <= 0 || defenderTownHall <= 0) return;
        if (defenderTownHall == ownTownHall) same++;
        if (defenderTownHall > ownTownHall) uphit++;
        if (defenderTownHall >= ownTownHall + 2) plusTwo++;
        if (triple && defenderTownHall > ownTownHall) uphitTriples++;
    }

    private static int integer(JsonObject object, String... fields) {
        Long value = whole(object, fields);
        return value == null || value < 0 || value > Integer.MAX_VALUE ? 0 : value.intValue();
    }
}
