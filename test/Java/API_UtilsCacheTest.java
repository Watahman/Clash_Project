package Java;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class API_UtilsCacheTest {
    @Test
    void cachesOnlyStableNotFoundResponses() {
        assertTrue(API_Utils.isNegativeCacheable(404));
        assertFalse(API_Utils.isNegativeCacheable(401));
        assertFalse(API_Utils.isNegativeCacheable(403));
        assertFalse(API_Utils.isNegativeCacheable(429));
        assertFalse(API_Utils.isNegativeCacheable(503));
    }
}
