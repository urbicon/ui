# audit — check design consistency across the whole app

**When:** a periodic or pre-release sweep — is the app still coherent, or has it
drifted? The flagship cross-page verb: it reasons over *many* surfaces via the
manifest usage-index, which no single-page or system-agnostic tool can do.
**Gate:** none — assessment over n pages. Change nothing; produce a drift report.

1. **Context + index.** `urbicon context` for the intent and recorded decisions, then
   `urbicon sync-manifest` so the Pattern Usages index reflects the current tree.
2. **Validate the tree.** `urbicon validate src/ --json --record` over the whole app.
   `--record` appends a drift entry to the history sidecar; `urbicon context` then
   shows the correctness/slop trend over time — the measure of whether the app is
   getting more or less generic.
3. **Check each pattern cohort.** For every pattern in the usage-index, read the files
   listed under it and confirm they actually follow that pattern's rules
   (`get_pattern("<name>")`). A page marked `dashboard` that looks like a form is
   drift.
4. **Score a representative sample.** Pick the highest-traffic or most-divergent pages
   and score them with `get_design_principles(as="rubric")`. Look for *spread* — wide
   variance across pages is the consistency problem, even if each page passes alone.
5. **Report drift, don't fix it.** Produce: the app-wide correctness/slop scores and
   their trend; per-pattern conformance; the rubric spread; and a ranked list of the
   worst offenders, each tagged with the verb that repairs it (`fix`, `polish`,
   `redesign`, `retheme`).
6. **Persist the finding.** Offer to append an ADR summarising the audit (date,
   scores, top drift) so the next audit has a baseline to compare against — the
   history sidecar plus an ADR make drift measurable, not anecdotal.

Output: the drift report. Recommend, but do not perform, the repairs.
