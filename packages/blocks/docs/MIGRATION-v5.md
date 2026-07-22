# Migration Guide: v4 → v5

The v5.0.0 release ("Lighter design refactor") introduces a quieter visual
language across the library: hairline borders, surface-tinted in-page zones,
fewer chrome layers. Most consumer code is unaffected — the renames listed
below are the only typed-API breakages.

> Released `2026-05-21` as commit `8ac07ca` (`feat!`). All four breaking
> blocks below were declared in the commit's `BREAKING CHANGE:` footers but
> are surfaced here because git-cliff's default template renders only the
> commit subject in the CHANGELOG.

## 1. Card variants

| Before              | After                | Notes                                         |
| ------------------- | -------------------- | --------------------------------------------- |
| `variant="elevated"` (default) | `variant="quiet"` (default) | New default — surface-quiet tint, no shadow   |
| `variant="filled"`  | _removed_            | Replaced by `quiet`                           |
| `variant="glass"`   | _removed_            | No drop-in replacement; build with `unstyled` |
| `variant="outlined"` | _unchanged_         | —                                             |
| `variant="elevated"` | _unchanged_         | Still available, no longer the default        |
| —                   | `variant="floating"` | New — popover-family weight (shadow-lg)       |

The `dividers` prop now defaults to **false** (was implicit `true` via
header/footer borders). Set `dividers={true}` to restore traditional
card-with-header look.

```svelte
<!-- v4 -->
<Card variant="elevated">…</Card>
<!-- v5 — keeps the elevated look explicitly -->
<Card variant="elevated">…</Card>
<!-- v5 — pick up the new default, no shadow -->
<Card>…</Card>
```

## 2. Alert + Accordion variant renames

| Component   | Before                | After                  |
| ----------- | --------------------- | ---------------------- |
| `Alert`     | `variant="outlined"`  | `variant="inline"`     |
| `Accordion` | `variant="bordered"`  | `variant="card"`       |

`Alert.inline` is a memo-style with a left accent border (`border-l-2`),
no surrounding box. `Accordion.card` renders items as a stacked
card list with `surface-quiet` tint and `space-y-2`. (The value was named
`separated` from v5.0 to v6.30; it now shares the `card` vocabulary with
its disclosure sibling `Collapsible`.)

```svelte
<!-- v4 -->
<Alert variant="outlined" intent="warning">…</Alert>
<Accordion variant="bordered">…</Accordion>
<!-- current -->
<Alert variant="inline" intent="warning">…</Alert>
<Accordion variant="card">…</Accordion>
```

## 3. Table chrome

The Table no longer renders a frame by default. The new `appearance` prop
controls the container chrome:

| `appearance` | Effect                                                       |
| ------------ | ------------------------------------------------------------ |
| `flush` (default) | No frame; the table sits inline in the reading flow.    |
| `surface`    | Quiet tinted zone — `bg-surface-quiet`.                      |
| `framed`     | Border + `rounded-contain` + shadow — closest to v4 default. |

The dead `tableVariants` export is removed (was unused in any consumer).

```svelte
<!-- v4 — implicit frame -->
<Table data={rows} columns={cols} />
<!-- v5 — explicit equivalent -->
<Table data={rows} columns={cols} appearance="framed" />
<!-- v5 — new editorial default -->
<Table data={rows} columns={cols} />
```

## 4. Dialog + Drawer intent

Dialog and Drawer no longer draw a coloured `border-t-[3px]` accent for
non-neutral intents. Intent is exposed on the panel as a data attribute:

```html
<div data-intent="warning" …>…</div>
```

Consumers can re-introduce a coloured accent via CSS, a preset, or a
custom snippet on `header`/`title`:

```css
[data-intent='warning'] {
  border-top: 3px solid var(--color-warning);
}
```

No prop renames — `intent="warning"` still works; only the default visual
changed.

## Container-component border tokens

Many container surfaces (Card, Alert, Dialog, Drawer, Popover, Menu, Toast,
Sidebar, Collapsible, FileUpload, Sankey, CompositionBar, CommandPalette,
SidebarLayout, Calendar) migrated from `border-subtle` to
`border-hairline` (~8 % alpha at light, 6 % at dark). Form primitives
(Input, Select, Combobox, Textarea, Checkbox, RadioGroup) kept
`border-subtle` as an input affordance — consumers see no API change but
the visual difference is real. Override per-component via `class` /
`slotClasses` if a heavier border is desired.

## New tokens consumers can use directly

- `bg-surface-quiet` — softly tinted in-page zone (was `bg-surface-subtle`-equivalent)
- `border-hairline` — container divider (auto-upgrades under
  `prefers-contrast: more`)

Both are exposed as semantic Tailwind utilities and via CSS custom
properties (`--color-surface-quiet`, `--color-border-hairline`).
