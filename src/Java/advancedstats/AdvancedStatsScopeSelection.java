package Java.advancedstats;

import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * User-facing selection of the logical Advanced Stats scopes.
 *
 * <p>The selection deliberately owns the translation from the compact API labels
 * to stored scopes so callers cannot accidentally treat an unknown value as
 * normal history.</p>
 */
public final class AdvancedStatsScopeSelection {
    public enum Kind {
        ALL,
        REGULAR,
        COMPETITIVE,
        EXPLICIT
    }

    private final Kind kind;
    private final List<AdvancedStatsScope> scopes;
    private final String apiValue;
    private final boolean supplied;

    private AdvancedStatsScopeSelection(Kind kind, List<AdvancedStatsScope> scopes,
                                        String apiValue, boolean supplied) {
        this.kind = Objects.requireNonNull(kind, "kind");
        this.scopes = List.copyOf(scopes);
        this.apiValue = Objects.requireNonNull(apiValue, "apiValue");
        this.supplied = supplied;
    }

    public static AdvancedStatsScopeSelection parse(String raw) {
        if (raw == null || raw.isBlank()) return all(false);
        String value = normalize(raw);
        return switch (value) {
            case "all" -> all(true);
            case "regular" -> new AdvancedStatsScopeSelection(
                    Kind.REGULAR, List.of(AdvancedStatsScope.NORMAL), "regular", true);
            case "normal" -> explicit(AdvancedStatsScope.NORMAL, true);
            case "competitive" -> new AdvancedStatsScopeSelection(
                    Kind.COMPETITIVE, List.of(AdvancedStatsScope.WAR, AdvancedStatsScope.RANKED),
                    "competitive", true);
            case "war" -> explicit(AdvancedStatsScope.WAR, true);
            case "ranked", "legend", "rankedlegend", "ranked_legend" ->
                    explicit(AdvancedStatsScope.RANKED, true);
            default -> throw new IllegalArgumentException("Unsupported Advanced Stats scope: " + raw);
        };
    }

    public static AdvancedStatsScopeSelection all() {
        return all(true);
    }

    public Kind kind() {
        return kind;
    }

    public List<AdvancedStatsScope> scopes() {
        return scopes;
    }

    public String apiValue() {
        return apiValue;
    }

    public boolean supplied() {
        return supplied;
    }

    public boolean isAll() {
        return kind == Kind.ALL;
    }

    public boolean isRegular() {
        return kind == Kind.REGULAR;
    }

    public boolean isCompetitive() {
        return kind == Kind.COMPETITIVE;
    }

    public boolean isSingleScope() {
        return scopes.size() == 1;
    }

    public AdvancedStatsScope singleScope() {
        if (!isSingleScope()) return null;
        return scopes.getFirst();
    }

    private static AdvancedStatsScopeSelection all(boolean supplied) {
        return new AdvancedStatsScopeSelection(Kind.ALL,
                List.copyOf(EnumSet.allOf(AdvancedStatsScope.class)), "all", supplied);
    }

    private static AdvancedStatsScopeSelection explicit(AdvancedStatsScope scope, boolean supplied) {
        return new AdvancedStatsScopeSelection(Kind.EXPLICIT, List.of(scope), scope.apiValue(), supplied);
    }

    private static String normalize(String raw) {
        return raw.trim().toLowerCase(Locale.ROOT).replace('-', '_').replace('/', '_');
    }
}
