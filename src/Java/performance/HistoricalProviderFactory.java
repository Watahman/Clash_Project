package Java.performance;

import Java.Config;

public final class HistoricalProviderFactory {
    private HistoricalProviderFactory() {}

    public static HistoricalPlayerDataProvider create(Config config) {
        return new ClashKingV2Provider(config.getClashKingBaseUrl());
    }
}
