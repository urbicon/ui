---
name: docs-editor
description: Editing pass for docs-site prose against docs/EDITORIAL.md. Use after writing or substantially editing an apps/docs page, or when asked for an "Editor-Pass", "Kalt-Test" or a prose review of documentation pages.
---

# The editing pass

Generation does not obey style rules sitting in its own context; a separate pass applies them
reliably (measured 2026-08-05: nine violations in a draft written with the guide in context, all
caught by the pass). So the pass never runs in the context that wrote the text.

## Procedure

1. **Fresh context.** Spawn an agent that has not seen the draft being produced. If you wrote the
   page in this session, you are disqualified — delegate.
2. The agent reads `docs/EDITORIAL.md` in full, then the page.
3. **Verify before cutting.** Any behaviour claim it wants to cut or change, it first checks in
   the package source (table pages: `packages/table/src/lib/core/table/index.ts`,
   `core/TableProvider.svelte`, `types/tableTypes.ts`; other packages accordingly). True and
   needed information survives — moved if misplaced, never dropped on suspicion.
4. **Two rounds in order, reported separately:** every sentence against checklist items 1–15,
   then the whole page against 16–19. Round 2 exists because round 1 cannot see ratios,
   cross-section contradictions, or duplication with a demo component's own markup.
5. **Gates:** `bunx prettier --write <page>`, then
   `bun --filter='@urbicon-ui/docs-app' run sections:lint` — and `examples:budget` when the page
   is a component page. Green before reporting.
6. **Report as points, not an essay:** prose words before/after (element text plus
   `description=`/`title=` attributes; `<script>` constants and HTML comments excluded), note
   share, each change with the checklist item it rests on, round-2 findings round 1 could not
   see, and — explicitly — anything the guide itself got wrong. Guide findings go to whoever
   drives the session, not into the guide ("Changing this file" there sets the bar: a rule needs
   a repeat offender).

The pass commits nothing and stages nothing.
