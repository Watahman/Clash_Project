package Java;

import Java.cwlhistory.ClashKingLegacyCwlProvider;
import Java.cwlhistory.ClashKingV2CwlProvider;
import Java.cwlhistory.FallbackHistoricalCwlDataProvider;
import Java.cwlhistory.HistoricalCwlProviderFactory;
import Java.performance.ClashKingLegacyProvider;
import Java.performance.ClashKingV2Provider;
import Java.performance.FallbackHistoricalPlayerDataProvider;
import Java.performance.HistoricalProviderFactory;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;

class ClashKingProviderFactoryTest {
    @Test
    void legacyIsTheDefaultForReleasedHistoryFeatures() {
        Config config = config("legacy");

        assertInstanceOf(
                ClashKingLegacyProvider.class,
                HistoricalProviderFactory.create(config)
        );
        assertInstanceOf(
                ClashKingLegacyCwlProvider.class,
                HistoricalCwlProviderFactory.create(config)
        );
    }

    @Test
    void v2CanBeActivatedWithoutChangingCallSites() {
        Config config = config("v2");

        assertInstanceOf(
                ClashKingV2Provider.class,
                HistoricalProviderFactory.create(config)
        );
        assertInstanceOf(
                ClashKingV2CwlProvider.class,
                HistoricalCwlProviderFactory.create(config)
        );
    }

    @Test
    void explicitV2FactoryRemainsIndependentOfTemporarySwitch() {
        Config config = config("legacy");

        assertInstanceOf(
                ClashKingV2CwlProvider.class,
                HistoricalCwlProviderFactory.createV2(config)
        );
    }

    @Test
    void v2CanOptIntoLegacyFallback() {
        Config config = config("v2");
        config._CLASHKING_FALLBACK_TO_LEGACY = "true";

        assertInstanceOf(
                FallbackHistoricalPlayerDataProvider.class,
                HistoricalProviderFactory.create(config)
        );
        assertInstanceOf(
                FallbackHistoricalCwlDataProvider.class,
                HistoricalCwlProviderFactory.create(config)
        );
    }

    private static Config config(String version) {
        Config config = new Config();
        config._CLASHKING_API_VERSION = version;
        config._CLASHKING_LEGACY_BASE_URL = "http://127.0.0.1";
        config._CLASHKING_V2_BASE_URL = "http://127.0.0.1";
        config._CLASHKING_FALLBACK_TO_LEGACY = "false";
        return config;
    }
}
