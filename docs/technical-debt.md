# Technical Debt

Small, non-blocking findings surfaced in passing that don't belong to the task
at hand and can't be fixed on the fly — they need a design decision or a broader
sweep. Logged here so they aren't lost. Actively planned work lives in the
internal TODO instead.

## Design tokens

### Calendar current-time indicator uses `red-500` instead of a semantic token

- **Where:** `packages/blocks/src/lib/components/Calendar/calendar.variants.ts`
  (`currentTimeLine` slot → `border-red-500`) and
  `packages/blocks/src/lib/components/Calendar/CalendarTimeGrid.svelte`
  (`bg-red-500`).
- **What:** The "now" line/marker in the time-grid view is a primitive Tailwind
  colour, against the repo maxim "semantic design tokens over primitive Tailwind
  classes". It is also the one calendar affordance that isn't `light-dark()`-aware
  (red-500 does read acceptably in both themes, so this is cosmetic, not a bug).
- **Why deferred:** A red "now" line is a real convention (Google Calendar et al.),
  and no existing semantic token fits — `--color-danger` is semantically wrong (it
  is not an error state). Resolving it is a design decision, not a mechanical
  swap: either introduce a dedicated token (e.g. a generic "live/now" accent that
  themes correctly) or consciously document red as an intentional exception.
- **Found:** 2026-07-07, while adding `calendar.variants.test.ts` (the
  `never dark:` slot sweep passes because this is a fixed colour, not a `dark:`
  override — the token gap is orthogonal).

## Testing

### No standing e2e guard for Dialog/Drawer modal promotion

- **Where:** `e2e/` (no dialog/drawer spec) and
  `apps/docs/src/routes/test-fixtures/` (no dialog/drawer fixture).
- **What:** The Dialog/Drawer `showModal()` ref-bind bug (fixed 2026-07-07 —
  `showDialogModal` ran in the same effect tick that set `isVisible`, before
  `bind:this` assigned the dialog element, so it captured `undefined` by value
  and silently no-op'd; the overlays never actually entered the top layer, so
  there was no initial panel focus and `:modal` never matched → nested overlays
  hit the iOS #23 path). It is now covered at the unit level
  (`Dialog.svelte.test.ts` asserts `dialog.open` via the jsdom `showModal` stub)
  and was verified once in Chromium (`:modal` + focus moved into the panel), but
  jsdom cannot assert `:modal` / top-layer, so there is no *standing* browser
  regression guard.
- **Why deferred:** A robust guard wants a dedicated `test-fixtures/dialog` (+
  `-drawer`) route and spec (à la `floating.spec.ts`), not a brittle assertion
  against the docs playground page (which also needs an SSR→hydration retry).
  That is its own small package — fixture route, docs-app rebuild, spec — beyond
  the test-writing task in flight.
- **Found:** 2026-07-07, while adding the jsdom interaction tests for
  Select/Menu/Dialog; the test-quality review surfaced the latent showModal bug.
