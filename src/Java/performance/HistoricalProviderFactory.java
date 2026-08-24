package Java.performance;

import Java.Config;

public final class HistoricalProviderFactory {
    private HistoricalProviderFactory() {}

    public static HistoricalPlayerDataProvider create(Config config) {
        HistoricalPlayerDataProvider legacy = createLegacy(config);
        if (!"v2".equalsIgnoreCase(config.getClashKingApiVersion())) return legacy;

        HistoricalPlayerDataProvider v2 = createV2(config);
        return config.isClashKingLegacyFallbackEnabled()
                ? new FallbackHistoricalPlayerDataProvider(v2, legacy)
                : v2;
    }

    public static HistoricalPlayerDataProvider createLegacy(Config config) {
        return new ClashKingLegacyProvider(config.getClashKingLegacyBaseUrl());
    }

    public static HistoricalPlayerDataProvider createV2(Config config) {
        return new ClashKingV2Provider(config.getClashKingV2BaseUrl());
    }
}
