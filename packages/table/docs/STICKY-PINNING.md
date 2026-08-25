# Urbicon UI – Table Sticky Pinning & Contained Scroll

How `@urbicon-ui/table` keeps context (toolbar, column header, group header) visible
on long lists, and how it contains scroll for wide lists. This guide ships in the
npm tarball (`docs/STICKY-PINNING.md`); the monorepo's token system, slot
conventions and responsive guidelines live in the repo's `docs/` directory.

The table offers **two scroll models**, picked per instance:

| Model | Prop | Scroll context | Use when |
|---|---|---|---|
| **Page-relative sticky** | `sticky` | The page (or nearest scroll ancestor) scrolls; layers pin to its top | The table is one of several blocks on a scrolling page |
| **Contained scroll** | `fit="viewport"` | The table is its own scroll box, capped to the viewport | The table is the primary content of a full-height list page, especially when it is wider than the viewport |

They are mutually exclusive in practice: `fit="viewport"` supersedes `sticky` (see §3).

---

## 1. The core CSS tension

`position: sticky` anchors to the nearest **scrollable** ancestor. But `overflow-x: auto`
(needed for in-table horizontal scroll) turns an element into a scroll ancestor for
**both** axes — so a single element cannot be both a sticky-pin host *and* an in-table
horizontal scroller. This forces the two-model split:

- **Page-relative sticky** deliberately omits `overflow` on the visible frame, so the
  header pins against the *page*. Trade-off: a table wider than the viewport pushes its
  horizontal overflow onto the page (the whole layout scrolls sideways).
- **Contained scroll** makes the table its own `overflow: auto` box. The header then pins
  against *that box*, and both axes scroll inside it — at the cost of the table no longer
  growing with the page (it is viewport-height-capped).

---

## 2. Page-relative sticky (`sticky`)

Three layers can pin, each offset below the previous one via CSS custom properties:

```
┌─────────────────────────────────────────┐ ─┐ scroll-ancestor top (window or
│  L1: Toolbar  (z-30)                     │  │  app-shell scroll container)
│  sticky top: var(--blocks-table-sticky-top)
├─────────────────────────────────────────┤  │ + --blocks-table-toolbar-h
│  L2: Thead    (z-20)                     │  │
│  sticky top: sticky-top + toolbar-h      │  │
├─────────────────────────────────────────┤  │ + --blocks-table-thead-h
│  L3: Group-Header  (z-10)                │  │
│  sticky top: sticky-top + toolbar-h + thead-h
├─────────────────────────────────────────┤  │
│  Rows (z-0)                              │  │
└─────────────────────────────────────────┘ ─┘
```

`resolveStickyMode(sticky)` (`core/sticky-context.svelte.ts`) maps the prop to per-layer flags:

| `sticky` value | toolbar | header (thead + group header) |
|---|---|---|
| `false` (default) | ❌ | ❌ |
| `true` / `'both'` | ✅ | ✅ |
| `'toolbar'` | ✅ | ❌ |
| `'header'` | ❌ | ✅ |

Two flags, not three: the group header is the contextual section marker of the "header"
semantic, so L2 and L3 are one decision and no configuration pins one without the other. The L3
group header uses the iOS-`UITableView` pattern: the next group header pushes the previous one
out of view automatically (shared sticky anchor, DOM order wins).

The visible frame (`scrollArea`) never sets `overflow` in this mode — that is what lets the
sticky children pin against the page instead of being trapped by an `overflow` clip.

### Stuck-state feedback

A 1px sentinel before the toolbar feeds an `IntersectionObserver` (`observeStuck`); when the
sentinel scrolls out of view the toolbar gets `data-stuck="true"`, which the variant turns into
a drop shadow. The toolbar is the only layer that has this state: the sentinel pattern does not
transfer to the thead (a `<div>` sentinel is not a valid `<table>` child), so the thead pins
without a pinned-state style and `data-stuck` appears on the toolbar wrapper alone.

---

## 3. Contained scroll (`fit="viewport"`)

`fit="viewport"` makes the table its own scroll container so wide **and** long lists scroll
*within* the table. It is opt-in (default `fit="content"` keeps the page-relative model).

**It is an assertion, not a measurement.** `fit="viewport"` tells the table it owns the page
height, and it is honoured at every width. Set it only on a table that *is* the page's primary
content — on a table embedded in a scrolling article it will cap itself against the viewport all
the same and give you a second scroller.

**Layout:**

- `container` is `display:flex; flex-direction:column` and height-capped:
  `max-height: calc(100dvh - var(--blocks-table-avail-top, 0px))`.
