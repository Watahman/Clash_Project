package Java;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HttpExceptionTest {
    @Test
    void upstreamDetailsAreReplacedWithASafePublicError() {
        HttpException error = HttpException.upstream(
                500,
                "{\"message\":\"internal table public.users and credential details\"}",
                "Databank"
        );

        String publicBody = API_Utils.publicErrorBody(error);
        assertEquals(502, API_Utils.publicStatus(error));
        assertTrue(publicBody.contains("UPSTREAM_ERROR"));
        assertFalse(publicBody.contains("public.users"));
        assertFalse(publicBody.contains("credential details"));
    }

    @Test
    void intentionalApplicationErrorsRemainIntact() {
        HttpException error = new HttpException(
                409,
                "{\"error\":\"Plan is intussen gewijzigd\",\"code\":\"PLAN_REVISION_CONFLICT\"}"
        );

        assertEquals(409, API_Utils.publicStatus(error));
        assertEquals(error.getResponseBody(), API_Utils.publicErrorBody(error));
    }
}
