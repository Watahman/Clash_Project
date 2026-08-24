package Java.achievements;

import java.util.List;

/**
 * Public catalog facade. The v2 specification is the single source of truth for
 * fixed achievement definitions; evaluation support is layered separately so an
 * unavailable source never changes the catalog itself.
 */
public final class AchievementCatalog {
    private AchievementCatalog() {}

    public static List<AchievementDefinition> definitions() {
        return AchievementSpecV2Catalog.definitions();
    }
}