- `scrollArea` is `flex: 1 1 auto; min-height: 0; overflow: auto` — the only scrolling child,
  in both axes.
- Toolbar, live-update banner and pagination are `shrink-0` flex siblings **outside** the scroll
  area, so they stay fixed while only the rows scroll.

> **Why `flex-auto`, not `flex-1`:** in an auto-height (max-height-capped) flex container,
> `flex: 1 1 0%` (`flex-1`) collapses the scroll child for short tables. `flex: 1 1 auto`
> (`flex-auto`) sizes from content, so a short table hugs its content (no forced viewport-tall
> box, no needless scrollbar) while a tall table caps and scrolls.

**Height measurement (`measureViewportOffsetTop`, `utils/sticky-measure.ts`):**
`--blocks-table-avail-top` holds the viewport space reserved **above** the box — not where the
box is now, but the smallest distance to the top of the viewport it can be brought to. In the
plain page flow that is `0`: nothing is pinned above the table, so the reader can scroll it to
the top of the viewport and the whole viewport is its to use. Under a `position: sticky` /
`fixed` ancestor it is that ancestor's pin line; inside an `overflow: hidden` pane, or an app
shell whose scroll pane starts below a bar, it is what that ancestor holds above the box. A
figure at or past the viewport height would cap the box to nothing, so it reserves nothing
instead — space that large is content the reader scrolls away, not chrome kept in view.

The value cannot change when anything scrolls, which is why nothing listens to a scroll: it
re-measures on viewport resize and on a resize of the body or of the container's parent. Offsets
*inside* the container (a growing toolbar / filter chips) need no measurement either; the flex
layout absorbs them. No magic `max-height` is needed in the consumer.

**Header pinning is intrinsic to the box.** `resolveStickyMode(sticky, contained=true)` forces
`{ toolbar: false, header: true }` regardless of the `sticky` prop — a contained box whose header
scrolls away is never useful. The thead/group `top: calc(sticky-top + toolbar-h + …)` formulas
resolve to **box-relative** offsets (`0` for the thead, `thead-h` for the group header) because
`--blocks-table-sticky-top` is forced to `0` and the toolbar is not measured (it is a static
sibling, not pinned). So no per-layer variant change is needed — only the CSS-var inputs differ.

**Interactions:**

- **Supersedes `sticky`** (ignored) and **`stickyOffset`** (ignored — an app-shell bar that is an
  *ancestor* of the table is already reserved by the cap; a bar that is only a sibling is
  reserved by nothing, see §6).
- **Mutually exclusive with `virtualized`**, which keeps its own bounded scroll via
  `virtualHeight`; `fit` has no effect when `virtualized`, and a DEV-build console warning says
  so (the refusal is otherwise invisible — `data-fit` reports the resolved `"content"`).
- **No app-shell rebuild required.** The box is sized to the viewport minus what is reserved
  above it, so it fills the viewport once the reader has scrolled it into view. Content above the
  table on a scrolling page (a page heading, breadcrumbs) is not reserved space — it scrolls
  away, and the page scrolls by exactly its height.
- **`data-fit` layout hook.** The container reflects its resolved mode as `data-fit="viewport"`
  / `"content"` (the latter also when `virtualized`). Because the box reaches the bottom of the
  viewport, an ancestor with bottom padding (or a following sibling) is pushed past `100dvh` and
  yields a second, page-level scrollbar; a layout can drop that inset via the hook, at every
  width, exactly as the cap applies at every width:
  `main:has([data-fit='viewport']) { padding-block-end: 0 }`.

---

## 4. Public API (`<Table>`)

```ts
/** Page-relative pinning. See §2. @default false */
sticky?: boolean | 'toolbar' | 'header' | 'both';

/** Pixel offset for the topmost sticky layer (fixed app-shell top bar).
 *  Writes --blocks-table-sticky-top. Ignored when fit="viewport", where an
 *  ancestor bar is reserved by the cap and a sibling bar by nothing (§6).
 *  @default 0 */
stickyOffset?: number;

/** Scroll model. 'content' grows with the page; 'viewport' is a contained,
 *  viewport-capped scroll box with pinned header. See §3. @default 'content' */
fit?: 'content' | 'viewport';

/** Custom toolbar snippet (replaces the default SmartFilterBar); inherits
 *  the toolbar wrapper's behavior in both models. */
toolbar?: Snippet;
```

```svelte
<!-- Page-relative: pin everything, below a 64px app bar -->
<Table {items} {columns} sticky stickyOffset={64} />

<!-- Page-relative: pin only the column + group header -->
<Table {items} {columns} sticky="header" />

<!-- Contained: full-height list page, header pinned, both axes scroll inside -->
<Table {items} {columns} fit="viewport" />
```

