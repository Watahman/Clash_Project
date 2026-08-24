# Advanced Stats — Scheduler Runbook

This is the deployment/runbook for Advanced Stats collection. The code is intentionally **disabled by default** until the staged rollout explicitly enables it.

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

Enrollment and background collection are separate controls.

Rollout variables:

```text
ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED
ADVANCED_STATS_ROLLOUT_USER_IDS
ADVANCED_STATS_COLLECTION_ENABLED
ADVANCED_STATS_SCHEDULER_SECRET
```

Collector tuning variables:

```text
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

Safe defaults:

```text
ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=false
ADVANCED_STATS_ROLLOUT_USER_IDS=
ADVANCED_STATS_COLLECTION_ENABLED=false
ADVANCED_STATS_BATCH_SIZE=25
ADVANCED_STATS_LEASE_SECONDS=600
ADVANCED_STATS_ACTIVE_POLL_MINUTES=15
ADVANCED_STATS_IDLE_POLL_MINUTES=30
ADVANCED_STATS_RATE_LIMIT_BACKOFF_MINUTES=30
ADVANCED_STATS_OUTAGE_BACKOFF_MINUTES=10
ADVANCED_STATS_UNKNOWN_BACKOFF_MINUTES=15
ADVANCED_STATS_MAX_BACKOFF_MINUTES=240
ADVANCED_STATS_DEGRADED_THRESHOLD=3
```

With the defaults above, nobody can start a new tracker and the scheduled collector is disabled. Existing tracker history/lifecycle remains manageable.

The 25-row/10-minute lease defaults are intentionally conservative for sequential upstream fetches. A slow batch has room to finish before the same rows become claimable by another scheduler invocation.

Do not enable collection without setting a strong `ADVANCED_STATS_SCHEDULER_SECRET`.

## Secret handling

Store the scheduler secret in Google Secret Manager for the Cloud Run environment.

The internal endpoint expects the same value in:

```text
X-ClashPanel-Scheduler-Secret
```

The endpoint uses constant-time comparison.

Do not place this secret, the rollout user allowlist or private runtime values in frontend files, `runtime-config.js`, public environment variables or repository files.

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

Do not switch the feature directly to all users.

Recommended order:

1. database migrations and rollback-only DB validation — **complete before runtime rollout**;
2. deploy the exact candidate backend with `ADVANCED_STATS_COLLECTION_ENABLED=false` and `ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=false`;
3. confirm `/InternalAdvancedStatsPoll` returns 404 while collection is disabled;
4. configure `ADVANCED_STATS_SCHEDULER_SECRET` in Cloud Run;
5. set `ADVANCED_STATS_ROLLOUT_USER_IDS` to only the developer account UUID;
6. create/configure the Cloud Scheduler job but keep collection disabled while verifying configuration;
7. start one developer-owned linked account through the normal authenticated flow;
8. verify a user outside the allowlist cannot start tracking;
9. set `ADVANCED_STATS_COLLECTION_ENABLED=true`;
10. observe multiple scheduler cycles;
11. verify the same recent battle log does not increase counters twice;
12. verify `last_successful_poll_at`, `next_poll_at`, leases and failure counters;
13. only after the developer and small-subset stages are healthy may `ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=true` be considered.

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

These counters provide an initial Cloud Logging signal without adding a separate metrics service.

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

These database state transitions also have rollback-only synthetic production-DB coverage. The remaining live gate is specifically the real Cloud Run/Scheduler/network execution path.

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
