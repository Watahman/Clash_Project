package Java.performance;

import Java.Config;

public final class HistoricalProviderFactory {
    private HistoricalProviderFactory() {}

    public static HistoricalPlayerDataProvider create(Config config) {
        HistoricalPlayerDataProvider legacy =
                new ClashKingLegacyProvider(config.getClashKingLegacyBaseUrl());
        if (!"v2".equalsIgnoreCase(config.getClashKingApiVersion())) return legacy;

        HistoricalPlayerDataProvider v2 =
                new ClashKingV2Provider(config.getClashKingV2BaseUrl());
        return config.isClashKingLegacyFallbackEnabled()
                ? new FallbackHistoricalPlayerDataProvider(v2, legacy)
                : v2;
    }
}
