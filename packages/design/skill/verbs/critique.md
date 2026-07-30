# critique — judge a page without changing it

**When:** the user wants an assessment, a review, or a prioritised punch-list — not
edits. Produces a diagnosis you (or `redesign` / `polish` / `fix`) can act on later.
**Gate:** none — this verb only assesses. Change nothing.

1. **Context.** `urbicon context` for the paradigm and Product Intent — a critique
   is *against this project's* identity, not a generic best-practices checklist.
2. **Run the full stack.** On the page's code:
   - **Correctness** — `urbicon validate` (or the `validate_design` MCP tool): errors
     and warnings are deterministic defects (raw colours, `dark:`/`focus:` misuse,
     hardcoded z-index, broken dynamic classes, hallucinated tokens).
   - **Craft** — the same run's advisory notes: where it reads generic.
   - **Taste** — `urbicon principles --rubric` (MCP: `get_design_principles(as="rubric")`)
     and score /40 across the eight criteria.
3. **Prioritise.** Order the findings by impact, not by severity label: a single
   broken hierarchy outranks five cosmetic nits. Tie each to the rubric criterion or
   linter rule it comes from, so the fix is unambiguous.
4. **Recommend the verb.** For each cluster, name the right follow-up — `fix` for
   correctness, `polish` for craft, `redesign` for a low rubric score — so the user
   can act in one step.
5. **Offer to record.** If the critique surfaces a *systemic* gap (not a one-page
   issue), offer to append an ADR or open it as drift in the manifest. Don't write
   without asking — critique's contract is read-only.

Output: the two scores (correctness · craft), the rubric /40 with the two
weakest criteria called out, and the prioritised fix-list with a verb per item.
