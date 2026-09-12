package Java.advancedstats;

import Java.HttpException;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.util.UUID;

/** Centralizes selected-scope routing while keeping the public store contracts stable. */
final class AdvancedStatsScopeReadSupport {
    private AdvancedStatsScopeReadSupport() {}

    static JsonObject overview(AdvancedStatsReadService.Store store, UUID trackingId,
                                AdvancedStatsScopeSelection selection, Instant from) throws Exception {
        if (selection == null || !selection.supplied() || selection.isAll()) {
            return store.compactOverview(trackingId, from);
        }
        return requireScoped(store).overview(trackingId, selection, from);
    }

    static JsonElement units(AdvancedStatsReadService.Store store, UUID trackingId,
                             AdvancedStatsScopeSelection selection, Instant from,
                             AdvancedStatsUnitCategory category) throws Exception {
        if (selection == null || !selection.supplied() || selection.isAll()) {
            return store.compactUnits(trackingId, from, category);
        }
        return requireScoped(store).units(trackingId, selection, from, category);
    }

    static JsonElement armies(AdvancedStatsReadService.Store store, UUID trackingId,
                              AdvancedStatsScopeSelection selection, Instant from, int limit)
            throws Exception {
        if (selection == null || !selection.supplied() || selection.isAll()) {
            return store.compactArmies(trackingId, from, limit);
        }
        return requireScoped(store).armies(trackingId, selection, from, limit);
    }

    static JsonElement trends(AdvancedStatsReadService.Store store, UUID trackingId,
                              AdvancedStatsScopeSelection selection, Instant from) throws Exception {
        if (selection == null || !selection.supplied() || selection.isAll()) {
            return store.compactTrends(trackingId, from);
        }
        return requireScoped(store).trends(trackingId, selection, from);
    }

    static JsonObject overview(AdvancedStatsReadService.ScopedStore store, UUID trackingId,
                                AdvancedStatsScopeSelection selection, Instant from) throws Exception {
        if (selection == null || selection.isAll()) return store.compactOverview(trackingId, from);
        if (selection.isSingleScope()) return store.overview(trackingId, selection.singleScope(), from);
        return aggregator(store).overview(trackingId, from, selection);
    }

    static JsonElement units(AdvancedStatsReadService.ScopedStore store, UUID trackingId,
                             AdvancedStatsScopeSelection selection, Instant from,
                             AdvancedStatsUnitCategory category) throws Exception {
        if (selection == null || selection.isAll()) return store.compactUnits(trackingId, from, category);
        if (selection.isSingleScope()) return store.units(trackingId, selection.singleScope(), from, category);
        return aggregator(store).units(trackingId, from, category, selection);
    }

    static JsonElement armies(AdvancedStatsReadService.ScopedStore store, UUID trackingId,
                              AdvancedStatsScopeSelection selection, Instant from, int limit)
            throws Exception {
        if (selection == null || selection.isAll()) return store.compactArmies(trackingId, from, limit);
        if (selection.isSingleScope()) return store.armies(trackingId, selection.singleScope(), from, limit);
        return aggregator(store).armies(trackingId, from, limit, selection);
    }

    static JsonElement trends(AdvancedStatsReadService.ScopedStore store, UUID trackingId,
                              AdvancedStatsScopeSelection selection, Instant from) throws Exception {
        if (selection == null || selection.isAll()) return store.compactTrends(trackingId, from);
        if (selection.isSingleScope()) return store.trends(trackingId, selection.singleScope(), from);
        return aggregator(store).trends(trackingId, from, selection);
    }

    static AdvancedStatsReadService.ScopedStore requireScoped(AdvancedStatsReadService.Store store)
            throws HttpException {
        if (store instanceof AdvancedStatsReadService.ScopedStore scoped) return scoped;
        throw new HttpException(501,
                "{\"error\":\"Advanced Stats scope reads are not configured\","
                        + "\"code\":\"ADVANCED_STATS_SCOPE_UNAVAILABLE\"}");
    }

    private static AdvancedStatsCompactReadAggregator aggregator(
            AdvancedStatsReadService.ScopedStore store) {
        return new AdvancedStatsCompactReadAggregator(new AdvancedStatsCompactReadAggregator.ScopeReader() {
            @Override
            public JsonObject overview(UUID trackingId, AdvancedStatsScope scope, Instant from)
                    throws Exception {
                return store.overview(trackingId, scope, from);
            }

            @Override
            public JsonElement units(UUID trackingId, AdvancedStatsScope scope, Instant from,
                                     AdvancedStatsUnitCategory category) throws Exception {
                return store.units(trackingId, scope, from, category);
            }

            @Override
            public JsonElement armies(UUID trackingId, AdvancedStatsScope scope, Instant from, int limit)
                    throws Exception {
                return store.armies(trackingId, scope, from, limit);
            }

            @Override
            public JsonElement trends(UUID trackingId, AdvancedStatsScope scope, Instant from)
                    throws Exception {
                return store.trends(trackingId, scope, from);
            }
        });
    }
}
