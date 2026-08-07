# Advanced Stats — Phase 3 API notes

These notes document correctness limits that must remain visible through later UI/product work.

## Battle identity

The current player battle-log payload used by Advanced Stats does not guarantee a durable battle ID or battle timestamp for every entry.

Advanced Stats therefore builds a content fingerprint from the stable fields currently available to it:

- tracked player tag;
- attack/defense;
- battle type;
- optional upstream timestamp when present;
- opponent tag/name/Town Hall;
- tracked-player Town Hall observed for the poll;
- stars;
- destruction percentage;
- army share code;
- looted Gold/Elixir/Dark Elixir;
- available Gold/Elixir/Dark Elixir.

`observed_at` is deliberately excluded from the fingerprint because the same battle is observed at a different time on each poll.

### Remaining theoretical collision

If the upstream API supplies no battle ID/timestamp and two genuinely separate attacks are identical across every field above, ClashPanel cannot prove that they are separate events. They may share a fingerprint.

This is an upstream-data limitation. Advanced Stats must not claim mathematically complete battle identity while this remains true.

## Dates and bootstrap imports

When an upstream battle timestamp exists, it is stored and used for the daily bucket.

When no upstream timestamp exists, ClashPanel stores `observed_at` and uses that as the best available date. This means bootstrap-imported recent battles can be grouped on the date they were first observed by ClashPanel rather than their exact historical attack date.

Future UI wording should distinguish tracked/observed history from a guaranteed exact attack timeline.

## Army usage meaning

Army usage is derived from the battle log's `armyShareCode`. It represents the recorded army composition associated with the attack; it cannot prove that every unit was actually deployed before the attack ended.

## Parser behavior

The current parser understands the present army-link sections:

- `u`: home army troops;
- `s`: home army spells;
- `i`: Clan Castle troops;
- `d`: Clan Castle spells;
- `h`: hero/pet/equipment loadouts.

Malformed non-empty payloads are retained as `PARSER_ERROR` battles and do not increment aggregates. Unknown IDs remain durable as `unknown_<absolute-id>` rather than being dropped. A later parser version may safely reprocess those raw stored battle records.

## Deduplication authority

Application code computes the fingerprint, but database uniqueness on `(tracking_id, battle_fingerprint)` is the final concurrency-safe deduplication guard.

One database RPC transaction performs:

1. battle insertion/deduplication;
2. battle-unit storage;
3. unit lifetime aggregate updates;
4. army aggregate updates;
5. daily aggregate updates;
6. processed-state update;
7. `battles_processed` increment.

A duplicate exits before aggregate mutation.
