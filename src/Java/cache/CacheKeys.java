package Java.cache;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

public final class CacheKeys {
    private static final Pattern CLASH_TAG = Pattern.compile("^#[0289PYLQGRJCUV]{3,15}$");

    private CacheKeys() {}

    public static String clashGet(String path) {
        return "clash:get:" + encode(normalizePath(path));
    }

    public static String normalizeTag(String value) {
        if (value == null) return "";
        String tag = value.trim().toUpperCase();
        if (tag.startsWith("%23")) tag = "#" + tag.substring(3);
        if (tag.isBlank()) return "";
        return tag.startsWith("#") ? tag : "#" + tag;
    }

    public static String requireValidTag(String value) {
        String tag = normalizeTag(value);
        if (!CLASH_TAG.matcher(tag).matches()) {
            throw new IllegalArgumentException("Ongeldige speler- of clantag");
        }
        return tag;
    }

    private static String normalizePath(String path) {
        return path == null ? "" : path.trim();
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
