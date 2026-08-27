package Java;

import Java.cwlhistory.ClashKingV2CwlProvider;
import Java.cwlhistory.HistoricalCwlProviderFactory;
import Java.performance.ClashKingV2Provider;
import Java.performance.HistoricalProviderFactory;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;

class ClashKingProviderFactoryTest {
    @Test
    void factoriesAlwaysCreateV2Providers() {
        Config config = new Config();
        config._CLASHKING_BASE_URL = "http://127.0.0.1";

        assertInstanceOf(
                ClashKingV2Provider.class,
                HistoricalProviderFactory.create(config)
        );
        assertInstanceOf(
                ClashKingV2CwlProvider.class,
                HistoricalCwlProviderFactory.create(config)
        );
    }
}
