package Java.advancedstats;

import Java.Config;
import Java.cache.CacheKeys;
import com.google.gson.JsonArray;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import static Java.advancedstats.AdvancedStatsProgressionModels.Coverage;
import static Java.advancedstats.AdvancedStatsProgressionModels.Event;
import static Java.advancedstats.AdvancedStatsProgressionModels.Kind;
import static Java.advancedstats.AdvancedStatsProgressionModels.SourceData;
import static Java.advancedstats.AdvancedStatsProgressionModels.SourceStatus;

/** Owner-route-ready read model for the progression tab. */
public final class AdvancedStatsProgressionService {
    private final AdvancedStatsProgressionSource source;

    public AdvancedStatsProgressionService(Config config) {
        this(new AdvancedStatsProgressionProvider(config));
    }

    public AdvancedStatsProgressionService(AdvancedStatsProgressionSource source) {
        this.source = Objects.requireNonNull(source, "source");
    }

    /** Uses the current instant as the upper bound and source observation time. */
    public JsonObject read(String playerTag, AdvancedStatsPeriod period, Instant from) {
        return read(playerTag, period, from, Instant.now());
    }

    /** Clock-injectable overload used by deterministic callers and tests. */
    public JsonObject read(String playerTag, AdvancedStatsPeriod period,
                           Instant from, Instant now) {
        String tag = CacheKeys.requireValidTag(playerTag);
        Objects.requireNonNull(period, "period");
        Objects.requireNonNull(now, "now");
        Instant start = from != null ? from : period.from(now);
        if (start != null && start.isAfter(now)) throw new IllegalArgumentException("from is after now");
        try {
            SourceData data = source.fetch(tag, now);
            return response(tag, period, start, now, data);
        } catch (Exception failure) {
            return unavailable(tag, period, start, now, failureCode(failure));
        }
    }

    private JsonObject response(String tag, AdvancedStatsPeriod period, Instant from,
                                Instant now, SourceData data) {
        List<Event> events = periodEvents(data.events(), from, now);
        List<Event> knownEvents = periodEvents(data.events(), null, now);
        JsonObject response = envelope(tag, period, from, now);
        response.addProperty("fetchedAt", data.fetchedAt().toString());
        response.add("coverage", coverage(data.sources(), events.size()));
        response.add("current", current(knownEvents));
        response.add("changes", changes(events));
        response.add("donation", donation(events, knownEvents, donationStatus(data.sources())));
        response.add("unsupported", unsupported());
        return response;
    }

    private static List<Event> periodEvents(List<Event> input, Instant from, Instant to) {
        Map<String, Event> unique = new LinkedHashMap<>();
        if (input != null) {
            for (Event event : input) {
                if (event == null || event.eventAt().isAfter(to)
                        || (from != null && event.eventAt().isBefore(from))) continue;
                unique.putIfAbsent(event.eventKey(), event);
            }
        }
        List<Event> events = new ArrayList<>(unique.values());
        events.sort(java.util.Comparator.comparing(Event::eventAt).thenComparing(Event::eventKey));
        return List.copyOf(events);
    }

    private static JsonObject envelope(String tag, AdvancedStatsPeriod period,
                                       Instant from, Instant now) {
        JsonObject result = new JsonObject();
        result.addProperty("section", "progression");
        result.addProperty("playerTag", tag);
        result.addProperty("period", period.apiValue());
        addInstant(result, "from", from);
        result.addProperty("to", now.toString());
        result.addProperty("generatedAt", now.toString());
        return result;
    }

    private static JsonObject current(List<Event> events) {
        Map<Kind, Map<String, Event>> latest = new EnumMap<>(Kind.class);
        for (Kind kind : Kind.values()) latest.put(kind, new LinkedHashMap<>());
        for (Event event : events) {
            latest.get(event.kind()).put(event.entityKey(), event);
        }
        JsonObject result = new JsonObject();
        addCurrent(result, "townHall", latest.get(Kind.TOWN_HALL).get("townhall"));
        result.add("heroes", currentList(latest.get(Kind.HERO)));
        result.add("pets", currentList(latest.get(Kind.PET)));
        result.add("equipment", currentList(latest.get(Kind.EQUIPMENT)));
        result.addProperty("basis", "latest_observed_event");
        return result;
    }

    private static void addCurrent(JsonObject target, String field, Event event) {
        if (event == null) {
            target.add(field, JsonNull.INSTANCE);
            return;
        }
        target.add(field, currentEntry(event));
    }

    private static JsonArray currentList(Map<String, Event> events) {
        JsonArray result = new JsonArray();
        for (Event event : events.values()) result.add(currentEntry(event));
        return result;
    }

    private static JsonObject currentEntry(Event event) {
        JsonObject result = new JsonObject();
        result.addProperty("entityKey", event.entityKey());
        result.addProperty("name", event.name());
        addNumber(result, "value", event.current());
        result.addProperty("asOf", event.eventAt().toString());
        result.addProperty("coverage", event.coverage().apiValue());
        result.addProperty("source", event.source());
        return result;
    }

