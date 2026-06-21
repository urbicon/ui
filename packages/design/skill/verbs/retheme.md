# retheme — rebrand the system across every surface

**When:** the design language itself changes — new brand colour, type, density, or
paradigm — and it must propagate everywhere consistently. The flagship verb: only
possible because there's a real token system plus a manifest usage-index to drive it.
**Gate:** correctness over every affected file.

1. **Context + scope.** `urbicon context` for the current paradigm, theme, and
   `## Token Overrides`. State precisely what's changing and what's staying — a
   retheme that touches everything is a rewrite, not a rebrand.
2. **Decide at the right layer.** `get_design_principles` includes a change-decision
   tree: a colour shift is usually a **semantic-token** remap, not a per-component
   edit. Change the foundation/semantic layer (or the project's `## Token Overrides`),
   not 200 call-sites — that's the whole point of the token architecture.
3. **Update the source of truth.** Apply the token changes once at the layer you
   chose, and update `## Token Overrides` in the manifest so `validate` accepts the
   new vocabulary and rejects the old.
4. **Find every affected surface.** Use the manifest's Pattern Usages and a grep of
   the changed token names to list the files that actually render them. The
   usage-index is what makes "everywhere" tractable instead of a guess.
5. **Propagate and validate per file.** For each affected file, apply the remap and
   run `validate_design` / `urbicon validate`. The gate is per file: none may ship
   with a stale or raw token. `urbicon validate src/ --record` at the end captures the
   post-retheme drift baseline.
6. **Record the rebrand.** Append one ADR describing the change, the layer it was made
   at, and the old→new token mapping — the migration note future readers need.

Output: the layer-level change, the list of propagated files, and a clean
correctness score across all of them.
