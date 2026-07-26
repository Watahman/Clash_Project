package Java.performance;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public interface HistoricalPlayerDataProvider {
    Map<String, HistoricalPlayerData> getPlayerWarHistory(List<String> playerTags) throws Exception;

    default Map<String, HistoricalPlayerData> getPlayerCwlHistory(List<String> playerTags) throws Exception {
        Map<String, HistoricalPlayerData> result = new LinkedHashMap<>();
        getPlayerWarHistory(playerTags).forEach((tag, data) -> result.put(tag, new HistoricalPlayerData(
                data.playerTag(),
                data.attacks().stream().filter(attack -> attack.warType() == HistoricalWarType.CWL).toList(),
                data.participation().stream()
                        .filter(item -> item.warType() == HistoricalWarType.CWL)
                        .toList(),
                data.source(),
                data.available()
        )));
        return result;
    }

    default Map<String, List<HistoricalParticipation>> getWarParticipation(List<String> playerTags)
            throws Exception {
        Map<String, List<HistoricalParticipation>> result = new LinkedHashMap<>();
        getPlayerWarHistory(playerTags).forEach((tag, data) -> result.put(tag, data.participation()));
        return result;
    }

    String providerName();
}
