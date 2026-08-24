package Java.performance;

import java.util.Locale;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Keeps a process-wide count of real requests sent to ClashKing and reports it
 * periodically without keeping the application alive during shutdown.
 */
public final class ClashKingRequestCounter {
    private static final long DEFAULT_INTERVAL_SECONDS = 60;
    private static final ClashKingRequestCounter INSTANCE = new ClashKingRequestCounter();

    private final AtomicLong totalRequests = new AtomicLong();
    private final AtomicLong getRequests = new AtomicLong();
    private final AtomicLong postRequests = new AtomicLong();
    private final AtomicLong lastReportedTotal = new AtomicLong();
    private volatile ScheduledExecutorService reporter;
    private volatile long intervalSeconds = DEFAULT_INTERVAL_SECONDS;

    private ClashKingRequestCounter() {
    }

    public static ClashKingRequestCounter shared() {
        return INSTANCE;
    }

    public static void configure(long intervalSeconds) {
        INSTANCE.startReporter(intervalSeconds);
    }

    public void record(String method) {
        String normalizedMethod = method == null
                ? "OTHER"
                : method.toUpperCase(Locale.ROOT);
        totalRequests.incrementAndGet();
        if ("GET".equals(normalizedMethod)) getRequests.incrementAndGet();
        if ("POST".equals(normalizedMethod)) postRequests.incrementAndGet();
        ensureReporterStarted();
    }

    private void ensureReporterStarted() {
        if (reporter != null) return;
        startReporter(DEFAULT_INTERVAL_SECONDS);
    }

    private synchronized void startReporter(long requestedIntervalSeconds) {
        if (reporter != null) return;

        intervalSeconds = Math.max(1, requestedIntervalSeconds);
        reporter = Executors.newSingleThreadScheduledExecutor(runnable -> {
            Thread thread = new Thread(runnable, "clashking-request-counter");
            thread.setDaemon(true);
            return thread;
        });
        reporter.scheduleAtFixedRate(
                this::report,
                intervalSeconds,
                intervalSeconds,
                TimeUnit.SECONDS
        );
    }

    private void report() {
        long total = totalRequests.get();
        long sinceLastReport = total - lastReportedTotal.getAndSet(total);
        System.out.printf(
                "[ClashKing API] %d requests total (+%d in last %d seconds; GET %d, POST %d)%n",
                total,
                sinceLastReport,
                intervalSeconds,
                getRequests.get(),
                postRequests.get()
        );
    }
}
