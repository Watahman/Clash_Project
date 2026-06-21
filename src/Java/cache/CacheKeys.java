package Java.cache;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

public final class CacheKeys {
    private CacheKeys() {}

    public static String clashGet(String path) {
        return "clash:get:" + encode(normalizePath(path));
    }

    public static String normalizeTag(String value) {
        if (value == null) return "";
        String tag = value.trim().toUpperCase();
        if (tag.isBlank()) return "";
        return tag.startsWith("#") ? tag : "#" + tag;
    }

    private static String normalizePath(String path) {
        return path == null ? "" : path.trim();
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
