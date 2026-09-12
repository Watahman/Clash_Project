package Java.advancedstats;

import Java.HttpException;

import java.util.List;

/** Captures optional per-scope failures for shape-preserving aggregate reads. */
final class AdvancedStatsCompactReadFailureSupport {
    private AdvancedStatsCompactReadFailureSupport() {}

    @FunctionalInterface
    interface ReadCall<T> {
        T execute() throws Exception;
    }

    static <T> T read(ReadCall<T> call, AdvancedStatsScope scope, String operation,
                      T fallback, List<AdvancedStatsCompactReadAggregator.ReadFailure> failures) {
        try {
            return call.execute();
        } catch (Exception failure) {
            failures.add(new AdvancedStatsCompactReadAggregator.ReadFailure(
                    scope, operation, failureCode(failure)));
            return fallback;
        }
    }

    private static String failureCode(Exception failure) {
        if (failure instanceof HttpException http) {
            return switch (http.getStatusCode()) {
                case 408, 429, 500, 502, 503, 504 -> "UPSTREAM_UNAVAILABLE";
                case 404 -> "READ_FUNCTION_UNAVAILABLE";
                default -> "READ_FAILED";
            };
        }
        if (failure instanceof IllegalStateException) return "MALFORMED_RESPONSE";
        return "READ_FAILED";
    }
}
