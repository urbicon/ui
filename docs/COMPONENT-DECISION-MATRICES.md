# Component Decision Matrices

> Quick-look tables that answer "which component for this use-case?" — written for both human consumers and LLM agents working through the MCP server.
>
> Each matrix lives next to the relevant component docs; this page is the canonical index.

---

## Overlay & Layout Surfaces

Four components occupy overlapping territory: **Sidebar** (primitive, semantic landmark), **Drawer** (primitive, modal sheet), **Popover** (primitive, anchored floating panel), and **SidebarLayout** (component, full app-shell). Picking the right one is mostly about persistence (transient vs. always-present), modality (focus-trapped vs. inline), and the consumer's need to handle the page-shell themselves.

### Decision matrix

| Use-case                                                          | Recommended                                                                       | Why                                                                                                   |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| App-shell with persistent left nav (responsive overlay on mobile) | **`SidebarLayout`**                                                               | App-shell concern. Wires Sidebar + main + mobile hamburger; consumer only supplies items.             |
| App-shell with custom grid (header bar, multi-region content)     | **`Sidebar`**                                                                     | Use the primitive directly so you own the surrounding layout.                                         |
| Transient detail panel (click → slide-in → close after action)    | **`Drawer`** with `placement="right"`                                             | Modal semantics, focus trap, backdrop — all the things a sidebar should not do for a transient panel. |
| Mobile bottom sheet                                               | **`Drawer`** with `placement="bottom"`                                            | Drawer supports all four edges; Sidebar is left/right only.                                           |
| Filter panel (persistent on desktop, overlay on mobile)           | **`Sidebar`** with `mode="responsive"`                                            | Hybrid lifecycle is exactly Sidebar's purpose.                                                        |
| Collapsible side panel (toggleable on desktop too)                | **`Sidebar`** with `mode="collapsible"` or **`SidebarLayout`** with the same mode | Width-animation behaviour, no backdrop on desktop.                                                    |
| Anchored picker (date, action menu, autocomplete)                 | **`Popover`**                                                                     | Floating-UI positioning, not modal.                                                                   |
| Hover description for an inline target                            | **`Tooltip`**                                                                     | `aria-describedby` pattern, no click trigger.                                                         |
| Stack of system notifications                                     | **`Toast`**                                                                       | Auto-dismiss, stacking, not modal.                                                                    |

### Sidebar vs. Drawer — semantic difference

- **Sidebar** is `<aside>`. It can be persistent on desktop, slide-in on mobile (`mode="responsive"`), and the desktop variant has no backdrop. Use it when the panel is part of the page shell.
- **Drawer** is `<dialog>`. It is always modal — backdrop and focus-trap are non-optional. Use it when the panel is transient and should pull attention.

If you find yourself disabling Drawer's backdrop and Escape-key handling, you probably want a Sidebar. If you find yourself adding Escape/backdrop logic to a Sidebar, you probably want a Drawer.

### Code anchors

- App-shell recipe: [/recipes/dashboard](../apps/docs/src/routes/recipes/dashboard/+page.svelte) — `SidebarLayout` with responsive sidebar and mobile hamburger.
- Filter-panel recipe: [/recipes/filter-sidebar](../apps/docs/src/routes/recipes/filter-sidebar/+page.svelte) — `Sidebar` with `mode="responsive"`, persistent on desktop / overlay on mobile, live client-side filtering.
- Detail drawer recipe: [/recipes/trace-drawer](../apps/docs/src/routes/recipes/trace-drawer/+page.svelte) — `Drawer` with recursive payload, `size="lg"` for deep content.
- Custom-shell sidebar example: `apps/docs/src/routes/blocks/primitives/sidebar/Docs.svelte` — `Sidebar` primitive used standalone.

---

## Date Surfaces — Calendar vs. Planner

Two components lay things out on dates, and the MCP used to steer day-content boards toward `Calendar` (a timed-event scheduler). They do not overlap: **Calendar** schedules timed `CalendarEvent`s (clock times, multi-day bars, recurrence, drag-resize, a time grid); **Planner** buckets your own `T[]` onto calendar days and hands each day to a `cell` snippet.

