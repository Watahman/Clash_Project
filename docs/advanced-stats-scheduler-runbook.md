# Advanced Stats — Scheduler Runbook

This is the deployment/runbook for Phase 4. The code is intentionally **disabled by default** until the staged rollout phase explicitly enables it.

## Runtime design

Cloud Scheduler does not track players directly.

It calls:

```text
POST /InternalAdvancedStatsPoll
```

That endpoint runs one bounded collector batch. The database decides which trackers are due through `next_poll_at`, and claims them with a lease using `FOR UPDATE SKIP LOCKED`.

Therefore the Cloud Scheduler trigger can run more often than each individual player is polled.

Recommended trigger cadence:

```text
every 5 minutes
```

Default per-player cadence:

```text
new battle found  -> next poll in 15 minutes
no new battle     -> next poll in 30 minutes
```

Failure backoff is stored in `next_poll_at` and is independent of the scheduler trigger cadence.

## Required runtime variables

The collector recognizes:

```text
ADVANCED_STATS_COLLECTION_ENABLED
ADVANCED_STATS_SCHEDULER_SECRET
ADVANCED_STATS_BATCH_SIZE
ADVANCED_STATS_LEASE_SECONDS
ADVANCED_STATS_ACTIVE_POLL_MINUTES
ADVANCED_STATS_IDLE_POLL_MINUTES
ADVANCED_STATS_RATE_LIMIT_BACKOFF_MINUTES
ADVANCED_STATS_OUTAGE_BACKOFF_MINUTES
ADVANCED_STATS_UNKNOWN_BACKOFF_MINUTES
ADVANCED_STATS_MAX_BACKOFF_MINUTES
ADVANCED_STATS_DEGRADED_THRESHOLD
```

Defaults:

```text
ADVANCED_STATS_COLLECTION_ENABLED=false
ADVANCED_STATS_BATCH_SIZE=50
ADVANCED_STATS_LEASE_SECONDS=120
ADVANCED_STATS_ACTIVE_POLL_MINUTES=15
ADVANCED_STATS_IDLE_POLL_MINUTES=30
ADVANCED_STATS_RATE_LIMIT_BACKOFF_MINUTES=30
ADVANCED_STATS_OUTAGE_BACKOFF_MINUTES=10
ADVANCED_STATS_UNKNOWN_BACKOFF_MINUTES=15
ADVANCED_STATS_MAX_BACKOFF_MINUTES=240
ADVANCED_STATS_DEGRADED_THRESHOLD=3
```

Do not enable collection without setting a strong `ADVANCED_STATS_SCHEDULER_SECRET`.

## Secret handling

Store the scheduler secret in Google Secret Manager for the Cloud Run environment.

The internal endpoint expects the same value in:

```text
X-ClashPanel-Scheduler-Secret
```

The endpoint uses constant-time comparison.

Do not place this secret in frontend files, runtime-config.js, public environment variables or repository files.

## Cloud Scheduler job

When Phase 8 approves rollout, create a Scheduler HTTP job targeting the deployed Cloud Run API URL:

```text
https://<CLOUD_RUN_SERVICE_URL>/InternalAdvancedStatsPoll
```

Method:

```text
POST
```

Schedule:

```text
*/5 * * * *
```

Header:

```text
X-ClashPanel-Scheduler-Secret: <ADVANCED_STATS_SCHEDULER_SECRET>
```

Keep project IAM restricted because Scheduler job configuration is infrastructure configuration and should not be treated as public data.

## Rollout order

Do not switch the flag directly to all users.

Recommended order:

1. deploy migrations and backend with `ADVANCED_STATS_COLLECTION_ENABLED=false`;
2. confirm `/InternalAdvancedStatsPoll` returns 404 while disabled;
3. configure the scheduler secret in Cloud Run;
4. create the Cloud Scheduler job;
5. enable one developer-owned tracker only;
6. set `ADVANCED_STATS_COLLECTION_ENABLED=true`;
7. observe multiple scheduler cycles;
8. verify the same recent battle log does not increase counters twice;
9. verify `last_successful_poll_at`, `next_poll_at`, leases and failure counters;
10. only then expand the feature flag/user rollout.

## Operational signals

Every batch emits one structured-ish log line beginning with:

```text
advanced_stats_poll_batch
```

Per-tracker failure logs begin with:

```text
advanced_stats_poll_failed
```

Lease-finalization failures begin with:

```text
advanced_stats_poll_finalize_failed
```

The internal response contains:

```text
claimed
succeeded
failed
insertedBattles
duplicateBattles
parserErrors
rateLimited
finalizeFailures
healthy
```

These counters provide an initial Cloud Logging signal without adding a separate metrics service in Phase 4.

## Failure semantics

A single failed fetch does not mark tracking `ERROR`.

- Clash 429 -> `RATE_LIMIT`, exponential backoff;
- Clash 5xx / timeout / network failure -> `API_OUTAGE`, exponential backoff;
- unclassified failures -> `UNKNOWN`;
- after the configured consecutive-failure threshold (default 3), tracking becomes `DEGRADED`;
- an uncertainty period is opened as a tracking gap;
- a later successful poll closes that gap into `advanced_stats_tracking_gaps`;
- `data_complete_since` restarts at recovery time after a known gap.

If a Cloud Run worker dies while owning a tracker, the lease expires. The next worker can reclaim it, and the expired lease is recorded as a potential `WORKER_OUTAGE` gap.

## Why no Java timer

Do not add `ScheduledExecutorService` or another in-process repeating timer as the authoritative scheduler.

Cloud Run instances can:

- restart;
- scale to zero;
- overlap;
- be replaced during deployment.

Correctness therefore lives in:

```text
Cloud Scheduler trigger
        +
database due timestamps
        +
database leases
        +
battle fingerprint uniqueness
```

not in process lifetime.
