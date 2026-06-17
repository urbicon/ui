# Urbicon UI – Table Sticky Pinning & Contained Scroll

How `@urbicon-ui/table` keeps context (toolbar, column header, group header) visible
on long lists, and how it contains scroll for wide lists. Cross-refs:
[ARCHITECTURE.md](ARCHITECTURE.md) (token system),
[ComponentStructureStandard.md](ComponentStructureStandard.md) (slot conventions),
[ResponsiveGuidelines.md](ResponsiveGuidelines.md) (breakpoints, touch targets).

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

| `sticky` value | toolbar | header | group |
|---|---|---|---|
| `false` (default) | ❌ | ❌ | ❌ |
| `true` / `'both'` | ✅ | ✅ | ✅ |
| `'toolbar'` | ✅ | ❌ | ❌ |
| `'header'` | ❌ | ✅ | ✅ |

`'header'` also pins the group header, because the group header is the contextual section
marker of the "header" semantic. The L3 group header uses the iOS-`UITableView` pattern:
the next group header pushes the previous one out of view automatically (shared sticky anchor,
DOM order wins).

The visible frame (`scrollArea`) never sets `overflow` in this mode — that is what lets the
sticky children pin against the page instead of being trapped by an `overflow` clip.

### Stuck-state feedback

A 1px sentinel before the toolbar feeds an `IntersectionObserver` (`observeStuck`); when the
sentinel scrolls out of view the toolbar gets `data-stuck="true"`, which the variant turns into
a drop shadow. The thead reserves `data-[stuck=true]:shadow-…` for future use but has no
sentinel (a `<div>` sentinel is not a valid `<table>` child).

---

## 3. Contained scroll (`fit="viewport"`)

`fit="viewport"` makes the table its own scroll container so wide **and** long lists scroll
*within* the table. It is opt-in (default `fit="content"` keeps the page-relative model).

**Layout (desktop / `md`+):**

- `container` is `display:flex; flex-direction:column` and height-capped:
  `max-height: calc(100dvh - var(--blocks-table-avail-top, 0px))`.
- `scrollArea` is `flex: 1 1 auto; min-height: 0; overflow: auto` — the only scrolling child,
  in both axes.
- Toolbar and pagination are `shrink-0` flex siblings **outside** the scroll area, so they stay
  fixed while only the rows scroll.

> **Why `flex-auto`, not `flex-1`:** in an auto-height (max-height-capped) flex container,
> `flex: 1 1 0%` (`flex-1`) collapses the scroll child for short tables. `flex: 1 1 auto`
> (`flex-auto`) sizes from content, so a short table hugs its content (no forced viewport-tall
> box, no needless scrollbar) while a tall table caps and scrolls.

**Height measurement (`measureViewportOffsetTop`, `utils/sticky-measure.ts`):**
the container's distance from the top of the *document* (`getBoundingClientRect().top +
scrollY`) is written to `--blocks-table-avail-top`. It is measured document-relative
(scroll-invariant) so re-measuring never feeds back into the page's scroll position, and it
re-measures on viewport resize and on body reflow (content above the table — tabs, banners —
shifting it down). Offsets *inside* the container (a growing toolbar / filter chips) need no
measurement; the flex layout absorbs them. No magic `max-height` is needed in the consumer.

**Header pinning is intrinsic to the box.** `resolveStickyMode(sticky, contained=true)` forces
`{ toolbar: false, header: true, group: true }` regardless of the `sticky` prop — a contained
box whose header scrolls away is never useful. The thead/group `top: calc(sticky-top +
toolbar-h + …)` formulas resolve to **box-relative** offsets (`0` for the thead, `thead-h` for
the group header) because `--blocks-table-sticky-top` is forced to `0` and the toolbar is not
measured (it is a static sibling, not pinned). So no per-layer variant change is needed — only
the CSS-var inputs differ.

**Interactions:**

- **Supersedes `sticky`** (ignored) and **`stickyOffset`** (ignored — the measured top absorbs
  app-shell offsets).
- **Mutually exclusive with `virtualized`**, which keeps its own bounded scroll via
  `virtualHeight`; `fit` has no effect when `virtualized`.
- **Desktop-only.** All contained classes are `md:`-prefixed; mobile (`MobileCard`s) keeps
  normal document-level scroll.
- **No app-shell rebuild required.** Sizing the container to `100dvh - top` makes the page
  exactly viewport-height when the table is the main content, so it does not scroll; the
  measurement encapsulates the offset.

---

## 4. Public API (`<Table>`)

```ts
/** Page-relative pinning. See §2. @default false */
sticky?: boolean | 'toolbar' | 'header' | 'both';

/** Pixel offset for the topmost sticky layer (fixed app-shell top bar).
 *  Writes --blocks-table-sticky-top. Ignored when fit="viewport". @default 0 */
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

## 5. CSS custom properties

| Property | Default | Set by | Consumed by |
|---|---|---|---|
| `--blocks-table-sticky-top` | `0px` | consumer via `stickyOffset` (forced `0` when contained) | L1 toolbar `top`, folds into L2/L3 |
| `--blocks-table-toolbar-h` | `0px` | `ResizeObserver` on the toolbar (only when toolbar is pinned) | L2 thead `top` |
| `--blocks-table-thead-h` | `0px` | `ResizeObserver` on `<thead>` | L3 group-header `top` |
| `--blocks-table-avail-top` | `0px` | `measureViewportOffsetTop` on the container (only when `fit="viewport"`) | container `max-height` cap |

`resolveSlotClass` joins classes with a plain `join` (no `twMerge`), so the variants are
written to emit exactly one `overflow`/`top`/`max-h` class per slot — competing utilities would
both apply. Contained mode changes the **var inputs**, not the emitted classes, precisely to
avoid competing `top-*` declarations.

---

## 6. Edge cases & caveats

| Case | Behavior |
|---|---|
| Wide table + `sticky="header"` | Horizontal overflow falls back to the **page** (no in-table h-scroll). Switch to `fit="viewport"` to contain it. |
| Wide table + `fit="viewport"` | Horizontal scrollbar appears **inside** the table; the page never scrolls sideways. |
| Short table + `fit="viewport"` | Container hugs content (`< max-height`); no forced viewport-tall box, no scrollbar. |
| `groupByKey` + sticky/contained | Group headers pin (they are the "header" layer). In contained mode at `top: thead-h`. |
| `virtualized` | Manages its own bounded scroll (`virtualHeight`); `fit` is ignored, `sticky` still works (thead already sits outside the virtual scroller). |
| `unstyled` | Strips the sticky/contained classes — pinning is a layout function, not pure styling. Re-apply via `slotClasses.toolbar` / `slotClasses.thead` / `slotClasses.scrollArea`, or target the `data-table-*` attributes. |
| Nested `overflow:auto` ancestor | Page-relative sticky binds to it — intended inside a `Drawer` body, surprising inside an accidental wrapper. |
| Mobile (`max-md`) | `MobileCard`s + document scroll; contained classes do not apply. |

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
| Tests | `packages/table/src/lib/variants/table.sticky.test.ts` |
| Live docs | `apps/docs/src/routes/table/sticky-pinning/+page.svelte` |
