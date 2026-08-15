package Java.advancedstats;

import java.util.Objects;

/** One capability declaration from a provider or a composed fallback adapter. */
public record AdvancedStatsCapability(
        AdvancedStatsScope scope,
        AdvancedStatsCapabilityOperation operation,
        AdvancedStatsCapabilityStatus status,
        String sourceId,
        String reason
) {
    public AdvancedStatsCapability {
        Objects.requireNonNull(scope, "scope");
        Objects.requireNonNull(operation, "operation");
        Objects.requireNonNull(status, "status");
        sourceId = requireText(sourceId, "sourceId");
        reason = normalize(reason);
        if (status != AdvancedStatsCapabilityStatus.SUPPORTED && reason.isBlank()) {
            throw new IllegalArgumentException("reason is required for partial or unsupported capabilities");
        }
    }

    public boolean usable() {
        return status.usable();
    }

    private static String requireText(String value, String field) {
        String normalized = normalize(value);
        if (normalized.isBlank()) throw new IllegalArgumentException(field + " is required");
        return normalized;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
