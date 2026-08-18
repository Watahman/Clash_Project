package Java.cwlhistory;

import Java.Config;

public final class HistoricalCwlProviderFactory {
    private HistoricalCwlProviderFactory() {}

    public static HistoricalCwlDataProvider create(Config config) {
        return new ClashKingV2CwlProvider(config.getClashKingBaseUrl());
    }
}
