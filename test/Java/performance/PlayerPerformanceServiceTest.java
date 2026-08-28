package Java.performance;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PlayerPerformanceServiceTest {
    @Test
    void loadsMissingPlayersInBoundedSequentialProviderBatches() throws Exception {
        List<List<String>> providerCalls = new ArrayList<>();
        HistoricalPlayerDataProvider provider = new HistoricalPlayerDataProvider() {
            @Override
            public Map<String, HistoricalPlayerData> getPlayerWarHistory(List<String> tags) {
                providerCalls.add(List.copyOf(tags));
                Map<String, HistoricalPlayerData> result = new LinkedHashMap<>();
                tags.forEach(tag -> result.put(
                        tag, new HistoricalPlayerData(tag, List.of(), List.of(), "test", true)
                ));
                return result;
            }

            @Override
            public String providerName() {
                return "test";
            }
        };

        List<String> tags = new ArrayList<>();
        for (int index = 0; index < 45; index++) tags.add(tag(index));

        Map<String, PlayerPerformanceResult> result =
                new PlayerPerformanceService(provider).getPerformance(tags);

        assertEquals(45, result.size());
        assertEquals(List.of(20, 20, 5), providerCalls.stream().map(List::size).toList());
        assertEquals(tags.subList(0, 20), providerCalls.get(0));
        assertEquals(tags.subList(20, 40), providerCalls.get(1));
        assertEquals(tags.subList(40, 45), providerCalls.get(2));
    }

    private static String tag(int value) {
        char[] alphabet = {'0', '2', '8', '9'};
        char[] suffix = new char[3];
        for (int index = suffix.length - 1; index >= 0; index--) {
            suffix[index] = alphabet[value % alphabet.length];
            value /= alphabet.length;
        }
        return "#P" + new String(suffix);
    }
}
