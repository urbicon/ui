# Variant Contract

What each `variant` value means across the library — the semantics behind the names, so
that the same word describes the same visual treatment wherever it appears.

This is a reference for consumers styling their app and for anyone adding a variant to an
existing component. The rule it encodes: **siblings share vocabulary.** If a component
covers the same interaction as another, it reuses that component's value name for the same
treatment rather than inventing a synonym.

> The style axis is always named `variant` — never `appearance`, `look`, or `style`.
> Structural builds are `variant` values too (Tab's `line | pills | enclosed | solid`,
> Toggle's `default | dot`). One axis name, whatever the values express.

---

## 1 · The surface ladder

Every container variant is built from four tints that sit on top of `surface-base`
(the page background). Picking a variant is really picking a rung:

| Token | Reads as | Lift relative to base |
| --- | --- | --- |
| `surface-base` | The page itself | — |
| `surface-quiet` | A softly tinted in-page zone — "own zone", no border, no shadow | ~1 % darker (light), ~3 % lighter (dark) |
| `surface-subtle` | A **resting** tint against a border — readonly/disabled fields, list rows, code chips | ~2 % darker (light), ~5 % lighter (dark) |
| `surface-elevated` | A floating overlay with its own stacking context | same lift as `subtle`, plus shadow + z-index |
| `surface-overlay` | Modal backdrop — translucent, draws focus off the page | n/a (translucency) |

Two traps worth naming:

- **`surface-subtle` is not a hover step.** It resolves to exactly `surface-elevated`, so
  `hover:bg-surface-subtle` is invisible on every elevated surface (Popover, Menu, Select
  dropdown, elevated Card). Use `surface-hover` for hover fills — `variants:lint` errors
  on any hover fill naming a reading surface.
- **For a tinted in-page zone, reach for `surface-quiet`, not `surface-subtle`.** The
  latter kept only its resting-against-a-border role.

---

## 2 · Card

| `variant` | Treatment | Reach for it when |
| --- | --- | --- |
| `quiet` *(default)* | `surface-quiet` tint, no border, no shadow | The card groups content inside a page that already has structure |
| `outlined` | Transparent background + `border-default` | The card is in-page chrome and must not add a tint |
| `elevated` | `surface-elevated` + `shadow-md` | The card should lift off the page on its own |
| `floating` | `surface-elevated` + `shadow-lg` | Popover-weight lift — the heaviest rung |

`elevated` gains a `hover:shadow-lg` lift **only** with `interactive`. A non-interactive
card that animates on hover falsely signals interactivity (WCAG 3.2).

`dividers` defaults to **false**. Set `dividers` to get hairlines between header, body and
footer — the traditional card-with-header look.

### Card shape: `tier`

`variant` picks the card's weight; `tier` picks its **shape family**, and it has exactly two
values because there are exactly two answers:

| `tier` | Radius | Reach for it when |
| --- | --- | --- |
| `contain` *(default)* | `--radius-contain` | The card is architecture — a panel, a section, a page-level surface |
| `bridge` | `--radius-bridge` | The card is a small tinted **content** tile — a chip, a stat cell, a compact list card |

The distinction is optical, not decorative. Radius scales with the area it turns: the hairline
edge that reads as *precise* on a 600 px panel reads as an untouched rectangle on a 200 px tile.
That is the same reasoning behind ChatMessage's bubble and a Menu panel under a pill trigger —
`bridge` simply gives it a name on the component a consumer composes at any size.

It is **not** a way to give one card a different look. Card weight is `variant`; a project-wide
Card treatment is `BlocksProvider` `defaults`; a project-wide shape change is the tier token
(`--radius-contain`), which moves Card, Dialog, Alert and Popover together. Reaching for
`class="rounded-xl"` on individual cards splits the family and is the anti-pattern the design
principles name — see `principles.md` → "Semantic Radius Tiers".

---

## 3 · Alert

| `variant` | Treatment | Voice |
| --- | --- | --- |
| `soft` *(default)* | `bg-{intent}-subtle`, no border | Quiet, sits in the reading flow |
| `inline` | `border-l-2` only, transparent background | Memo-style — the quietest form, no surrounding box |
| `filled` | `bg-{intent}`, on-intent text | Strongest emphasis |

Alert and Toast carry the **feedback intent palette**: they add `info` and drop
`secondary`. `info` is a stable informational blue that survives a brand recolour, which
`primary` — being the brand colour — cannot. A violet alert names no status, hence no
`secondary`.

---

## 4 · Accordion & Collapsible

The two disclosure siblings share one vocabulary:

| `variant` | Accordion | Collapsible |
| --- | --- | --- |
| `default` | Hairlines between items (`divide-y`) | No chrome |
| `card` | Items as standalone card blocks, `surface-quiet` tint, `space-y-2`, no dividers | Bordered block: `border-hairline` + `rounded-contain` + `shadow-sm` |
| `ghost` | No separators, hover tint per item | No separators, hover tint on the trigger |

---

## 5 · Table chrome

| `variant` | Treatment | Reach for it when |
| --- | --- | --- |
| `flush` *(default)* | No outer frame — the table sits inline in the reading flow | The table is the content of the page or section |
| `surface` | `bg-surface-quiet` — a gentle tinted zone, no border | The table needs to read as its own zone without a frame |
| `framed` | `surface-elevated` + `border-default` + `rounded-contain` + `shadow-sm` | The table is a standalone block among other blocks |

The frame belongs to the table, not to one of its layouts: below the mobile
breakpoint the same treatment wraps the record list, and the records inside it
are separated by hairlines rather than each carrying a frame of its own. One
`slotClasses.scrollArea` override therefore reaches both.

---

## 6 · Dialog & Drawer — intent without a colour bar

Dialog and Drawer accept `intent` but draw **no** coloured accent for it. The intent is
exposed on the panel as a data attribute instead:

```html
<div data-intent="warning" …>…</div>
```

Re-introduce a coloured accent in app CSS, a preset, or a custom `header` / `title`
snippet:

```css
[data-intent='warning'] {
  border-top: 3px solid var(--color-warning);
}
```

The prop is unchanged — `intent="warning"` still works; only the default visual is neutral.

---

## 7 · Border tokens: hairline vs. subtle

Two families of border, picked by whether the border reads as **architecture** or as an
**input affordance**:

- **Container surfaces** (Card, Alert, Dialog, Drawer, Popover, Menu, Toast, Sidebar,
  Collapsible, FileUpload, CommandPalette, SidebarLayout, Calendar, …) use
  `border-hairline` — ~8 % alpha in light, 6 % in dark. It auto-upgrades under
  `prefers-contrast: more`.
- **Form primitives** (Input, Select, Combobox, Textarea, Checkbox, RadioGroup) keep
  `border-subtle`. An input's frame is an affordance: it has to be visible enough to read
  as "you can type here".

Override per component via `class` / `slotClasses` when a heavier border is wanted.

Action components are the third case — they source their borders from **Intent** tokens
(`border-neutral` and friends), deliberately darker than surface borders so a button never
reads as a container. That holds where the border is a boundary: the `outlined` variants,
and the divider between the members of a connected `ButtonGroup`. A **filled** surface
takes `border-transparent` instead — there the intent colour is already the fill, and a
border repeating it would only be left behind when hover and press move the fill on. See
[COMPONENT-FAMILIES.md] in the repo for the full family → border-source mapping.

---

## 8 · Table state snippets

The Table's three state snippets are named after the `slotClasses` slots they style, which
frees `loading` and `error` for the state fields they are everywhere else in the library.
Since v8 those two live on the data source rather than on the table itself:

| Snippet | Companion field |
| --- | --- |
| `emptyState` | — |
| `loadingState` | `source.loading?: boolean` |
| `errorState` | `source.error?: string \| null` |

```svelte
<Table {columns} source={{ processing: 'client', items, loading: pending, error: failure }}>
  {#snippet emptyState()}
    <tr><td colspan="99">Nothing here</td></tr>
  {/snippet}
</Table>
```

A managed source (`source={{ processing: 'server', query }}`) owns both states itself and has
no such fields — what used to be a DEV warning is a shape that cannot be written.

---

## Naming history

Several of these values were renamed on the way to v6 so siblings would agree. If you are
reading older code or an older changelog entry:

| Component | Former value | Current | Since |
| --- | --- | --- | --- |
| Alert | `outlined` | `inline` | v5.0 |
| Accordion | `bordered` → `separated` | `card` | v5.0 → v6.30 |
| Card | `filled` | `quiet` | v5.0 |
| Card | `glass` | *removed* — rebuild via `unstyled` | v5.0 |
| Table | `appearance` axis | `variant` axis | v6.32 |
| Table | `empty` / `loading` / `error` snippets | `emptyState` / `loadingState` / `errorState` | v6.41 |
| Toggle / Slider / SegmentGroup | `appearance` axis | `variant` axis | v6.x |

The full v4 → v5 upgrade path is archived in the repository; consumers on v6 need only the
table above.