### Decision matrix

| Question                                            | → Calendar                          | → Planner                                            |
| --------------------------------------------------- | ----------------------------------- | --------------------------------------------------- |
| Does the content have a **clock time**?             | yes (a 14:00–15:00 appointment)     | no (a meal / shift / day note)                      |
| Should items **span multiple days**?                | yes (holiday, trip)                 | no (single-date bucketing)                          |
| Is the cell content **your** domain markup + actions? | no — event list / bars            | yes — a `cell` snippet over your `T`                |
| Do you need **time-grid / recurrence / drag-resize**? | yes                               | no                                                   |
| Datatype in the snippet                             | `CalendarEvent`                     | your `T`                                             |
| Typical cases                                       | booking calendar, bin collection, appointments | weekly meal / menu plan, shift roster, occupancy, content calendar |

### When it's still ambiguous

- If you are about to cram a meal/task/shift into `CalendarEvent.meta` and cast it back out per cell, you want **Planner** — it carries your real type end to end.
- If you are disabling Planner's single-date model to fake a multi-day bar, you want **Calendar** — spanning is its event-layout job.
- Both share the headless `DateGridController` under the hood (geometry, navigation, ISO weeks, roving-focus a11y), so neither is "lighter" — pick on the data model, not on weight.

### Code anchors

- Planner board recipe: [/recipes/meal-planner](../apps/docs/src/routes/recipes/meal-planner/+page.svelte) — weekly plan with bucketed cards and an add affordance.
- Planner doc page: `apps/docs/src/routes/blocks/components/planner/Docs.svelte` — week, month, slotClasses, server-safe weeks.
- Pattern: `get_pattern("planning-board")` — composition rules for date-indexed boards.

---

## Form-input layer — Select vs. Combobox vs. Menu (XC-7)

Three components open an anchored floating panel from a trigger and look deceptively
interchangeable. They are not: **Select** and **Combobox** are Form-family *value holders*
(`bind:value` + `onValueChange`, label/helper/error/required chrome), while **Menu** is an
Action-family *verb dispatcher* — items fire `onSelect`, nothing is held afterwards. The family
split (border source, tiers, ARIA doctrine) is documented in
[COMPONENT-FAMILIES.md](COMPONENT-FAMILIES.md); this matrix answers the day-to-day "which one here?".

### Decision matrix

| Use-case                                                        | Recommended                        | Why                                                                                                       |
| --------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Pick one value from a short, known list (≲ 12 options)          | **`Select`**                       | Value semantics plus full form chrome (label, helper, error, required); no search input in the way.        |
| Pick a value from a long or unfamiliar list (country, user, tag) | **`Combobox`**                     | The trigger *is* the `<input>` — type-to-filter beats scrolling a long listbox.                            |
| Pick a value the server has to find                              | **`Combobox`** with `queryFn`      | Built-in debounced async search with stale-response handling; a Select has no query to send.               |
| Pick multiple values, compact field                              | **`Select multiple`**              | Listbox stays open across picks; the trigger summarises (or build a count badge via `customTriggerContent`). |
| Pick multiple values, picks should stay visible                  | **`Combobox multiple`**            | Selections render as removable tag chips inline with the search input.                                     |
| One-off actions on a record (Edit / Duplicate / Delete)         | **`Menu`**                         | Items are verbs firing `onSelect`; nothing is "selected". Closes on activation.                            |
| Right-click / long-press context actions                        | **`Menu`** with `contextTrigger`   | Same action semantics, panel parked at the pointer position.                                               |
| Nested action groups (Export → CSV / JSON / PDF)                | **`Menu`** with nested `items`     | Submenus are a Menu capability. Select/Combobox `groups` label sections but deliberately don't nest.       |
| Global "jump to anything / run any command"                     | **`CommandPalette`**               | Modal, keyboard-first (Cmd+K), searches verbs *and* destinations — a different scale than a field picker.  |
| 2–5 choices that should stay visible                            | **`RadioGroup`** / **`SegmentGroup`** | Don't hide a handful of options behind a dropdown — showing them costs little and saves a click.        |
| Free text where the value may be outside the list               | **`Input`** (+ own suggestion UI)  | Select/Combobox are pick-from-list: `value` is always one of `options` — a Combobox never commits arbitrary text. |

