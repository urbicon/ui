# Migration progress

Tracking the move off the legacy session store. Checked items are done and
merged; unchecked ones are still open.

- [x] Add the new token table and indexes
- [x] Dual-write sessions to both stores
- [ ] Backfill historical sessions
- [ ] Flip reads to the new store behind a flag
- [ ] Delete the old table

Once the backfill lands we can start the read cutover. I would keep the dual
write running for at least a full billing cycle before deleting anything — it is
cheap insurance against a rollback.
