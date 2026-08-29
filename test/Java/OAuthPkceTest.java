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
    void allowsPublicAndInternalDestinations() {
        assertEquals("/", OAuthPkce.sanitizeNext("/"));
        assertEquals(
                "/guides/cwl-availability?from=planner#workflow",
                OAuthPkce.sanitizeNext("/guides/cwl-availability?from=planner#workflow")
        );
        assertEquals(
                "/guides?from=planner#workflow",
                OAuthPkce.sanitizeNext("/guides?from=planner#workflow")
        );
        assertEquals("/dashboard", OAuthPkce.sanitizeNext("/dashboard"));
        assertEquals("/app/cwl-planner?plan=active", OAuthPkce.sanitizeNext("/app/cwl-planner?plan=active"));
        assertEquals(
                "/subpages/groups.html?tab=polls#active",
                OAuthPkce.sanitizeNext("/subpages/groups.html?tab=polls#active")
        );
        assertEquals("/subpages/groups?tab=polls#active", OAuthPkce.sanitizeNext("/subpages/groups?tab=polls#active"));
        assertEquals("/contact", OAuthPkce.sanitizeNext("/contact"));
        assertEquals("/dashboard", OAuthPkce.sanitizeNext("/subpages/login.html"));
        assertEquals(
                "/dashboard",
                OAuthPkce.sanitizeNext("/subpages/login.html?next=%2Fapp%2Fcwl-tracker")
        );
        assertEquals("/dashboard", OAuthPkce.sanitizeNext("/subpages/register"));
        assertEquals("/dashboard", OAuthPkce.sanitizeNext("/subpages/login.html/help"));
        assertEquals("/dashboard", OAuthPkce.sanitizeNext("https://evil.example/subpages/groups.html"));
        assertEquals("/dashboard", OAuthPkce.sanitizeNext("//evil.example/subpages/groups.html"));
        assertEquals("/dashboard", OAuthPkce.sanitizeNext("/app\\evil"));
        assertEquals("/dashboard", OAuthPkce.sanitizeNext("/subpages/../../index.html"));
        assertEquals("/dashboard", OAuthPkce.sanitizeNext("/subpages/groups.html\r\nLocation:https://evil.example"));
        assertEquals("/dashboard", OAuthPkce.sanitizeNext("/subpages/groups.html%0d%0aLocation:%20https://evil.example"));
    }
}
