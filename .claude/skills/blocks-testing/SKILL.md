---
name: blocks-testing
description: Test conventions for this repo (Vitest, node vs jsdom, mounting Svelte components, compound-widget harnesses). Use when writing, fixing, or reviewing tests in packages/blocks, table, i18n, docs-gen, auth or sveltekit-utils — especially DOM/interaction tests.
---

# Testing in this repo

- Framework: Vitest (in `blocks`, `i18n`, `docs-gen`, `auth`, `sveltekit-utils`)
- Type checks: `bun run check` or per-package `svelte-check`
- Run a package's tests with `bun --filter='<pkg>' run test` — **`run` is mandatory**; bare `bun test` bypasses the Vitest config and produces fake failures.

## Component / DOM tests (`blocks`)

Most tests run in the default `node` environment (variant + logic checks, no DOM). Interaction tests (focus/keyboard/click) that need a real DOM opt into jsdom **per file** with a `// @vitest-environment jsdom` docblock, so the node suite stays fast and untouched. Reference: `Combobox/Combobox.svelte.test.ts` (guards the #19 focus-reopen).

These conventions were learned the hard way — **do not "modernise" them back to the obvious libraries:**

- **Mount with Svelte's own `mount`/`unmount`** (from `svelte`), **not** `@testing-library/svelte`. The latter pulls a second svelte instance, which makes svelte-check see two unrelated `Snippet` types across the whole package (spurious errors in unrelated components). Queries + interactions use the svelte-free `@testing-library/dom` (`screen`) + `@testing-library/user-event`.
- **Assert with vitest's native matchers** (`toBe`, `document.activeElement`, `getAttribute`), **not** `@testing-library/jest-dom` — its expect augmentation does not compose with vitest 4's `Assertion` type.
- **Overlay content (Combobox/Select/Menu/Tooltip) renders in a native popover.** jsdom has no top layer, so query it with `{ hidden: true }`. These tests assert interaction *logic* (aria, callbacks, state), not visual visibility — that is Playwright's (`e2e/`) job.
- jsdom polyfills (scrollIntoView, Popover API, Resize/IntersectionObserver) live in `packages/blocks/vitest-setup.ts`, guarded on `window` so node tests skip them.
- **localStorage in jsdom tests:** Node ≥ 25 ships a broken global `localStorage` stub (without `--localstorage-file`) that shadows jsdom's Storage in vitest — tests that need real storage semantics must install a functional in-memory Storage on `window` themselves (reference: `packages/table/src/lib/stores/TableStore.seed.persistence.svelte.test.ts`).
- **Compound widgets** (Tab/SegmentGroup/RadioGroup/Accordion/Stepper) whose children register through context can't be driven by a `createRawSnippet` of plain HTML — mount a real composition from a `__fixtures__/<Widget>Harness.svelte` next to the test (reference: `Tab/__fixtures__/TabHarness.svelte`). `__fixtures__/` is already excluded from the published package (package.json `files` → `!dist/**/__fixtures__/**`) and isn't collected as a test (no `.test`/`.spec` in the name). **Declarative** primitives (Toggle/Checkbox/ConfirmDialog/Slider/Collapsible) need no fixture — pass props directly and build any content snippet with `createRawSnippet` (reference: `Dialog.svelte.test.ts`).

## Fresh-worktree prerequisite

In a fresh worktree `bun --filter='@urbicon-ui/blocks' run check` and `run test` fail until the workspace deps are built (`test` reports "Failed to resolve entry for package @urbicon-ui/i18n"). Build first — `bun run build:packages` — then svelte-check is 0 errors and tests are green.
