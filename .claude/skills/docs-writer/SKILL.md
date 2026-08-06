---
name: docs-writer
description: Driving a docs-page write or migration — role split (writer vs docs-editor), the writer briefing, the order for new pages (JSDoc first), and the gates. Use when migrating an existing apps/docs page to docs/EDITORIAL.md or when creating a new docs page.
---

# Writing or migrating a docs page

Two contexts, always: a writer and a separate editor (`docs-editor` skill). A context does not see
its own style violations (measured twice, 2026-08-05/06). A typo or a single sentence needs no
editor pass.

## Writer briefing (both cases)

Give the writer these pointers. Never paste guide content into the prompt — guide prose gets
imitated verbatim; pointers do not.

- `docs/EDITORIAL.md`: Principles, Canon and "Before writing" are the writing basis. **The
  checklist is not the writer's job** — as writing instructions it only lengthens the page.
- Read the canon pages; match structure, register, density.
- Verify every behaviour claim in the package source before writing or keeping it.
- Single-prop rules → the prop's JSDoc (`component-metadata` skill); the page explains relations
  between props.
- Information must not drop. Misplaced facts move; they are not cut.
- Gates before reporting: prettier on the page, `bun --filter='@urbicon-ui/docs-app' run
  sections:lint`. No commits, no staging.

## Migration (existing page)

1. Writer, fresh context, with the briefing above.
2. `docs-editor` pass on the result — second fresh context.
3. Read the page cold; dissect any sentence that slipped through, sentence by sentence.
4. If JSDoc changed: `bun run docs:gen:all`, then `summary:lint` / `registry:lint`.

## New page

JSDoc first (`component-metadata`), then `bun run docs:gen:all` (creates the page's `api.ts`),
then the writer — plus the `docs-recipes` skill for section structure and the three registrations
(`registry:lint` enforces them) — then the `docs-editor` pass. Gates: `sections:lint`,
`examples:budget`, `registry:lint`, and after JSDoc changes `summary:lint` / `playgrounds:lint`.