---

## 5. CSS custom properties & slot overrides

| Property | Written when | Set by | Consumed by |
|---|---|---|---|
| `--blocks-table-sticky-top` | **always** | `Table.svelte`, as an inline style on every container: `stickyOffset` px, forced `0` when contained | L1 toolbar `top`; folds into L2 and L3 |
| `--blocks-table-toolbar-h` | toolbar pinned **and** a toolbar renders | `ResizeObserver` on the toolbar wrapper (border box, unrounded) | L2 thead `top` **and** L3 group-header `top` |
| `--blocks-table-thead-h` | thead pinned **and** the built-in `TableHead` renders | `ResizeObserver` on `<thead>` (border box, unrounded) | L3 group-header `top` |
| `--blocks-table-avail-top` | `fit="viewport"` and not `virtualized` | `measureViewportOffsetTop` on the container — the viewport space reserved above it: its smallest reachable distance to the top of the viewport, not its current one | container `max-height` cap |

The three measured properties fall back to `0px` in the `calc()` chains when their condition does
not hold, which is the neutral value — a layer that is not pinned adds nothing to the layer below
it. Two entries repay a second look. A `header` snippet replaces the whole `<thead>`, so nothing
writes `--blocks-table-thead-h` and a pinned group header lands on top of the column header. And
`--blocks-table-sticky-top` has no reachable default at all: every container carries it as an
**inline** style, which also outranks a consumer stylesheet rule that is not `!important`.

### What an override does to a pinned slot

`resolveSlotClass` (`core/table-style-context.ts`) has two branches, and they treat these classes
in opposite ways.

- **`unstyled`** concatenates: the slot's look is dropped, and what is left is `slotClasses`, the
  call site's own utilities, and the config's structural classes — today exactly the desktop/card
  layout switch, which decides which markup is *visible* rather than how it looks. Nothing is
  merged, so what you write is what renders.
- **Styled** (the default) routes `slotClasses` through the `class` option of the `tv()` slot
  function, where the conflict fold lets an override *replace* the base class that shares its
  Tailwind bucket. That is what makes `slotClasses={{ table: 'w-auto' }}` beat the slot's own
  `w-full` — and on a pinned slot it subtracts:

| Override | What is left |
|---|---|
| `slotClasses.toolbar = 'static'` | `sticky` is gone; `z-30` and `top-[var(--blocks-table-sticky-top,0px)]` stay behind with nothing to position |
| `slotClasses.thead = 'top-0'` | the `top: calc(sticky-top + toolbar-h)` formula is gone — the thead pins at the very top, where the `z-30` toolbar covers it |
| `slotClasses.thead = 'z-[var(--z-sticky)]'` | `z-20` is gone — at `--z-sticky: 1100` the thead now stacks *above* the toolbar |

So an override on a pinned slot is a replacement, not an addition. Add to a pin by restating the
whole property (`top-[calc(var(--blocks-table-sticky-top,0px)+2rem)]`), not by putting a bare
utility beside it.

