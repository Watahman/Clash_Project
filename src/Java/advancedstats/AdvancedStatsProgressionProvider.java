package Java.advancedstats;

import Java.Config;
import Java.cache.CacheKeys;
import Java.performance.ClashKingHttpClient;
import com.google.gson.JsonElement;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static Java.advancedstats.AdvancedStatsProgressionModels.Event;
import static Java.advancedstats.AdvancedStatsProgressionModels.SourceData;
import static Java.advancedstats.AdvancedStatsProgressionModels.SourceStatus;

/** ClashKing V2 adapter for the bounded, dated progression evidence we can support today. */
public final class AdvancedStatsProgressionProvider implements AdvancedStatsProgressionSource {
    private static final Duration CACHE_TTL = Duration.ofMinutes(5);
    private static final int CACHE_LIMIT = 128;
    private static final String CHANGES_SOURCE = "clashking-v2/history/changes";
    private static final String DONATIONS_SOURCE = "clashking-v2/history/stats/donated";

    public interface Transport {
        JsonElement changes(String playerTag) throws Exception;

        JsonElement donations(String playerTag) throws Exception;
    }

    private final Transport transport;
    private final Map<String, CacheEntry> cache = new LinkedHashMap<>(16, 0.75f, true);

    public AdvancedStatsProgressionProvider(Config config) {
        if (config == null) throw new IllegalArgumentException("config is required");
        this.transport = new HttpTransport(new ClashKingHttpClient(
                config.getClashKingBaseUrl(), "ClashKing V2 progression"));
    }

    public AdvancedStatsProgressionProvider(String baseUrl) {
        this.transport = new HttpTransport(new ClashKingHttpClient(baseUrl, "ClashKing V2 progression"));
    }

    public AdvancedStatsProgressionProvider(Transport transport) {
        if (transport == null) throw new IllegalArgumentException("transport is required");
        this.transport = transport;
    }

    @Override
    public String sourceId() {
        return "clashking-v2";
    }

    @Override
    public synchronized SourceData fetch(String playerTag, Instant observedAt) {
        String tag = CacheKeys.requireValidTag(playerTag);
        Instant fetchedAt = observedAt == null ? Instant.now() : observedAt;
        CacheEntry cached = cache.get(tag);
        if (cached != null && !cached.expiresAt().isBefore(Instant.now())) return cached.data();

        SourceData data = collect(tag, fetchedAt);
        cache.put(tag, new CacheEntry(data, Instant.now().plus(CACHE_TTL)));
        trimCache();
        return data;
    }

    private SourceData collect(String tag, Instant observedAt) {
        List<Event> events = new ArrayList<>();
        List<SourceStatus> statuses = new ArrayList<>();
        readChanges(tag, observedAt, events, statuses);
        readDonations(tag, observedAt, events, statuses);
        return new SourceData(events, statuses, observedAt);
    }

    private void readChanges(String tag, Instant observedAt, List<Event> events,
                             List<SourceStatus> statuses) {
        try {
            AdvancedStatsProgressionNormalizer.Result result =
                    AdvancedStatsProgressionNormalizer.changes(
                            transport.changes(tag), observedAt, CHANGES_SOURCE);
            events.addAll(withCoverage(result.events(), result.invalidRecords()));
            statuses.add(sourceStatus(CHANGES_SOURCE, result));
        } catch (Exception failure) {
            statuses.add(SourceStatus.unavailable(CHANGES_SOURCE, failureCode(failure)));
        }
    }

    private void readDonations(String tag, Instant observedAt, List<Event> events,
                               List<SourceStatus> statuses) {
        try {
            AdvancedStatsProgressionNormalizer.Result result =
                    AdvancedStatsProgressionNormalizer.donations(
                            transport.donations(tag), observedAt, DONATIONS_SOURCE);
            events.addAll(withCoverage(result.events(), result.invalidRecords()));
            statuses.add(sourceStatus(DONATIONS_SOURCE, result));
        } catch (Exception failure) {
            statuses.add(SourceStatus.unavailable(DONATIONS_SOURCE, failureCode(failure)));
        }
    }

    private void trimCache() {
        while (cache.size() > CACHE_LIMIT) cache.remove(cache.keySet().iterator().next());
    }

    private static String failureCode(Exception failure) {
        return failure instanceof IllegalArgumentException ? "INVALID_RESPONSE" : "UPSTREAM_UNAVAILABLE";
    }

    private static SourceStatus sourceStatus(String source,
                                             AdvancedStatsProgressionNormalizer.Result result) {
        return result.invalidRecords() == 0
                ? SourceStatus.complete(source, result.records(), 0)
                : SourceStatus.partial(source, result.records(), result.invalidRecords());
    }

    private static List<Event> withCoverage(List<Event> events, int invalidRecords) {
        if (invalidRecords == 0) return events;
        return events.stream().map(event -> event.withCoverage(
                AdvancedStatsProgressionModels.Coverage.PARTIAL)).toList();
    }

    private static String path(String tag, String suffix) {
        return "/v2/player/" + URLEncoder.encode(tag, StandardCharsets.UTF_8) + suffix;
    }

    private record CacheEntry(SourceData data, Instant expiresAt) {}

    private static final class HttpTransport implements Transport {
        private final ClashKingHttpClient client;

        private HttpTransport(ClashKingHttpClient client) {
            this.client = client;
        }

        @Override
        public JsonElement changes(String playerTag) throws Exception {
            return client.getElement(path(playerTag, "/history/changes"));
        }

        @Override
        public JsonElement donations(String playerTag) throws Exception {
            return client.getElement(path(playerTag, "/history/stats?type=donated"));
        }
    }
}
