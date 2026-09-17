package Java.advancedstats;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/** Value types shared by the progression source and its read service. */
public final class AdvancedStatsProgressionModels {
    private AdvancedStatsProgressionModels() {}

    public enum Kind {
        TOWN_HALL("townHall"),
        HERO("hero"),
        PET("pet"),
        EQUIPMENT("equipment"),
        DONATION("donation");

        private final String apiValue;

        Kind(String apiValue) {
            this.apiValue = apiValue;
        }

        public String apiValue() {
            return apiValue;
        }
    }

    public enum Coverage {
        COMPLETE("complete"),
        PARTIAL("partial"),
        UNAVAILABLE("unavailable");

        private final String apiValue;

        Coverage(String apiValue) {
            this.apiValue = apiValue;
        }

        public String apiValue() {
            return apiValue;
        }
    }

    /** One dated change observed in an upstream history source. */
    public record Event(
            String eventKey,
            Kind kind,
            String entityKey,
            String name,
            Long previous,
            Long current,
            Long delta,
            Instant eventAt,
            Instant observedAt,
            String source,
            Coverage coverage
    ) {
        public Event {
            eventKey = requiredText(eventKey, "eventKey");
            if (eventKey.length() > 128) throw new IllegalArgumentException("eventKey is too long");
            Objects.requireNonNull(kind, "kind");
            entityKey = requiredText(entityKey, "entityKey");
            name = requiredText(name, "name");
            validateValue(previous, "previous");
            validateValue(current, "current");
            if (delta != null && (current == null || previous == null)) {
                throw new IllegalArgumentException("delta requires previous and current");
            }
            Objects.requireNonNull(eventAt, "eventAt");
            Objects.requireNonNull(observedAt, "observedAt");
            source = requiredText(source, "source");
            Objects.requireNonNull(coverage, "coverage");
        }

        public Event withCoverage(Coverage replacement) {
            return new Event(eventKey, kind, entityKey, name, previous, current, delta,
                    eventAt, observedAt, source, replacement);
        }

        private static void validateValue(Long value, String field) {
            if (value != null && value < 0) throw new IllegalArgumentException(field + " cannot be negative");
        }
    }

    /** Source-level status that can be safely serialized without raw upstream errors. */
    public record SourceStatus(
            String sourceId,
            Coverage coverage,
            int records,
            int invalidRecords,
            String failureCode
    ) {
        public SourceStatus {
            sourceId = requiredText(sourceId, "sourceId");
            Objects.requireNonNull(coverage, "coverage");
            if (records < 0 || invalidRecords < 0) {
                throw new IllegalArgumentException("source record counts cannot be negative");
            }
            failureCode = failureCode == null ? "" : failureCode.trim();
        }

        public static SourceStatus complete(String sourceId, int records, int invalidRecords) {
            Coverage coverage = invalidRecords == 0 ? Coverage.COMPLETE : Coverage.PARTIAL;
            return new SourceStatus(sourceId, coverage, records, invalidRecords, "");
        }

        public static SourceStatus partial(String sourceId, int records, int invalidRecords) {
            return new SourceStatus(sourceId, Coverage.PARTIAL, records, invalidRecords, "INVALID_RESPONSE");
        }

        public static SourceStatus unavailable(String sourceId, String failureCode) {
            return new SourceStatus(sourceId, Coverage.UNAVAILABLE, 0, 0,
                    failureCode == null || failureCode.isBlank() ? "UPSTREAM_UNAVAILABLE" : failureCode);
        }
    }

    /** Normalized data returned by one bounded source fetch. */
    public record SourceData(
            List<Event> events,
            List<SourceStatus> sources,
            Instant fetchedAt
    ) {
        public SourceData {
            events = events == null ? List.of() : List.copyOf(events);
            sources = sources == null ? List.of() : List.copyOf(sources);
            Objects.requireNonNull(fetchedAt, "fetchedAt");
        }

        public boolean hasAvailableSource() {
            return sources.stream().anyMatch(status -> status.coverage() != Coverage.UNAVAILABLE);
        }
    }

    private static String requiredText(String value, String field) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isBlank()) throw new IllegalArgumentException(field + " is required");
        return normalized;
    }
}
