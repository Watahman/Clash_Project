package Java.achievements;

import com.google.gson.JsonElement;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Objects;

/** Fetches and normalizes the official clan capital raid-seasons envelope. */
public final class OfficialClanCapitalRaidProvider {
    @FunctionalInterface
    public interface Fetcher {
        JsonElement fetch(String officialPath) throws Exception;
    }

    private final Fetcher fetcher;

    public OfficialClanCapitalRaidProvider(Fetcher fetcher) {
        this.fetcher = Objects.requireNonNull(fetcher, "fetcher");
    }

    public OfficialClanCapitalRaidNormalizer.Result fetch(String clanTag, String playerTag)
            throws Exception {
        return fetch(clanTag, playerTag, null);
    }

    public OfficialClanCapitalRaidNormalizer.Result fetch(
            String clanTag,
            String playerTag,
            Integer clanMemberCount
    ) throws Exception {
        String normalizedClan = normalizeTag(clanTag);
        if (normalizedClan.isBlank()) throw new IllegalArgumentException("clanTag is required");
        JsonElement response = fetcher.fetch(path(normalizedClan));
        return OfficialClanCapitalRaidNormalizer.normalize(response, playerTag, clanMemberCount);
    }

    public static String path(String clanTag) {
        String normalized = normalizeTag(clanTag);
        if (normalized.isBlank()) throw new IllegalArgumentException("clanTag is required");
        return "/clans/" + URLEncoder.encode(normalized, StandardCharsets.UTF_8)
                + "/capitalraidseasons";
    }

    private static String normalizeTag(String tag) {
        String value = tag == null ? "" : tag.trim().toUpperCase(java.util.Locale.ROOT);
        return value.isBlank() ? "" : (value.startsWith("#") ? value : "#" + value);
    }
}
