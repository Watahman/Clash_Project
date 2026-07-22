package Java;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OAuthPkceTest {
    @Test
    void createsUrlSafeVerifierAndMatchingSha256Challenge() throws Exception {
        OAuthPkce.Flow flow = OAuthPkce.create();
        byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(flow.verifier().getBytes(StandardCharsets.US_ASCII));
        String expectedChallenge = Base64.getUrlEncoder().withoutPadding().encodeToString(digest);

        assertTrue(flow.verifier().length() >= 43);
        assertFalse(flow.verifier().contains("="));
        assertEquals(expectedChallenge, flow.challenge());
        assertNotEquals(flow.verifier(), OAuthPkce.create().verifier());
    }

    @Test
    void onlyAllowsInternalSubPageDestinations() {
        assertEquals(
                "/subPages/groups.html?tab=polls#active",
                OAuthPkce.sanitizeNext("/subPages/groups.html?tab=polls#active")
        );
        assertEquals("/subPages/dashboard.html", OAuthPkce.sanitizeNext("https://evil.example/subPages/groups.html"));
        assertEquals("/subPages/dashboard.html", OAuthPkce.sanitizeNext("//evil.example/subPages/groups.html"));
        assertEquals("/subPages/dashboard.html", OAuthPkce.sanitizeNext("/subPages/../../index.html"));
        assertEquals("/subPages/dashboard.html", OAuthPkce.sanitizeNext("/subPages/groups.html\r\nLocation:https://evil.example"));
    }
}
