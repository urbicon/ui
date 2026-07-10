# redesign — rework an existing page that feels wrong

**When:** a page exists but underperforms — flat, generic, off-identity. Diagnoses
first, then fixes exactly what the diagnosis flags, preserving behaviour.
**Gate:** correctness (blocking) + slop-floor (advisory) + the rubric.

A diagnosis-first loop — resist the urge to rebuild from scratch.

1. **Context.** `urbicon context` (or read `./design.manifest.md`) to recover the
   paradigm, theme, Product Intent, and prior decisions. Read the current
   implementation of the page in question.
2. **Diagnose.** Run `urbicon validate` (or the `validate_design` MCP tool) on the
   current code, then `urbicon principles --rubric` (MCP:
   `get_design_principles(as="rubric")`) and score the page /40. Your revision
   targets are **every linter finding** (correctness *and* slop-floor) plus the
   **two lowest-scoring rubric criteria** — nothing else. Write the targets down.
3. **Generate variants.** Produce a few options (2–5; default 3) that fix exactly
   those weaknesses. Preserve the page's behaviour, data flow, and overall structure;
   change only what the diagnosis flagged. Use only real tokens (project tokens are
   in `## Token Overrides`).
4. **Validate.** Run the linter on each; fix every error and warning.
5. **Judge.** Re-score each variant with the rubric. A redesign that does not beat
   the original on its target criteria is not shippable — say so and iterate.
6. **Synthesise.** Merge the best result, then run `urbicon validate` once more — it
   must come back clean.
7. **Record.** Append an ADR for any deliberate deviation (`urbicon record-decision`);
   refresh Pattern Usages (`urbicon sync-manifest`) if pattern usage changed.

End with a before/after table of the targeted criteria (old score → new score), then
the final code and a one-line, honest rationale per major change.
