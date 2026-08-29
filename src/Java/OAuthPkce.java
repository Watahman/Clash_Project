package Java;

import java.net.URI;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Set;

final class OAuthPkce {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String DEFAULT_DESTINATION = "/dashboard";
    private static final Set<String> ALLOWED_EXACT_PATHS = Set.of(
            "/",
            "/404",
            "/about",
            "/achievements",
            "/advanced-stats",
            "/bracket-generator",
            "/changelog",
            "/clan-management",
            "/contact",
            "/cookies",
            "/cwl-planner",
            "/cwl-tracker",
            "/guides",
            "/methodology",
            "/minigames",
            "/privacy",
            "/terms",
            "/dashboard"
    );
    private static final Set<String> ALLOWED_SUBPAGE_PATHS = Set.of(
            "/subpages/achievements",
            "/subpages/achievements.html",
            "/subpages/advanced-stats",
            "/subpages/advanced-stats.html",
            "/subpages/bracket-generator",
            "/subpages/bracket-generator.html",
            "/subpages/contact",
            "/subpages/contact.html",
            "/subpages/cookies",
            "/subpages/cookies.html",
            "/subpages/cwl-operation-board",
            "/subpages/cwl-operation-board.html",
            "/subpages/cwl-planner-drafts",
            "/subpages/cwl-planner-drafts.html",
            "/subpages/cwl-planner",
            "/subpages/cwl-planner.html",
            "/subpages/dashboard",
            "/subpages/dashboard.html",
            "/subpages/explore",
            "/subpages/explore.html",
            "/subpages/groups",
            "/subpages/groups.html",
            "/subpages/minigames",
            "/subpages/minigames.html",
            "/subpages/privacy",
            "/subpages/privacy.html",
            "/subpages/profile",
            "/subpages/profile.html",
            "/subpages/terms",
            "/subpages/terms.html",
            "/subpages/war-operation-board",
            "/subpages/war-operation-board.html"
    );
    private static final Set<String> AUTH_ENTRY_PATHS = Set.of(
            "/subpages/login",
            "/subpages/login.html",
            "/subpages/register",
            "/subpages/register.html"
    );

    private OAuthPkce() {}

    static Flow create() {
        byte[] verifierBytes = new byte[48];
        RANDOM.nextBytes(verifierBytes);
        String verifier = Base64.getUrlEncoder().withoutPadding().encodeToString(verifierBytes);
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(java.nio.charset.StandardCharsets.US_ASCII));
            String challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
            return new Flow(verifier, challenge);
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is niet beschikbaar", impossible);
        }
    }

    static String sanitizeNext(String value) {
        if (value == null || value.isBlank() || containsUnsafeCharacters(value)) {
            return DEFAULT_DESTINATION;
        }
        try {
            URI uri = URI.create(value).normalize();
            String path = uri.getRawPath();
            boolean allowedPath = path != null && isAllowedPath(path);
            if (uri.isAbsolute() || uri.getRawAuthority() != null || path == null || !allowedPath) {
                return DEFAULT_DESTINATION;
            }
            StringBuilder destination = new StringBuilder(path);
            if (uri.getRawQuery() != null && !uri.getRawQuery().isBlank()) destination.append('?').append(uri.getRawQuery());
            if (uri.getRawFragment() != null && !uri.getRawFragment().isBlank()) destination.append('#').append(uri.getRawFragment());
            return destination.toString();
        } catch (IllegalArgumentException invalidUri) {
            return DEFAULT_DESTINATION;
        }
    }

    private static boolean containsUnsafeCharacters(String value) {
        return value.indexOf('\\') >= 0
                || value.indexOf('\r') >= 0
                || value.indexOf('\n') >= 0
                || value.matches(".*%(?i:0d|0a|5c).*");
    }

    private static boolean isAllowedPath(String path) {
        if (isAuthEntryPath(path)) return false;
        return ALLOWED_EXACT_PATHS.contains(path)
                || ALLOWED_SUBPAGE_PATHS.contains(path)
                || path.startsWith("/app/")
                || path.startsWith("/guides/");
    }

    private static boolean isAuthEntryPath(String path) {
        return AUTH_ENTRY_PATHS.contains(path)
                || AUTH_ENTRY_PATHS.stream().anyMatch(entry -> path.startsWith(entry + "/"));
    }

    record Flow(String verifier, String challenge) {}
}