    private static JsonArray changes(List<Event> events) {
        JsonArray result = new JsonArray();
        for (Event event : events) {
            JsonObject row = new JsonObject();
            row.addProperty("eventKey", event.eventKey());
            row.addProperty("kind", event.kind().apiValue());
            row.addProperty("entityKey", event.entityKey());
            row.addProperty("name", event.name());
            addNumber(row, "previous", event.previous());
            addNumber(row, "current", event.current());
            addNumber(row, "delta", event.delta());
            row.addProperty("eventAt", event.eventAt().toString());
            row.addProperty("observedAt", event.observedAt().toString());
            row.addProperty("coverage", event.coverage().apiValue());
            row.addProperty("source", event.source());
            result.add(row);
        }
        return result;
    }

    private static JsonObject donation(List<Event> events, List<Event> knownEvents, SourceStatus status) {
        List<Event> donations = events.stream().filter(event -> event.kind() == Kind.DONATION).toList();
        List<Event> knownDonations = knownEvents.stream()
                .filter(event -> event.kind() == Kind.DONATION).toList();
        JsonObject result = new JsonObject();
        Event latest = donations.isEmpty() ? null : donations.getLast();
        Event knownLatest = knownDonations.isEmpty() ? null : knownDonations.getLast();
        addNumber(result, "current", knownLatest == null ? null : knownLatest.current());
        addInstant(result, "currentAsOf", knownLatest == null ? null : knownLatest.eventAt());
        addNumber(result, "delta", sumDelta(donations));
        result.addProperty("eventCount", donations.size());
        addInstant(result, "latestEventAt", latest == null ? null : latest.eventAt());
        result.addProperty("coverage", status == null ? Coverage.UNAVAILABLE.apiValue() : status.coverage().apiValue());
        return result;
    }

    private static Long sumDelta(List<Event> events) {
        if (events.isEmpty()) return null;
        long total = 0;
        for (Event event : events) {
            if (event.delta() != null) total = safeAdd(total, event.delta());
        }
        return total;
    }

    private static JsonObject coverage(List<SourceStatus> statuses, int eventCount) {
        JsonObject result = new JsonObject();
        Coverage overall = overallCoverage(statuses);
        result.addProperty("status", overall.apiValue());
        result.addProperty("eventCount", eventCount);
        result.addProperty("hasHistoricalData", eventCount > 0);
        JsonArray sources = new JsonArray();
        if (statuses != null) {
            for (SourceStatus status : statuses) sources.add(sourceStatus(status));
        }
        result.add("sources", sources);
        return result;
    }

    private static JsonObject sourceStatus(SourceStatus status) {
        JsonObject result = new JsonObject();
        result.addProperty("sourceId", status.sourceId());
        result.addProperty("status", status.coverage().apiValue());
        result.addProperty("records", status.records());
        result.addProperty("invalidRecords", status.invalidRecords());
        if (!status.failureCode().isBlank()) result.addProperty("failureCode", status.failureCode());
        return result;
    }

    private static Coverage overallCoverage(List<SourceStatus> statuses) {
        if (statuses == null || statuses.isEmpty()) return Coverage.UNAVAILABLE;
        boolean allUnavailable = true;
        boolean partial = false;
        for (SourceStatus status : statuses) {
            allUnavailable &= status.coverage() == Coverage.UNAVAILABLE;
            partial |= status.coverage() != Coverage.COMPLETE;
        }
        return allUnavailable ? Coverage.UNAVAILABLE : partial ? Coverage.PARTIAL : Coverage.COMPLETE;
    }

    private static SourceStatus donationStatus(List<SourceStatus> statuses) {
        if (statuses == null) return null;
        return statuses.stream().filter(status -> status.sourceId().endsWith("/donated")).findFirst().orElse(null);
    }

    private static JsonObject unsupported() {
        JsonObject result = new JsonObject();
        result.addProperty("trophy", "no_dated_source");
        result.addProperty("league", "no_dated_source");
        return result;
    }

    private static JsonObject unavailable(String tag, AdvancedStatsPeriod period, Instant from,
                                         Instant now, String failureCode) {
        JsonObject response = envelope(tag, period, from, now);
        response.add("coverage", coverage(List.of(
                SourceStatus.unavailable("clashking-v2", failureCode)), 0));
        response.add("current", current(List.of()));
        response.add("changes", new JsonArray());
        response.add("donation", donation(List.of(), List.of(), null));
        response.add("unsupported", unsupported());
        return response;
    }

    private static void addInstant(JsonObject object, String field, Instant value) {
        if (value == null) object.add(field, JsonNull.INSTANCE);
        else object.addProperty(field, value.toString());
    }

    private static void addNumber(JsonObject object, String field, Long value) {
        if (value == null) object.add(field, JsonNull.INSTANCE);
        else object.addProperty(field, value);
    }

    private static long safeAdd(long left, long right) {
        if (right > 0 && Long.MAX_VALUE - left < right) return Long.MAX_VALUE;
        if (right < 0 && Long.MIN_VALUE - left > right) return Long.MIN_VALUE;
        return left + right;
    }

    private static String failureCode(Exception failure) {
        return failure instanceof IllegalArgumentException ? "INVALID_REQUEST" : "UPSTREAM_UNAVAILABLE";
    }
}