### The two questions that settle most cases

1. **Does the control hold a value afterwards?** No — the click *does* something → **Menu**.
   Yes → question 2.
2. **Does the user know the list, or do they need to search it?** Short/known → **`Select`**.
   Long, unfamiliar, or server-backed → **`Combobox`**.

Corollary (the family doc states it, the matrix repeats it): pick **multiple values** with
`Select multiple` / `Combobox multiple`, never with a Menu faking checkmarks — a Menu closes on
activation and announces `menuitem`, not `option` + selection state. Menu's per-item `keepOpen`
exists for genuine *verb* lists that shouldn't dismiss ("toggle grid", "toggle rulers"), not for
value picking.

### What a screen reader hears (why the split is not cosmetic)

| Surface        | `Select`                                        | `Combobox`                                     | `Menu`                          |
| -------------- | ----------------------------------------------- | ---------------------------------------------- | ------------------------------- |
| Trigger        | `role="combobox"` + `aria-haspopup="listbox"`   | the `<input>` itself, `role="combobox"`        | Button + `aria-haspopup="menu"` |
| Panel          | `role="listbox"` (+ `role="group"` per group)   | `role="listbox"` (+ `role="status"` for async) | `role="menu"`                   |
| Items          | `role="option"` + `aria-selected`               | `role="option"` + `aria-selected`              | `role="menuitem"`               |
| Keyboard focus | stays on the trigger, `aria-activedescendant`   | stays on the input, `aria-activedescendant`    | roving focus across items       |

A screen reader user told "menu" expects verbs; told "listbox" expects a value commit. Using the
wrong component isn't a styling nuance — it mis-announces the interaction contract.

### Code anchors

- Select in a form context: [/recipes/settings](../apps/docs/src/routes/recipes/settings/+page.svelte) — grouped settings page with Select fields.
- Menu on a dashboard card: [/recipes/dashboard](../apps/docs/src/routes/recipes/dashboard/+page.svelte) — per-widget action menu.
- Async Combobox: `packages/blocks/src/lib/primitives/Combobox/index.ts` — the `queryFn` JSDoc is the canonical reference (the docs page has no async demo yet — see technical-debt).
- Doctrine: [COMPONENT-FAMILIES.md](COMPONENT-FAMILIES.md) §Action / §Form — border source, tier behaviour, ARIA per family.

---

## When the matrix is silent

If you cannot find your use-case here, the choice usually collapses to three questions:

1. **Is the panel part of the page layout, or is it a temporary attention-grabber?** Layout → Sidebar/SidebarLayout. Attention → Drawer.
2. **Is it anchored to a single element on the page (button, input, icon)?** Yes → Popover. No → one of the above.
3. **Anchored panel with list content?** Value → Select/Combobox, verbs → Menu (see the form-input matrix above); anything richer → plain Popover.

Tooltip and Toast almost never collide with the four above — Tooltip is descriptive-only, Toast is system-level.

---

## Related cross-cutting clusters