The variants themselves hold to **one utility per property per slot**: over every combination of
`variant`/`size`/`stickyToolbar`/`contained` the exported function accepts, no slot emits two
`overflow`, `top`, `max-h` or `z` classes. That is a property of the configs, and only of them —
the fold above resolves a base class against an override, but two overrides reaching one slot
from different sources (a `slotClasses` entry and the call site's own utilities) share one source
inside the fold, and both survive. Contained mode therefore changes the **var inputs**, not the emitted classes.

### Re-applying the pins under `unstyled`

`unstyled` drops the slot's look, and pinning goes with it — pinning is a layout function, but it
is expressed in the same classes. (The desktop/card layout switch is the exception: it survives,
because a table that renders its grid and its card list at once is not a restyled table.) Three
things to know when rebuilding the pins:

- The classes go back on `slotClasses.container` (the contained height cap, and the
  `flex flex-col` it sits on), `toolbar`, `thead`, `groupHeader` and `scrollArea` — or style the
  `data-table-*` attributes instead.
- Keep the `sticky` / `fit` props set. They are not styling: they are what attaches the two
  height measurements and the stuck observer. Without them `--blocks-table-toolbar-h` and
  `--blocks-table-thead-h` are never written, both `var()`s fall back to `0px`, and the group
  header pins on top of the column header.
- One class has no way back: the `shrink-0` that keeps the live-update banner and the pagination
  wrapper from being squeezed inside a contained box comes from an internal slot, and that slot
  has no `slotClasses` key.

---

## 6. Edge cases & caveats

| Case | Behavior |
|---|---|
| Wide table + `sticky="header"` | Horizontal overflow falls back to the **page** (no in-table h-scroll). Switch to `fit="viewport"` to contain it. |
| Wide table + `fit="viewport"` | Horizontal scrollbar appears **inside** the table; the page never scrolls sideways. |
| Short table + `fit="viewport"` | Container hugs content (`< max-height`); no forced viewport-tall box, no scrollbar. |
| Ancestor bottom-padding + `fit="viewport"` | Box reaches `100dvh`, so a padded wrapper/sibling adds a second page scrollbar. Drop the inset via the `data-fit="viewport"` hook (see §3). |
| `view.groupBy` + sticky/contained | Group headers pin (they are the "header" layer). In contained mode at `top: thead-h`. |
| Summary row + `fit="viewport"` | The summary row pins in **no** layer, so the totals are the one line the contained box does not keep in view: they scroll away with the rows. If they have to stay visible, aggregate them yourself and render them beside the table rather than in it. |
| `virtualized` | Manages its own bounded scroll (`virtualHeight`); `fit` is ignored (a DEV warning says so), `sticky` still works (thead already sits outside the virtual scroller). The summary row is a separate `<table>` *after* the full-height spacer inside that scroller, so the totals sit at the far end of the virtual scroll — 200 000px down for 5 000 rows at the `md` step of 40px. |
| `unstyled` | Strips the sticky/contained classes on every slot, `container` included — but not the props that drive the measurements. Rebuilding it: §5. |
| Nested scroll ancestor | Page-relative sticky binds to it — intended inside a `Drawer` body, surprising inside an accidental `overflow` wrapper. With `fit="viewport"` it is supported without a listener: the reserved space is what the ancestor holds above the box, which scrolling that ancestor does not change. |
| Fixed top bar that is a **sibling** of the table | Not reserved. `fit="viewport"` ignores `stickyOffset`, and only *ancestors* are measured — put the content in the scroll container below the bar, or keep the bar as an ancestor. |
| Chrome added/removed above the table inside a **fixed-height** pane | Resizes no observed box, so the reading holds until the next resize: the box is then too tall by that much (reaching past the viewport bottom) or too short by it (empty space below). |
| SSR / first paint + `fit="viewport"` | `--blocks-table-avail-top` is written by an attachment, and attachments do not run on the server, so the cap resolves to `calc(100dvh - 0px)` until hydration: a table N px down the document is N px too tall for one frame. Where the offset is known ahead of time (a fixed app-shell header), declare `--blocks-table-avail-top` on the container in your own CSS — nothing declares it in the server output, so your value holds the first paint and the measured one takes over at hydration. |

---

## 7. Breaking-change history

| Change | From | To | Migration |
|---|---|---|---|
| Frame slot | `slotClasses.wrapper` (had hardcoded `overflow-hidden`, which blocked sticky) | `slotClasses.scrollArea` (no `overflow` in the base) | Rename `slotClasses.wrapper` → `slotClasses.scrollArea`. A DEV warning fires on the old key. |

---

## 8. Source map

| Concern | File |
|---|---|
| Per-layer mode resolution, reactive context | `packages/table/src/lib/core/sticky-context.svelte.ts` |
| Container / toolbar / scrollArea slots + `contained` variant | `packages/table/src/lib/variants/table.variants.ts` |
| Thead `sticky` variant | `packages/table/src/lib/variants/table.variants.ts` (`tableHeaderVariants`) |
| Group-header `sticky` variant | `packages/table/src/lib/variants/table-features.variants.ts` (`groupHeaderVariants`) |
| Prop wiring, var setup, measurement attach | `packages/table/src/lib/core/table/Table.svelte` |
| `measureToCssVar`, `measureViewportOffsetTop`, `observeStuck` | `packages/table/src/lib/utils/sticky-measure.ts` |
| `unstyled` / `slotClasses` merge (`resolveSlotClass`) | `packages/table/src/lib/core/table-style-context.ts` |
| Tests: emitted classes | `packages/table/src/lib/variants/table.sticky.test.ts` |
| Tests: what the attachments write | `packages/table/src/lib/utils/sticky-measure.test.ts` |
| Tests: what a mounted `<Table>` attaches where | `packages/table/src/lib/core/Table.sticky.svelte.test.ts` |
| Tests: the contained box in a real browser | `e2e/table-contained.spec.ts` |
| Live docs | `apps/docs/src/routes/table/sticky-pinning/+page.svelte`, and the full-page `fit="viewport"` demo at `apps/docs/src/routes/table/sticky-pinning/contained/+page.svelte` |
