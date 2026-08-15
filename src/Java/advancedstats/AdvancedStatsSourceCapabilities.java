package Java.advancedstats;

import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;

/** Immutable per-scope capability matrix. It contains no assumptions about provider endpoints. */
public final class AdvancedStatsSourceCapabilities {
    private final Map<AdvancedStatsScope, Map<AdvancedStatsCapabilityOperation, AdvancedStatsCapability>> matrix;

    public AdvancedStatsSourceCapabilities(Iterable<AdvancedStatsCapability> declarations) {
        Objects.requireNonNull(declarations, "declarations");
        EnumMap<AdvancedStatsScope, Map<AdvancedStatsCapabilityOperation, AdvancedStatsCapability>> copy =
                new EnumMap<>(AdvancedStatsScope.class);
        for (AdvancedStatsScope scope : AdvancedStatsScope.values()) {
            copy.put(scope, new EnumMap<>(AdvancedStatsCapabilityOperation.class));
        }
        for (AdvancedStatsCapability declaration : declarations) {
            Objects.requireNonNull(declaration, "declaration");
            Map<AdvancedStatsCapabilityOperation, AdvancedStatsCapability> byOperation =
                    copy.get(declaration.scope());
            if (byOperation.put(declaration.operation(), declaration) != null) {
                throw new IllegalArgumentException("Duplicate capability: "
                        + declaration.scope() + "/" + declaration.operation());
            }
        }
        for (AdvancedStatsScope scope : AdvancedStatsScope.values()) {
            for (AdvancedStatsCapabilityOperation operation : AdvancedStatsCapabilityOperation.values()) {
                copy.get(scope).putIfAbsent(operation,
                        new AdvancedStatsCapability(scope, operation,
                                AdvancedStatsCapabilityStatus.UNSUPPORTED, "unreported", "not declared"));
            }
            copy.put(scope, Collections.unmodifiableMap(copy.get(scope)));
        }
        matrix = Collections.unmodifiableMap(copy);
    }

    public AdvancedStatsCapability forOperation(
            AdvancedStatsScope scope,
            AdvancedStatsCapabilityOperation operation
    ) {
        Objects.requireNonNull(scope, "scope");
        Objects.requireNonNull(operation, "operation");
        return matrix.get(scope).get(operation);
    }

    public boolean usable(AdvancedStatsScope scope, AdvancedStatsCapabilityOperation operation) {
        return forOperation(scope, operation).usable();
    }

    public Map<AdvancedStatsScope, Map<AdvancedStatsCapabilityOperation, AdvancedStatsCapability>> asMap() {
        return matrix;
    }
}
