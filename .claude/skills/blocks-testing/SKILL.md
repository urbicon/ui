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
- **Web Storage in jsdom tests: never the ambient one.** No runtime guarantees the global is a working Storage — it has been an object with no methods and it has been absent — so a suite that uses it has a subject that differs by machine. Install one per test from `scripts/vitest-storage`: `installMemoryStorage()` for a working one, `installStorage(descriptor)` for the hostile shapes (no methods, absent, a property that throws, a `setItem` that throws), and `restoreStorage()` in the `afterEach` of every file that installs — vitest's per-file isolation hides a leaked global today, `isolate: false` would not. Place it **after** whatever in the same teardown could still reach storage — the unmounts, a timer flush. No teardown writes after its unmount today, so this is precaution rather than a fix; it is what keeps the file's answer independent of that staying true. A file that only *injects* `createMemoryStorage()` into a subject taking its storage as an option touches no global and needs no restore (reference: `packages/table/src/lib/view/storage-binding.svelte.test.ts`). One file for blocks, table and docs, the way `scripts/vitest-match-media` is the one `matchMedia` (reference: `packages/blocks/src/lib/internal/storage.test.ts`).
- **A per-test call count behind a spy needs `vi.restoreAllMocks()`.** `vi.spyOn` hands back the EXISTING mock when a method is already spied, and `mockImplementation` does not clear its history — so an unrestored `console.warn` spy carries the previous test's calls into the next test's `toHaveBeenCalledTimes`, which then counts calls that test never made. Restore in `afterEach` whenever a spy's count (not just its presence) is asserted.
- **Compound widgets** (Tab/SegmentGroup/RadioGroup/Accordion/Stepper) whose children register through context can't be driven by a `createRawSnippet` of plain HTML — mount a real composition from a `__fixtures__/<Widget>Harness.svelte` next to the test (reference: `Tab/__fixtures__/TabHarness.svelte`). `__fixtures__/` is already excluded from the published package (package.json `files` → `!dist/**/__fixtures__/**`) and isn't collected as a test (no `.test`/`.spec` in the name). **Declarative** primitives (Toggle/Checkbox/ConfirmDialog/Slider/Collapsible) need no fixture — pass props directly and build any content snippet with `createRawSnippet` (reference: `Dialog.svelte.test.ts`).

## `$effect` in a test needs jsdom — silently, or it runs nothing

**A test that drives an `$effect` (directly or through `$effect.root`) must carry the `// @vitest-environment jsdom` docblock.** Without it the callback never runs, no error is raised, and every assertion inside is skipped: the suite reports green while measuring nothing. Two suites shipped that way and were only caught in 2026-08 by sabotaging the code under test and watching them stay green.

Two knobs have to be right and neither announces itself:

1. the per-file `// @vitest-environment jsdom` docblock, and
2. `resolve.conditions: ['browser']` in the package's `vitest.config.ts`.

Vitest consults `resolve.conditions` only in its **web** transform mode, which the jsdom environment selects. Miss either one and Svelte resolves to its *server* build, where `$effect` and `$effect.root` are no-ops that discard the callback unread. `blocks`, `table`, `docs` and `i18n` all set the condition; a new package needs it added.

- **`$derived` is not affected** — it recomputes on read in the server build too, so a controller harness that only reads derived values may legitimately stay on node (reference: `internal/date-grid/date-grid.svelte.test.ts`, verified falsifiable).
- **`flushSync()` belongs outside the root**, not in the callback body — inside, the effects created alongside it have not been scheduled yet.
- **The filename still needs `.svelte.` in it** (`foo.svelte.test.ts`); without it runes are not compiled and you get a loud `ReferenceError: $effect is not defined`. That failure mode is safe — it is the silent one above that costs you.

**Prove any new effect-driven test bites**: break the code it covers and watch it fail. A suite of this kind that has never been sabotaged is not evidence of anything.

## Fresh-worktree prerequisite

In a fresh worktree `bun --filter='@urbicon-ui/blocks' run check` and `run test` fail until the workspace deps are built (`test` reports "Failed to resolve entry for package @urbicon-ui/i18n"). Build first — `bun run build:packages` — then svelte-check is 0 errors and tests are green.
