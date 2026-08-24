package Java.cwlhistory;

import Java.Config;

public final class HistoricalCwlProviderFactory {
    private HistoricalCwlProviderFactory() {}

    public static HistoricalCwlDataProvider create(Config config) {
        HistoricalCwlDataProvider legacy = createLegacy(config);
        if (!"v2".equalsIgnoreCase(config.getClashKingApiVersion())) return legacy;

        HistoricalCwlDataProvider v2 = createV2(config);
        return config.isClashKingLegacyFallbackEnabled()
                ? new FallbackHistoricalCwlDataProvider(v2, legacy)
                : v2;
    }

    public static HistoricalCwlDataProvider createLegacy(Config config) {
        return new ClashKingLegacyCwlProvider(config.getClashKingLegacyBaseUrl());
    }

    /** Explicit V2 route for consumers that must stay on V2 while public history is legacy. */
    public static HistoricalCwlDataProvider createV2(Config config) {
        return new ClashKingV2CwlProvider(config.getClashKingV2BaseUrl());
    }
}
