package Java;

import java.net.URI;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

final class OAuthPkce {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String DEFAULT_DESTINATION = "/subpages/dashboard.html";

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
        if (value == null || value.isBlank() || value.contains("\r") || value.contains("\n") || value.contains("\\")) {
            return DEFAULT_DESTINATION;
        }
        try {
            URI uri = URI.create(value).normalize();
            String path = uri.getRawPath();
            if (uri.isAbsolute() || uri.getRawAuthority() != null || path == null || !path.startsWith("/subpages/")) {
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

    record Flow(String verifier, String challenge) {}
}
