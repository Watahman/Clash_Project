package Java.performance;

public record PlayerPerformanceResult(
        String playerTag,
        String status,
        String scope,
        Double performance,
        Form form,
        Double reliability,
        Integer usedAttacks,
        Integer availableAttacks,
        String reliabilityMessage,
        Double avgStars,
        Double avgDestruction,
        Double tripleRate,
        Double twoStarRate,
        Double lowStarRate,
        int attackCount,
        int sameThCount,
        int upHitCount,
        int downHitCount,
        String confidence,
        Coverage coverage,
        String source
) {
    public record Form(Double delta, String trend) {}

    public record Coverage(int attacks, int days, String start, String end) {}
}
