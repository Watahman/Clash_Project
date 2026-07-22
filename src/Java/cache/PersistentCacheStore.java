package Java.cache;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Local persistent L2 cache backed by SQLite.
 *
 * This replaces the old Supabase api_cache table. Cache failures are deliberately
 * non-fatal: the Clash request can still continue via L1 or the upstream API.
 */
public final class PersistentCacheStore implements CacheStore, AutoCloseable {
    private static final int CLEANUP_EVERY_WRITES = 100;
    private static final int DEFAULT_MAX_ENTRIES = 25_000;

    private final AtomicInteger writes = new AtomicInteger();
    private final int maxEntries;
    private final String databasePath;
    private Connection connection;
    private boolean available;

    public PersistentCacheStore(String databasePath) {
        this(databasePath, DEFAULT_MAX_ENTRIES);
    }

    public PersistentCacheStore(String databasePath, int maxEntries) {
        this.maxEntries = Math.max(1_000, maxEntries);
        this.databasePath = normalizePath(databasePath);
        initialize();
    }

    @Override
    public synchronized CacheEntry get(String key) {
        if (!available || key == null || key.isBlank()) return null;

        String sql = "select payload, fetched_at, fresh_until, stale_until, source_status "
                + "from clash_api_cache where cache_key = ? limit 1";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, key);
            try (ResultSet row = statement.executeQuery()) {
                if (!row.next()) return null;

                CacheEntry entry = new CacheEntry(
                        row.getString("payload"),
                        row.getLong("fetched_at"),
                        row.getLong("fresh_until"),
                        row.getLong("stale_until"),
                        row.getInt("source_status")
                );
                if (!entry.isUsable()) {
                    invalidate(key);
                    return null;
                }
                return entry;
            }
        } catch (SQLException cacheFailure) {
            markUnavailableIfConnectionClosed(cacheFailure);
            return null;
        }
    }

    @Override
    public synchronized void put(String key, CacheEntry entry) {
        if (!available
                || key == null
                || key.isBlank()
                || entry == null
                || entry.value() == null
                || !entry.isUsable()) {
            return;
        }

        String sql = "insert into clash_api_cache ("
                + "cache_key, payload, fetched_at, fresh_until, stale_until, source_status, updated_at"
                + ") values (?, ?, ?, ?, ?, ?, ?) "
                + "on conflict(cache_key) do update set "
                + "payload = excluded.payload, "
                + "fetched_at = excluded.fetched_at, "
                + "fresh_until = excluded.fresh_until, "
                + "stale_until = excluded.stale_until, "
                + "source_status = excluded.source_status, "
                + "updated_at = excluded.updated_at";

        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, key);
            statement.setString(2, entry.value());
            statement.setLong(3, entry.fetchedAt());
            statement.setLong(4, entry.freshUntil());
            statement.setLong(5, entry.staleUntil());
            statement.setInt(6, entry.sourceStatus());
            statement.setLong(7, System.currentTimeMillis());
            statement.executeUpdate();

            if (writes.incrementAndGet() % CLEANUP_EVERY_WRITES == 0) {
                cleanup();
            }
        } catch (SQLException cacheFailure) {
            markUnavailableIfConnectionClosed(cacheFailure);
        }
    }

    @Override
    public synchronized void invalidate(String key) {
        if (!available || key == null || key.isBlank()) return;

        try (PreparedStatement statement = connection.prepareStatement(
                "delete from clash_api_cache where cache_key = ?"
        )) {
            statement.setString(1, key);
            statement.executeUpdate();
        } catch (SQLException cacheFailure) {
            markUnavailableIfConnectionClosed(cacheFailure);
        }
    }

    @Override
    public synchronized void invalidatePrefix(String prefix) {
        if (!available || prefix == null || prefix.isEmpty()) return;

        try (PreparedStatement statement = connection.prepareStatement(
                "delete from clash_api_cache where cache_key like ? escape '\\'"
        )) {
            statement.setString(1, escapeLike(prefix) + "%");
            statement.executeUpdate();
        } catch (SQLException cacheFailure) {
            markUnavailableIfConnectionClosed(cacheFailure);
        }
    }

    public synchronized boolean isAvailable() {
        return available;
    }

    public String databasePath() {
        return databasePath;
    }

    @Override
    public synchronized void close() {
        available = false;
        if (connection == null) return;
        try {
            connection.close();
        } catch (SQLException ignored) {
            // Best effort during shutdown.
        } finally {
            connection = null;
        }
    }

    private void initialize() {
        try {
            Path path = Paths.get(databasePath).toAbsolutePath().normalize();
            Path parent = path.getParent();
            if (parent != null) Files.createDirectories(parent);

            Class.forName("org.sqlite.JDBC");
            connection = DriverManager.getConnection("jdbc:sqlite:" + path);
            configureConnection(connection);
            createSchema(connection);
            available = true;
            cleanup();

            Runtime.getRuntime().addShutdownHook(new Thread(
                    this::close,
                    "clashtools-sqlite-cache-shutdown"
            ));
            System.out.printf("[cache] Lokale SQLite-cache actief: %s%n", path);
        } catch (Exception cacheFailure) {
            available = false;
            connection = null;
            System.err.printf(
                    "[cache] SQLite-cache kon niet starten (%s). Backend valt terug op RAM/API.%n",
                    cacheFailure.getMessage()
            );
        }
    }

    private void configureConnection(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("pragma journal_mode = WAL");
            statement.execute("pragma synchronous = NORMAL");
            statement.execute("pragma busy_timeout = 5000");
            statement.execute("pragma temp_store = MEMORY");
        }
    }

    private void createSchema(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate("""
                    create table if not exists clash_api_cache (
                        cache_key text primary key,
                        payload text not null,
                        fetched_at integer not null,
                        fresh_until integer not null,
                        stale_until integer not null,
                        source_status integer not null,
                        updated_at integer not null
                    )
                    """);
            statement.executeUpdate(
                    "create index if not exists clash_api_cache_stale_until_idx "
                            + "on clash_api_cache(stale_until)"
            );
            statement.executeUpdate(
                    "create index if not exists clash_api_cache_fetched_at_idx "
                            + "on clash_api_cache(fetched_at)"
            );
        }
    }

    private void cleanup() {
        if (!available || connection == null) return;

        try (PreparedStatement expired = connection.prepareStatement(
                "delete from clash_api_cache where stale_until <= ?"
        )) {
            expired.setLong(1, System.currentTimeMillis());
            expired.executeUpdate();
        } catch (SQLException cacheFailure) {
            markUnavailableIfConnectionClosed(cacheFailure);
            return;
        }

        String pruneSql = "delete from clash_api_cache where cache_key in ("
                + "select cache_key from clash_api_cache "
                + "order by fetched_at desc limit -1 offset ?"
                + ")";
        try (PreparedStatement prune = connection.prepareStatement(pruneSql)) {
            prune.setInt(1, maxEntries);
            prune.executeUpdate();
        } catch (SQLException cacheFailure) {
            markUnavailableIfConnectionClosed(cacheFailure);
        }
    }

    private void markUnavailableIfConnectionClosed(SQLException error) {
        if (connection == null) {
            available = false;
            return;
        }
        try {
            if (connection.isClosed()) available = false;
        } catch (SQLException ignored) {
            available = false;
        }
    }

    private static String normalizePath(String value) {
        if (value == null || value.isBlank()) {
            return "data/cache/clashtools-cache.db";
        }
        return value.trim();
    }

    private static String escapeLike(String value) {
        return value
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }
}
