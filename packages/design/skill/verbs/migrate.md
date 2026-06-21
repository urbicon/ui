# migrate — roll out a pattern or library change everywhere

**When:** a composition pattern, component API, or library convention changed and
every site of it must move in lockstep — e.g. "the settings-page pattern now uses
tabs" or "Card lost its `elevated` prop".
**Gate:** correctness per file — each migrated file must pass before the next.

1. **Context.** `urbicon context` — the manifest's decisions tell you which
   conventions are deliberate (don't migrate away from a recorded ADR without
   superseding it).
2. **Pin the before/after.** State the exact change: old construct → new construct.
   If it's a pattern change, re-read both via `get_pattern`; if a component API change,
   `get_component` for the new contract.
3. **Find every site.** `urbicon sync-manifest`, then use the Pattern Usages index
   (for pattern changes) and a grep of the old construct (for API/markup changes) to
   enumerate the files. Report the count up front — a silently partial migration is
   worse than none.
4. **Transform file by file.** Apply the change to one file, run `validate_design` /
   `urbicon validate`, and only then move on. Keep each file's diff minimal and
   behaviour-preserving. If a file resists the mechanical transform, flag it for
   manual `redesign` rather than forcing it.
5. **Re-index and validate the whole.** `urbicon sync-manifest` again so the index
   reflects the new reality, then `urbicon validate src/ --record` for a clean
   end-state baseline.
6. **Record the migration.** Append an ADR: what changed, why, how many files moved,
   and any deliberately skipped (with the reason). The next person needs to know the
   migration is complete and where the exceptions are.

Output: the file count, the per-file pass status, and any sites deferred to manual
follow-up.
