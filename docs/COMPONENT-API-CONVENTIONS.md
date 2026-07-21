# Urbicon UI – Component API Conventions

This document defines the API conventions for all Urbicon UI components. Follow these guidelines when creating new components or refactoring existing ones.

## Props Pattern

### `intent` (Color Intent)

Controls the semantic color of a component. Use when a component needs to communicate status, importance, or category through color.

**Standard values:** `primary`, `secondary`, `success`, `warning`, `danger`, `neutral`

**Feedback extension:** Components in the `feedback` category (Alert, Toast) additionally accept `info`. `info` is semantically distinct from `primary` — `primary` is the brand color (which the consumer can rebrand to red/green/violet), `info` is a neutral informational blue that should stay stable. Both are backed by independent token palettes (`--color-primary-*` vs `--color-info-*`) so a brand recolor doesn't accidentally repaint info messages. **Do not** add `info` to action or layout components (Button, Pagination, Toggle, etc.) — `intent="info"` on a button has no semantic meaning.

**Default value convention:**

- Standalone action elements (Button, Avatar): default to `neutral`
- Embedded/decorative elements (Badge, Checkbox, Toggle): default to `primary`
- Overlay containers (Dialog, Drawer): default to `neutral`
- Form elements (Input): default to `default` (no intent coloring)

**Components with intent:** Button, Badge, Checkbox, Toggle, Input, Dialog, Tooltip, Alert (`+info`), Toast (`+info`)

### `variant` (Visual Style)

Controls the visual style/weight of a component independently of color.

**Common values:**

- `filled` – solid background (highest emphasis)
- `outlined` – border only, transparent background
- `ghost` – no border, no background, color only
- `underline` – bottom border only, transparent background (Input only)
- `text` – minimal, text-only (Button only)
- `soft` – subtle background tint (Badge only)

**Default:** `filled` for action elements, `outlined` for form elements, `elevated` for containers.

### `size`

Controls the physical dimensions. All components should follow a consistent scale:

| Size | Height | Font      | Use case          |
| ---- | ------ | --------- | ----------------- |
| `xs` | h-6    | text-xs   | Dense UI, tables  |
| `sm` | h-8    | text-sm   | Secondary actions |
| `md` | h-10   | text-base | Default           |
| `lg` | h-12   | text-lg   | Primary actions   |
| `xl` | h-14   | text-xl   | Hero sections     |

**Default:** `md` for all components.

Most components support a subset of this scale. Current component sizes (from the `size` axis of each `*.variants.ts` — regenerate this table from those files, not from memory):

| Subset         | Sizes                            | Components                                                                              |
| -------------- | -------------------------------- | --------------------------------------------------------------------------------------- |
| Compact        | `sm`, `md`, `lg`                 | Pagination, Popover, Tab, Tooltip, Alert, Breadcrumb, Accordion, Separator, SegmentGroup, Slider, Stepper |
| Standard       | `xs`–`xl`                        | Input, Select, Combobox, Textarea, Spinner, Skeleton                                     |
| Extended-4     | `xs`–`lg`                        | Badge, Checkbox, Toggle, RadioGroup, Progress                                            |
| Button         | `2xs`–`xl`                       | Button                                                                                   |
| Avatar         | `xs`–`2xl`                       | Avatar                                                                                   |
| Overlay panels | `sm`–`xl` + `full`(+`fullscreen`) | Dialog (`fullscreen` too), Drawer                                                        |

Special cases:

- **Menu** has two axes: `size` styles the default trigger button (Button scale, `2xs`–`xl`) and `itemSize` (`sm`–`lg`) styles the list rows independently.
- **ButtonGroup** no longer has a size axis of its own — the grouped Buttons carry their size.
- The **form family** (Input, Select, Combobox, Textarea) deliberately shares the full `xs`–`xl` scale so dense forms can mix controls at any density.

Avoid introducing new size values unless there's a clear use case.

## Discriminated unions for mutually exclusive props

When a variant fundamentally changes which other props are meaningful, split the props type into a discriminated union. Don't paper over the conflict with optional props plus runtime ignoring — that lets `svelte-check` accept `<Badge variant="dot">5 unread</Badge>`, which silently drops the children and looks like a component bug to the consumer.

**Use a discriminated union when:** one prop's value determines that **other props become semantically invalid** (not just unused).

Two vetted vorbilder in the library:

