package Java.achievements;

import java.util.Map;

/** Internal common shape for independently reduced ClashKing source slices. */
interface ClashKingV2AchievementSlice {
    Map<String, Long> metrics();

    int records();
}
