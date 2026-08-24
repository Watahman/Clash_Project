package Java.performance;

import java.util.List;
import java.util.Map;

/** Uses a secondary history source only when the configured primary fails. */
public final class FallbackHistoricalPlayerDataProvider
        implements HistoricalPlayerDataProvider {
    private final HistoricalPlayerDataProvider primary;
    private final HistoricalPlayerDataProvider fallback;

    public FallbackHistoricalPlayerDataProvider(
            HistoricalPlayerDataProvider primary,
            HistoricalPlayerDataProvider fallback
    ) {
        this.primary = primary;
        this.fallback = fallback;
    }

    @Override
    public Map<String, HistoricalPlayerData> getPlayerWarHistory(List<String> playerTags)
            throws Exception {
        try {
            return primary.getPlayerWarHistory(playerTags);
        } catch (Exception primaryFailure) {
            return fallback.getPlayerWarHistory(playerTags);
        }
    }

    @Override
    public String providerName() {
        return primary.providerName() + "-with-" + fallback.providerName() + "-fallback";
    }
}
