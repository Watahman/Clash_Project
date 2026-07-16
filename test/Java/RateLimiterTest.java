package Java;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RateLimiterTest {
    @Test
    void blocksAfterLimitAndResetsAfterWindow() {
        RateLimiter limiter = new RateLimiter();

        assertTrue(limiter.check("client|path", 2, 1_000).allowed());
        assertTrue(limiter.check("client|path", 2, 1_001).allowed());
        RateLimiter.Result blocked = limiter.check("client|path", 2, 1_002);
        assertFalse(blocked.allowed());
        assertEquals(0, blocked.remaining());
        assertTrue(blocked.retryAfterSeconds() > 0);

        assertTrue(limiter.check("client|path", 2, 61_001).allowed());
    }

    @Test
    void keepsRoutesAndClientsIndependent() {
        RateLimiter limiter = new RateLimiter();
        assertTrue(limiter.check("one|route-a", 1, 1_000).allowed());
        assertFalse(limiter.check("one|route-a", 1, 1_001).allowed());
        assertTrue(limiter.check("one|route-b", 1, 1_001).allowed());
        assertTrue(limiter.check("two|route-a", 1, 1_001).allowed());
    }
}