- **XC-14** in [archive/2026-05/V1-HARDENING-AUDIT.md](archive/2026-05/V1-HARDENING-AUDIT.md) — origin of this matrix.
- **XC-7** — Combobox / Select / Menu disambiguation → [§ Form-input layer](#form-input-layer--select-vs-combobox-vs-menu-xc-7) above.
- **XC-11** — Cross-overlay animation tokens (Dialog/Drawer/Popover/Tooltip/Toast).

---

## Floating / Overlay primitives (architecture cheatsheet)

How the floating components stack up under the hood, so contributors picking patterns or
adding new primitives know what to mirror:

| Primitive    | Top-layer strategy           | Positioning                 | Composes                   | Notes                                                          |
| ------------ | ---------------------------- | --------------------------- | -------------------------- | -------------------------------------------------------------- |
| **Tooltip**  | `popover="manual"`           | Floating UI `strategy:fixed` | —                          | Hover/focus driven; no light dismiss; not click-toggle-able.   |
| **Popover**  | `popover="auto"` or `"manual"` (derived) | Floating UI `strategy:fixed` | —                          | Auto when `closeOnEscape && closeOnClickOutside` (default); manual otherwise so the consumer can veto either path. |
| **Menu**     | (inherits from Popover)      | (via Popover)               | wraps **Popover** internally | Owns keyboard nav + item registry; positioning + dismiss come from Popover. |
| **Select**   | `popover="manual"`           | Floating UI `strategy:fixed` | —                          | Form input with a listbox panel. Manual mode so existing keydown/outside-click handlers stay in control. |
| **Combobox** | `popover="manual"`           | Floating UI `strategy:fixed` | —                          | Like Select, but the trigger is the `<input>` itself and `aria-activedescendant` keeps DOM focus on the input. |

**Why `popover="manual"` for form inputs (Select/Combobox):** the native light-dismiss in `popover="auto"`
fights with our pointerdown-on-trigger toggle flow. Manual mode plus our own outside-click /
Escape listeners is the simplest path that keeps the form-input UX intact.

**Why `popover="auto"` is the Popover default:** the browser provides Escape, light-dismiss, focus
restoration, and single-stack semantics for free. We only switch to `manual` when the consumer
disables one of those paths via `closeOnEscape` / `closeOnClickOutside`.

### Unified non-modal dismiss API

All three (Popover / Select / Combobox) accept the same dismiss surface:

| Prop                   | Type            | Default | Effect                                       |
| ---------------------- | --------------- | ------- | -------------------------------------------- |
| `closeOnEscape`        | `boolean`       | `true`  | Close on Escape key.                          |
| `closeOnClickOutside`  | `boolean`       | `true`  | Close on pointerdown outside the panel.       |
| `onEscape`             | `() => void`    | —       | Fires after Escape closes. Notification only — does **not** govern whether close happens. |
| `onClickOutside`       | `() => void`    | —       | Fires after an outside click closes. Same semantics as `onEscape`. |

**Modal primitives (Dialog/Drawer/ConfirmDialog/Sidebar)** keep the older `closeOnBackdropClick` + `closeOnEscape`
naming. The wording reflects the explicit `<backdrop>` element these components render — "click outside" is
the right abstraction only when no scrim exists.

### Reference patterns

- **Tooltip top-layer migration** ([commit `1d9720c`](https://codeberg.org/urbicon/ui/commit/1d9720c)) — the
  canonical example of switching a floating component from inline `position: absolute` to native popover
  top-layer rendering, including the UA-stylesheet pitfalls (overflow:auto clipping the arrow, restProps
  reordering for load-bearing attributes, `Number.isFinite` guards on Floating UI output).
- **Popover dismiss-API** ([commit `9443787`](https://codeberg.org/urbicon/ui/commit/9443787)) — derived
  `popoverMode` (auto/manual) with re-cycle on mode flip, capture-phase pointerdown listener but
  bubble-phase Escape listener so inner widgets can preventDefault.

### Focus-restoration policy (non-modal)

| Path                     | Tooltip | Popover         | Select / Combobox |
| ------------------------ | ------- | --------------- | ----------------- |
| Selection / commit       | —       | (consumer)      | → trigger / input |
| Escape                   | trigger | → trigger       | → trigger / input |
| Outside click            | trigger | → trigger       | **stay** (user explicitly clicked elsewhere) |
| Trigger click while open | —       | stay (no-op)    | → trigger / input |

The "stay on outside click" policy for Select/Combobox is intentional: form inputs are most commonly
dismissed by clicking another field, and stealing focus back to the trigger would override the user's
intent. Popover restores focus on outside click because the consumer typically dismisses to return
to the trigger context.