```ts
// Badge — variant='dot' forbids children/counter/removable/interactive
interface BadgeDotProps extends BadgeBaseProps {
  variant: 'dot';
  children?: never;
  counter?: never;
  removable?: never;
  interactive?: never;
  onRemove?: never;
}
interface BadgeStandardProps extends BadgeBaseProps {
  variant?: 'filled' | 'outlined' | 'soft';
  children?: Snippet;
  counter?: boolean;
  removable?: boolean;
  // …
}
export type BadgeProps = BadgeDotProps | BadgeStandardProps;
```

```ts
// Tab — orientation='vertical' forbids fullWidth (vertical triggers are already w-full)
interface TabPropsHorizontal extends TabBaseProps {
  orientation?: 'horizontal';
  fullWidth?: boolean;
}
interface TabPropsVertical extends TabBaseProps {
  orientation: 'vertical';
  fullWidth?: never;
}
export type TabProps = TabPropsHorizontal | TabPropsVertical;
```

Rules:

- **Both arms extend a shared `*BaseProps`** so shared fields stay in one place; only the deciding prop plus the forbidden fields differ.
- The forbidden fields use `?: never`, not `: never` — they remain *optional* (the consumer doesn't have to write them), but passing a value fails type-check.
- The deciding prop in the **non-default** arm is **required** (`variant: 'dot'`, `orientation: 'vertical'`) so the discriminant narrows reliably. The default arm makes it optional (`variant?: 'filled' | ...`).
- The exported `*Props` type is the union (`BadgeDotProps | BadgeStandardProps`). docs-gen and the MCP server pick the discriminated union up automatically — both arms appear in the prop table.
- The JSDoc on the union type lists the discriminant and the trade-off ("variant='dot' forbids children/...") so the API rule is discoverable from autocomplete, not just from this guide.

**Don't reach for this pattern** when a prop is merely unused in some combination (e.g. `intent` has no visual effect on Spinner — Spinner just ignores it). Save discriminated unions for cases where passing the prop would actively mislead.

## Callbacks

### Native DOM Events

Use Svelte 5 lowercase syntax for native DOM events that are forwarded:

```svelte
<Button onclick={handler} />
<Card onclick={handler} />
```

### Custom State Callbacks

Use `on` + PascalCase for callbacks that emit derived/processed state:

```svelte
<Checkbox onCheckedChange={(checked) => ...} />
<Toggle onCheckedChange={(checked) => ...} />
<Select onValueChange={(value) => ...} />
<ButtonGroup onSelectionChange={(selected) => ...} />
<Tab onValueChange={(value) => ...} />
<Pagination onPageChange={(page) => ...} />
<PaginationItem onPageClick={(page) => ...} />
<Accordion onValueChange={(value) => ...} />
<Combobox onValueChange={(value) => ...} />
<Select onOpenChange={(open) => ...} />
```

(Menu is the deliberate exception: its items are *verbs*, so activation is the per-item `onSelect` callback — Menu has no selection state and no `onValueChange`.)

**Parameter convention:** Always pass the new state value, not the raw event.

## Styling

### Design Tokens

Always use semantic tokens over primitive Tailwind classes:

| Instead of                                   | Use                     |
| -------------------------------------------- | ----------------------- |
| `bg-white dark:bg-neutral-900`               | `bg-surface-base`       |
| `bg-white dark:bg-neutral-800`               | `bg-surface-elevated`   |
| `text-neutral-900 dark:text-white`           | `text-text-primary`     |
| `text-neutral-700 dark:text-neutral-300`     | `text-text-secondary`   |
| `text-neutral-500 dark:text-neutral-400`     | `text-text-tertiary`    |
| `border-neutral-200 dark:border-neutral-700` | `border-border-subtle`  |
| `border-neutral-300 dark:border-neutral-600` | `border-border-default` |
| `text-white` (on intent bg)                  | `text-text-on-primary`  |
| `text-neutral-900` (on warning bg)           | `text-text-on-warning`  |

### Z-Index

Always use CSS custom property tokens:

| Layer    | Token                   | Value |
| -------- | ----------------------- | ----- |
| Menu | `z-[var(--z-dropdown)]` | 1150  |
| Overlay  | `z-[var(--z-overlay)]`  | 1300  |
| Dialog   | `z-[var(--z-modal)]`    | 1400  |
| Popover  | `z-[var(--z-popover)]`  | 1500  |
| Tooltip  | `z-[var(--z-tooltip)]`  | 1800  |

### Focus Styles

Always use `focus-visible:` (not `focus:`). This ensures focus rings only show on keyboard navigation, not mouse clicks.

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2
```

### Border Radius

Components map to **tier tokens**, not raw Tailwind sizes. The tier expresses semantics ("this is an action" vs. "this is a container"); the actual pixel value is set in `foundation.css` and can be re-tuned by a brand without touching component code. See [ARCHITECTURE.md §Tier System](ARCHITECTURE.md#tier-system) for the model.

| Family / Element | Tier | Class |
| --- | --- | --- |
| Action — Button, Menu, ButtonGroup, Toolbar, Toggle | commit | `rounded-commit` |
| Form — Input, Select, Checkbox, Combobox, Textarea, RadioGroup, Slider | modify | `rounded-modify` |
| Container — Card, Dialog, Drawer, Popover, Accordion, Collapsible | contain | `rounded-contain` |
| Navigation — SegmentGroup, Stepper, Tab | tier-aware (commit or modify per component) | `rounded-{tier}` |
| Menu panel (adjacency case) | bridge | `rounded-bridge` |
| Avatar.circle, Toggle thumb dot, status indicators | shape | `rounded-full` |
| Feedback — Toast, Spinner, Progress, Skeleton, Badge | fixed per component | (per-component) |

Tier-aware components honour a wrapping `<TierContext>` — a `<Toolbar tier="modify">` pulls its tier-aware children to `rounded-modify`. The per-instance `tier` prop overrides context.

## Bindable State Props

Props that represent user-controlled state support two-way binding via `bind:`. The corresponding custom callback fires after the state changes:

```svelte
<Checkbox bind:checked onCheckedChange={(val) => log(val)} />
<Select bind:value onValueChange={(val) => log(val)} />
<Menu bind:open onOpenChange={(open) => log(open)} />
<ButtonGroup bind:value onSelectionChange={(val, all) => log(val, all)} />
```

When a prop has a visual-only intermediate state, that state is also bindable:

```svelte
<Checkbox bind:checked bind:indeterminate />
```

### Open-state vocabulary (overlays & disclosures)

The canonical pair is **`open` (bindable) + `onOpenChange(open: boolean)`** — used by Menu, Select, Combobox, Popover, Tooltip, Collapsible, and Sidebar. `onOpenChange` fires on user-interaction-driven transitions (trigger click, keyboard, selection, Escape, outside click), **not** when the consumer writes `bind:open` directly — the consumer already knows about their own writes.

**Optimistic transitions — the controlled contract:** every member applies an interaction-driven transition by writing the bindable `open` *before* firing `onOpenChange`; the component never waits for consumer approval. With `bind:open` that write is what propagates the change, so accepted transitions need no handler at all, and a veto is still possible by writing the previous value back inside `onOpenChange` (synchronous, no paint in between). A consumer that passes `open={value}` **without** `bind:` must mirror every `onOpenChange` into its state — nothing re-syncs an ignored change, so the component and the consumer's source of truth silently diverge. This is by design, not detectable: Svelte cannot distinguish `open={x}` from `bind:open={x}` at runtime, and from inside the component a rejected unbound transition is indistinguishable from an accepted bound one. To conditionally reject transitions from plain controlled state, own the transition instead: keep `open` driven by your source of truth and attach your own handler to the trigger rather than calling the provided `toggle` — AccordionItem's `collapsible=false` handling (custom `trigger` snippet calling `ctx.toggle`) is the in-repo reference.

**Deliberate deviation:** Dialog, Drawer, and ConfirmDialog expose `onClose` instead of `onOpenChange`. These components have no internal "open" path — opening happens exclusively through the consumer setting `open = true` — so an `onOpenChange` could only ever report `false`. `onClose` names the single transition they own. Do not "fix" this by adding `onOpenChange` to them; a change-callback that can never fire for half its domain is more misleading than an asymmetric name.

The granular dismiss-path callbacks (`onEscape`, `onClickOutside`) remain separate where offered (Select, Combobox, Popover): they identify *why* the overlay closed, while `onOpenChange` reports *that* it opened or closed.

## `data-state` Attribute

Interactive components with distinct visual states expose a `data-state` attribute on their key element. This enables CSS-only custom styling in `unstyled` mode. ~14 primitives expose it (Toggle, Tab, Drawer, Collapsible, RadioGroup, SegmentGroup, Sidebar, …) — the table below is illustrative, not exhaustive:

| Component | Element | Values                                  |
| --------- | ------- | --------------------------------------- |
| Checkbox  | box     | `checked`, `unchecked`, `indeterminate` |
| Dialog    | dialog  | `open`, `closed`                        |

Use `data-[state=checked]:` in `slotClasses` or consumer CSS to style based on state.

## `interactive` Prop Pattern

Components that can be interactive (Badge, Avatar, Card) use an explicit `interactive` boolean. It is also auto-enabled when an `onclick` handler is provided:

```typescript
let { interactive = false, onclick, ...rest }: BadgeProps = $props();
const isInteractive = $derived(interactive || !!onclick);
```

This allows hover/focus/cursor styles to be enabled without requiring a click handler (e.g. for drag targets).

## `slotClasses`

Per-slot class overrides typed as `Partial<Record<XSlots, string>>`, where the key union is **derived from the component's `tv()` slots** — never a hand-maintained literal union (which silently drifts when a slot is added or renamed). The `*.variants.ts` exports the slot-name type alongside its `VariantProps`:

```typescript
// x.variants.ts
import { tv, type SlotNames, type VariantProps } from '$lib/utils/variants';

export const xVariants = tv({ slots: { wrapper: [...], base: [...], icon: [...], message: [...] }, ... });

export type XVariants = VariantProps<typeof xVariants>;
export type XSlots = SlotNames<typeof xVariants>; // 'wrapper' | 'base' | 'icon' | 'message'

// index.ts
slotClasses?: Partial<Record<XSlots, string>>;
```

`SlotNames<T>` (in `$lib/utils/variants`) is the companion to `VariantProps<T>` — it reads `keyof ReturnType<T>` off the slotted `tv()` function, so the one source of truth (the `tv({ slots })` config) drives both the runtime classes and the prop type. Consumers get autocomplete on the real slot names and a type error on typos.

Two components have no `tv()` config to derive from and therefore carry a **hand-maintained literal union** by necessity: `FormField` (a bare layout wrapper) types its `slotClasses` keys inline, and `ConfirmDialog` (a pre-configured Dialog) forwards `unstyled`/`slotClasses`/`preset` verbatim to the inner Dialog — its presets are registered under the `Dialog` key, not a separate `ConfirmDialog` one.

When `unstyled` is `false`, `slotClasses` values are merged with the default tv() classes; when `unstyled` is `true`, they replace them entirely. Components resolve the value through `resolveSlotClasses(blocksConfig, 'Name', preset, variantProps, slotClassesProp)`, which composes the full cascade (weakest → strongest):

`defaults.slotClasses → defaults.overrides[match] → preset.slotClasses → preset.overrides[match] → instance.slotClasses → class`

Conflicts are resolved per Tailwind bucket (the later source wins for a given property; non-conflicting classes accumulate) — so an instance `rounded-none` deterministically defeats a provider-default `rounded-full` instead of leaving the winner to stylesheet order.

For **project-wide** overrides, register them on `BlocksProvider` rather than repeating `slotClasses` at each call site: `defaults` (unconditional, every instance), `presets` (opt-in, named), or `overrides` (prop-conditional — e.g. only `variant="outlined"`). See [ARCHITECTURE.md → Preset System](./ARCHITECTURE.md#preset-system-since-v080).

To restyle an embedded component (e.g. make an Input look borderless inside a custom container), override the visual boundary slot:

```svelte
<Input slotClasses={{ base: 'border-0 bg-transparent focus-visible:ring-0' }} />
```

### `class` only hits the root slot

The `class` prop reaches the **outermost (root) slot only**; inner elements are reachable solely through `slotClasses.<slot>`. By convention `base` is the interactive core element — but for wrapper components the root slot is **not** `base`. On `Input` the root is `wrapper` (the label + field column) and `base` is the actual `<input>`, so `<Input class="rounded-full" />` rounds the column, not the field; the field needs `<Input slotClasses={{ base: 'rounded-full' }} />`. (Same story for any multi-slot component — see the [Customization → class Root-Slot Trap](../apps/docs/src/routes/customization/+page.svelte) page.)

### The override ladder

Reach for the lowest rung that solves the problem — lower rungs preserve more of the system's behavior (dark mode, hover/active cascade, focus rings):

1. **`class`** — restyle one element (the root slot) on one instance.
2. **`slotClasses.<slot>`** — restyle an inner element on one instance.
3. **`preset` / `BlocksProvider` defaults** — app-wide look for a component type.
4. **`overrides`** — style only one variant / intent / state (prop-conditional — what unconditional `slotClasses` cannot express).
5. **`unstyled` + `slotClasses`** — strip every default and rebuild the look.

The implementation hinge is one type-annotated `variantProps` derived in `ComponentName.svelte` (`const variantProps: XVariants = $derived({ … })`). It feeds both `styles = xVariants(variantProps)` and the `activeProps` argument of `resolveSlotClasses`, so the `tv()` output and the prop-conditional `overrides` always match against the same set of active variants. The annotation is mandatory — without it the string-literal ternaries widen to `string` and silently stop matching the variant keys.

## Polymorphic Elements (Link-Buttons, Anchor-as-Card, etc.)

Primitives never accept an `href` / `as` / `component` prop to swap their root element. A `Button` always renders `<button>`, a `Card` always renders `<div>`. The library does not own the choice between `<button>` and `<a>` — that decision depends on app-routing concerns (SvelteKit `resolve()`, external vs. internal URLs, `target`/`rel` policies) that the library cannot see.

When you need a Link-Button, write a thin wrapper in your app and reuse the exported variant function:

```svelte
<!-- LinkButton.svelte (in your app) -->
<script lang="ts">
  import { buttonVariants, type ButtonProps } from '@urbicon-ui/blocks';
  import type { HTMLAnchorAttributes } from 'svelte/elements';

  let {
    href,
    intent = 'neutral',
    variant = 'filled',
    size = 'md',
    class: className,
    children,
    ...rest
  }: HTMLAnchorAttributes & Pick<ButtonProps, 'intent' | 'variant' | 'size' | 'class'> = $props();
</script>

<a {href} class={buttonVariants({ intent, variant, size }).base({ class: className })} {...rest}>
  {@render children?.()}
</a>
```

This pattern keeps primitives narrow, leaves `resolve()` decisions in app code, and avoids forcing a polymorphic type that splits between `HTMLButtonAttributes` and `HTMLAnchorAttributes`. Apply the same approach if you ever need an anchor styled like a Card or a Badge — call the corresponding `*Variants()` directly.

## Snippet vs. Component Cell Rendering

Components that accept per-row content (most prominently `Table` via `column.cell`) expose two rendering hooks:

- **Snippet (`column.cell`)** — concise, defined inline in the consumer's `.svelte` template. Best for one-off cells that read a couple of fields.
- **Component (`column.component` + `column.componentProps`)** — pulls a typed Svelte component out into its own file. Best when the cell has more than ~10 lines of logic, gets reused across tables, or needs its own tests.

Prefer the **component** form when:

- The cell is non-trivial (state, effects, lifecycle, deeper trees).
- You hit `eslint-plugin-svelte` parser bugs on snippet type annotations like `{#snippet name(item: T, _value: unknown)}` (this is a known plugin issue at the time of writing; `svelte-check` accepts the syntax). Component cells sidestep the snippet-arg parser entirely.
- You want full TypeScript inference on the cell's `Item` generic without leaning on `T`-typed snippet arguments.

Each cell component should accept `item: Item` plus any extra props passed through `componentProps`, and stay agnostic of the table's surrounding context.

## `tier` Prop (Action / Form / Navigation / Container families)

Tier-aware primitives accept an optional `tier` prop that selects the radius semantics of the component. The value comes from the wrapping `<TierContext>` by default; the prop overrides it.

```svelte
<!-- Default: Button is commit-tier (pill) -->
<Button>Save</Button>

<!-- Per-instance override -->
<Button tier="modify">Inline action in a form</Button>

<!-- Context cascade — all tier-aware children pick up modify -->
<Toolbar tier="modify">
  <Button>Bold</Button>
  <Toggle />
  <Checkbox label="Wrap" />
</Toolbar>
```

**Default-Tier by family:** Action `commit` · Form `modify` · Navigation per component (SegmentGroup `commit`, Tab `modify`, Stepper `commit`) · Container `contain`. Full table in [ARCHITECTURE.md §Tier System](ARCHITECTURE.md#tier-system).

**Standard implementation pattern** (in `ComponentName.svelte`):

```ts
import { getTierContext } from '$lib/utils';

const tierCtx = getTierContext();
const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'commit'); // family default
```

Feedback / Ambient components (Toast, Spinner, Progress, Skeleton) and Identity (Avatar) do **not** take a `tier` prop — they have fixed geometry by design (see [COMPONENT-FAMILIES.md](COMPONENT-FAMILIES.md)). Badge is the lone Feedback exception (Badge inside a `<Toolbar tier="modify">` does want to flatten), but the family-level rule remains: Feedback geometry is per-component.

## Docs Theme Hooks

`packages/docs` components carry `data-docs-*` attributes so that an opt-in docs theme (currently the Color Rooms theme in `apps/docs/`) can paint, flatten, or hide chrome without forking the components. The namespace is the package's **published theming contract**: themes target these attributes only (never internal class names, and never test ids — hooks that exist for styling are named as such), and renaming one is a breaking change for downstream skins:

| Hook | Attached to | Docs-scope behaviour |
| --- | --- | --- |
| `data-docs-header` | `DocsLayout` hero header (full-width band, direct child of the layout container) | Becomes the room colour field in `.docs-rooms`; spans everything right of the app sidebar, TOC drops below it |
| `data-docs-sticky-bar` | `DocsLayout` sticky breadcrumb strip | Shares the header's accent fill; on scroll the title collapses under it, leaving a low breadcrumb-height ribbon in the room colour |
| `data-docs-sticky-hairline` | expanding hairline inside the sticky strip | `display: none` in `.docs-rooms` (the colour edge is the separator; kept for the bare library skin) |
| `data-docs-scrollspy` | active-section badge in the sticky strip | Flips to a translucent-foreground inlay so it reads on the accent strip |
| `data-docs-stage="example|playground"` | `CodeExample` and `PlaygroundConfigurator` outer wrappers | Background flattens to transparent in `.docs-rooms` |
| `data-docs-stage-frame` | Inner preview frame (Code / Playground) | Same — flattens against cream paper |
| `data-docs-subtitle` | `description` paragraph in `DocsLayout` | `display: none` in the docs scope (field is title-first) |
| `data-room-hero` | hand-rolled section-landing heroes | Full-width colour-field band flush to the app sidebar (the page nests an inner `max-w` wrapper for alignment); `data-room-chip` flips a room-tinted chip to read on the fill |

Consumers writing their own theme can hook the same attributes. The library defaults remain unchanged. See [ARCHITECTURE.md §Color Rooms Theme](ARCHITECTURE.md#color-rooms-theme-docs-only) for the full theme architecture.

## Common Props

All visible components should support:

- `class` – for external class overrides (via `let { class: className } = $props()`)
- `unstyled` – boolean to strip all default styles
- `disabled` – boolean where applicable
- `...restProps` – spread remaining props to root element

### `restProps` ordering: the component's own attributes win

Spread `{...restProps}` **first**, then the component's computed attributes. A
later spread wins in Svelte, so the reverse order lets a consumer silently
defeat state the component owns — `aria-invalid="false"` passed through
restProps would cancel a real `error`, and a stray `tabindex` would break a
roving group. Spreading first keeps restProps to its purpose: native and
`data-*` attributes the component doesn't model.

Two attributes are **merged** instead, because a consumer's value there is
supplemental rather than competing — destructure them out of restProps and
combine explicitly:

- `aria-describedby` – append the consumer's id to the internal error/helper
  chain: **internal ids first, consumer id last**, so an external hint adds to
  the description instead of replacing it. Reference: `Input.svelte`
  (`describedBy`), mirrored across Textarea/Checkbox/Toggle/RadioGroup and
  guarded by DOM tests in each.

The overlay family (Dialog/Drawer/ConfirmDialog) follows this since the
2026-07-14 quality wave: restProps spreads first, and the dismiss/focus
handlers survive a consumer's own `onclick`/`onkeydown` via `composeHandlers`
(both run — the consumer's handler supplements instead of replacing).
Reference: `Dialog.svelte`.

Known non-follower: `Button` still spreads restProps **last** (after its
computed `role`/`aria-checked`/`data-value`/`aria-pressed`). A naive reorder
would clobber legitimate standalone uses (an explicit `role={undefined}`
after the spread *removes* a consumer's `role="link"`), so the migration
needs conditional merges — tracked in
[technical-debt.md](technical-debt.md).

## Accessibility

- All interactive elements must have `focus-visible` styles
- Form elements need `aria-describedby` linking to error/helper messages
- Dialog must implement focus trap
- Use `role`, `aria-label`, `aria-expanded` where semantically appropriate
- Set `aria-invalid` only when there is an actual error – not as `aria-invalid="false"`
- For hidden native inputs (Checkbox, Toggle), use `peer` on the input and `peer-focus-visible:` on the visible element to relay the focus ring
- Compound components: use correct ARIA roles (`radiogroup`/`radio` for single-select, `group`/`checkbox` for multi-select)
