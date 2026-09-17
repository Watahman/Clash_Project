package Java.advancedstats;

import Java.HttpException;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/** Owner-scoped dispatch for historical sections loaded only when selected. */
public final class AdvancedStatsInsightsService {
    public enum Section {
        WAR_CWL("warCwl"), PROGRESSION("progression"), LEAGUE("league");

        private final String apiValue;

        Section(String apiValue) { this.apiValue = apiValue; }

        static Section parse(String raw) {
            for (Section section : values()) {
                if (section.apiValue.equals(raw)) return section;
            }
            throw new IllegalArgumentException("Unsupported Advanced Stats insight section");
        }
    }

    @FunctionalInterface
    public interface TrackingAccess {
        AdvancedStatsModels.TrackingState require(UUID userId, String playerTag) throws Exception;
    }

    @FunctionalInterface
    public interface SectionReader {
        JsonObject read(String playerTag, AdvancedStatsPeriod period, Instant from) throws Exception;
    }

    @FunctionalInterface
    public interface CurrentSeasonReader {
        JsonObject read(String playerTag) throws Exception;
    }

    private final TrackingAccess access;
    private final Map<Section, SectionReader> readers;
    private final CurrentSeasonReader currentSeasonReader;
    private final Clock clock;

    public AdvancedStatsInsightsService(TrackingAccess access, Map<Section, SectionReader> readers, Clock clock) {
        this(access, readers, null, clock);
    }

    public AdvancedStatsInsightsService(TrackingAccess access, Map<Section, SectionReader> readers,
                                        CurrentSeasonReader currentSeasonReader, Clock clock) {
        this.access = Objects.requireNonNull(access, "access");
        this.readers = Map.copyOf(readers);
        this.currentSeasonReader = currentSeasonReader;
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public JsonObject read(UUID userId, String rawPlayerTag, String rawPeriod, String rawSection) throws Exception {
        Section section = Section.parse(rawSection);
        boolean currentSeason = "current-season".equals(rawPeriod);
        if (currentSeason && section != Section.LEAGUE) {
            throw new IllegalArgumentException("Current season is only supported for league insights");
        }
        if (currentSeason && currentSeasonReader == null) {
            throw new IllegalStateException("Current season reader is not configured");
        }
        if (currentSeason) {
            AdvancedStatsModels.TrackingState tracking = access.require(userId, rawPlayerTag);
            JsonObject response = envelope(tracking, "current-season", section, null);
            response.add("data", currentSeasonReader.read(tracking.playerTag()));
            return response;
        }
        AdvancedStatsPeriod period = AdvancedStatsPeriod.parse(rawPeriod);
        AdvancedStatsModels.TrackingState tracking = access.require(userId, rawPlayerTag);
        SectionReader reader = readers.get(section);
        if (reader == null) throw new IllegalStateException("Insight reader is not configured: " + section);
        Instant from = period.from(clock.instant());
        JsonObject response = envelope(tracking, period.apiValue(), section, from);
        response.add("data", reader.read(tracking.playerTag(), period, from));
        return response;
    }

    private static JsonObject envelope(AdvancedStatsModels.TrackingState tracking, String period,
                                       Section section, Instant from) {
        JsonObject response = new JsonObject();
        response.addProperty("playerTag", tracking.playerTag());
        response.addProperty("status", tracking.status().name());
        response.addProperty("period", period);
        response.addProperty("section", section.apiValue);
        if (from == null) response.add("from", JsonNull.INSTANCE);
        else response.addProperty("from", from.toString());
        return response;
    }

    public static TrackingAccess lifecycleAccess(AdvancedStatsLifecycleService lifecycle) {
        Objects.requireNonNull(lifecycle, "lifecycle");
        return (userId, playerTag) -> lifecycle.status(userId, playerTag)
                .orElseThrow(() -> new HttpException(404,
                        "{\"error\":\"Advanced Stats tracking is not enabled\","
                                + "\"code\":\"ADVANCED_STATS_NOT_ENABLED\"}"));
    }
}
