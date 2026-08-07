# Advanced Stats — Phase 3 validation checklist

Phase 3 is complete only when all items below are satisfied.

- [x] current player battle-log JSON is decoded into stable candidates
- [x] defenses are ignored for attacking-army usage
- [x] battle fingerprint excludes poll observation time
- [x] battle fingerprint includes current stable opponent/performance/army/loot fields
- [x] available loot is persisted because it participates in timestamp-less identity
- [x] army payload supports u/s/i/d/h sections
- [x] regular troops, Super Troops, siege, spells, Clan Castle units and hero loadouts are classified
- [x] unknown IDs are retained instead of dropped
- [x] malformed army payloads create PARSER_ERROR records without aggregate mutation
- [x] database uniqueness remains the final duplicate guard
- [x] battle + units + unit totals + army totals + daily totals + battle counter are one transaction
- [x] PARSER_ERROR battles can be safely reprocessed by a later parser version
- [x] same raw battle log processed twice is covered by an idempotency test
- [x] internal collection reuses API_Utils / Clash cache rather than calling /PlayerBattleLog over HTTP
- [ ] repository CI / equivalent complete validation is green
- [ ] final Phase 3 diff has been reviewed
- [ ] phase status document marked COMPLETE

Known upstream limitation: if no durable battle ID/timestamp exists and two truly separate battles are identical across every stable field available to ClashPanel, the API does not provide enough information to prove they are separate. See `advanced-stats-phase3-api-notes.md`.
