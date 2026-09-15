# Urbicon UI – Component API Conventions

This document defines the API conventions for all Urbicon UI components. Follow these guidelines when creating new components or refactoring existing ones.

**How to read it.** A rule without a marker describes behaviour that ships today. A rule that runs ahead of its implementation carries a blockquote marker — `> **Decided <date>, pending #N** — …` — and the prose around it keeps describing the current behaviour as current; the marker names what is to replace it.

This file owns the **API surface**: which props a component offers, what they are called and what they are typed as. The mechanisms behind them are documented once elsewhere and linked from here — the styling props in [ARCHITECTURE.md § The override cascade](ARCHITECTURE.md#the-override-cascade), the tier model in [§ The tier system](ARCHITECTURE.md#the-tier-system), and what each `variant` value means across the library in [VARIANT-CONTRACT.md](../packages/blocks/docs/VARIANT-CONTRACT.md).

## Props Pattern

### `intent` (Color Intent)

Controls the semantic color of a component. Use when a component needs to communicate status, importance, or category through color.

**Standard values:** `primary`, `secondary`, `success`, `warning`, `danger`, `neutral`

**Feedback extension (`+info`, `−secondary`):** Components in the `feedback` category (Alert, Toast) swap one value for another. They **add** `info`: semantically distinct from `primary`, because `primary` is the brand color (which the consumer can rebrand to red/green/violet) while `info` is a neutral informational blue that stays stable — independent token palettes (`--color-primary-*` vs `--color-info-*`) keep a brand recolor from repainting info messages. And they **drop** `secondary`: a violet alert or toast names no status, so the value would be decoration on a component whose whole axis means "what kind of message is this".

**Do not** add `info` outside feedback — `intent="info"` on a button, a tooltip or a form field has no semantic meaning. (Tooltip carried `info` until v6.42; it resolved one hue step from `primary` and implied a distinction it could not show.)

**Form fields carry a narrower axis:** `default | success | warning | danger` — the *tone of the field frame*, not a category. There is no `primary`/`secondary`/`neutral` field: a text input has no brand state. See §Form validation below for how `intent` and `error` divide the work.

**Default value convention:**

- Standalone action elements (Button, Avatar): default to `neutral`
- Embedded/decorative elements (Badge, Checkbox, Toggle): default to `primary`
- Overlay containers (Dialog, Drawer): default to `neutral`
- Form elements (Input): default to `default` (no intent coloring)

**Components with intent:**

| Palette | Values | Components |
| --- | --- | --- |
| Standard | `primary` `secondary` `success` `warning` `danger` `neutral` | Button, Badge, Avatar, Checkbox, Toggle, RadioGroup, Slider, Progress, Dialog, Drawer, Tooltip, ButtonGroup, Pagination, Menu, ConfirmDialog, CopyButton, CompositionBar, Sankey |
| Feedback (`+info`, `−secondary`) | `primary` `info` `success` `warning` `danger` `neutral` | Alert, Toast |
| Form field tone | `default` `success` `warning` `danger` | Input, Textarea, PinInput, TimeInput (and CurrencyInput/NumberInput by inheritance) |
| Component-specific | see the component | Spinner (`+current`, follows `currentColor`), FileUpload (`primary`/`neutral` only) |

Components with **no** intent axis: Select, Combobox, DatePicker, FormField, SegmentGroup, Accordion, Card, Popover, Tab, Stepper — they carry no colour category of their own. (The first four still take `error`/`helper`; see §Form validation.)

### `variant` (Visual Style)

Controls the visual style/weight of a component independently of color.

**The style axis is always named `variant` — never `appearance`, `look`, or `style`.** A
"`variant` = visual weight (filled/outlined/ghost), `appearance` = structural build" split
proved not separable in practice (Tab's `line|pills|enclosed|solid` is structural and always
ran under `variant`), so structural builds are `variant` values too: Toggle `default|dot`,
Slider `default|rail`, SegmentGroup `default|text` — all three renamed from `appearance` in
the pre-launch window, and Table's chrome axis (`flush|surface|framed`) completed the sweep
in the same window. One axis name, whatever the values express.

**Siblings share value vocabulary.** Components covering the same interaction reuse the same
value for the same visual treatment: the boxed disclosure treatment is `card` on both
Accordion and Collapsible (Accordion's former `separated` was renamed). When adding a variant
to a component with a sibling, check the sibling's values first.

**Common values** — one line each. What a value **means**, which components carry it and why, is [VARIANT-CONTRACT.md](../packages/blocks/docs/VARIANT-CONTRACT.md) — the field vocabulary in [§ 9](../packages/blocks/docs/VARIANT-CONTRACT.md#9--form-fields):

- `filled` – solid background (highest emphasis)
- `outlined` – border only, transparent background
- `ghost` – transparent **at rest**: border and background are transparent, not absent, and a field's focus reveals its frame. Not the same as `bare`
- `underline` – bottom border only, transparent background (Input, Textarea, Select, Combobox)
- `bare` – no frame, no fill, no padding, no fixed height, no radius; `size` keeps only the type step, and the focus indicator is the one thing it will not give up
- `text` – minimal, text-only (Button, SegmentGroup)
- `soft` – subtle background tint (Badge, and the default on Alert)
- `card` – boxed card treatment (Accordion, Collapsible)

**Defaults:** `filled` for action elements, `outlined` for form fields. Containers set theirs per component rather than by family — `Card` defaults `quiet`, `Alert` `soft`, `Accordion` and `Collapsible` `default`, and `Dialog`, `Drawer` and `Popover` carry no `variant` axis at all.

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

One documented deviation: the text fields **Input, Select and Combobox use `h-7` at `xs`**, not `h-6`. Every other step on those components matches the table.

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

## Form validation (`error`, `helper`, `intent`)

Three props, three jobs — they do not overlap, and their precedence is a rule, not an accident of declaration order.

| Prop | Type | Job |
| --- | --- | --- |
| `error` | `string` | The failure message **and** the invalid state. Non-empty ⇒ the field frame turns danger, the message renders in the error tone with `role="alert"`, and `aria-invalid` is set. |
| `helper` | `string` | Guidance while the field is valid. **Displaced** by `error` — they never render together. |
| `intent` | `default \| success \| warning \| danger` | The *tone* of the frame while the field is valid: a positive confirmation, a soft warning. Only on the input-shaped fields (Input, Textarea, PinInput, TimeInput); Select and Combobox have no intent axis. |

**`error` beats `intent`, structurally.** Both paint the same buckets (border colour, focused border + ring), so only one can win. Wherever a field has *both* axes — Input, Textarea, PinInput, TimeInput — the error frame is emitted from the **compound stage** of the `tv()` config, which the engine folds after every axis, not from the `error` axis, whose win would depend on being declared after `intent`. Reordering axes, or slipping a new one in between, can no longer turn validation feedback back into a green frame. Fields without an intent axis (Select, Combobox) keep the frame on the `error` axis, where nothing competes for the bucket — with a comment requiring the move if an intent axis is ever added. `internal/field-chrome.ts` carries the contract.

**Do not** introduce a second *public* way to say "invalid" on a field: no `invalid` boolean beside `error`, no validation-`status` prop, no intent value that means failure on its own. A field is invalid exactly when it has an `error` string. (Internal tv() flags of the same name are fine — they are what the string feeds; and `status` is a legitimate prop name elsewhere, e.g. Avatar's presence dot or a table cell's state.)

**Field frames come from `internal/field-chrome.ts`** (`fieldErrorFrame`, `fieldIntentFrames`, `fieldFocusRing`, `FIELD_MESSAGE_TONES`, …) — Input, Textarea, Select, Combobox, PinInput and TimeInput all consume it. Hand-inlining the same strings is how the family drifted apart before: Select's error frame and Combobox's message tones had been re-derived by hand, and Combobox had no visual error state at all until v6.42.

**Non-field controls** (Checkbox, RadioGroup, Toggle, Slider) take `error` as a message too, but tint only the message, not a frame — they have no frame to tint. Their `intent` is the standard six-value palette (the control's colour), not a validation tone. `aria-invalid` and the `role="alert"` message still follow `error`, exactly as on the fields.

**The required marker is a slot, not a prop.** The nine components [VARIANT-CONTRACT § The required marker](../packages/blocks/docs/VARIANT-CONTRACT.md#the-required-marker) lists draw the same `aria-hidden` `<span>` on a `requiredMark` slot — that section carries the roster, the build and the reasoning; `Toggle` takes `required` and draws none. The API rule that follows: there is **no `requiredIndicator` prop**. Being a slot puts the marker on the override ladder, which covers "asterisk", "none" and — as a content class — a wording such as "(required)". Marking the **optional** fields instead is the one mode the slot cannot express, because the span renders only under `required` (#395 records why).

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

(Menu is the deliberate exception: its items are *verbs*, so activation is the per-item `onSelect` callback and there is no `onValueChange` — an item's `checked` shows a setting as `menuitemradio`, but that state stays consumer-owned; Menu displays it and never stores a selection.)

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
| `text-white` (on any solid intent fill)      | `text-text-on-fill`     |
| `text-white` (on the primary fill only)      | `text-text-on-primary`  |
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

That is the house ring for action, navigation and container surfaces. **Form fields do not write it by hand** — they take theirs from `internal/field-chrome.ts`, which is a 2px ring at 20 % alpha in the field's own tone (`ring-primary/20`, `ring-danger/20`, …) and no offset. Reach for the constant, not for the snippet, on anything with a field frame.

### Border Radius

**Never write a raw Tailwind radius.** A component's radius comes from a tier token — `rounded-commit`, `rounded-modify`, `rounded-contain`, `rounded-bridge` — so a brand can re-tune the pixel value in `foundation.css` without touching component code. `rounded-full` is the one raw exception, for shapes that are circles by definition (Avatar's `circle`, Toggle's thumb, status dots), and `--radius-control` carries the radio indicator.

Which tier a given component belongs on, and whether it reads the tier context or is pinned, is [ARCHITECTURE.md § The tier system](ARCHITECTURE.md#the-tier-system) — a `rounded-xl` on an individual component is the anti-pattern that section exists to prevent.

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

**Deliberate deviation:** Dialog and Drawer expose `onClose` instead of `onOpenChange`. These components have no internal "open" path — opening happens exclusively through the consumer setting `open = true` — so an `onOpenChange` could only ever report `false`. `onClose` names the single transition they own. Do not "fix" this by adding `onOpenChange` to them; a change-callback that can never fire for half its domain is more misleading than an asymmetric name. `ConfirmDialog` takes the same shape one step further: it has no `onClose` of its own either, because its two exits are already named — `onConfirm` (which may be `async`, with a rejection going to `onError`) and `onCancel`, which is what it hands the inner Dialog as `onClose`.

The granular dismiss-path callbacks (`onEscape`, `onClickOutside`) remain separate where offered (Select, Combobox, Popover): they identify *why* the overlay closed, while `onOpenChange` reports *that* it opened or closed.

## `data-state` Attribute

Interactive components with distinct visual states expose a `data-state` attribute on their key element. This enables CSS-only custom styling in `unstyled` mode. ~14 primitives expose it (Toggle, Tab, Drawer, Collapsible, RadioGroup, SegmentGroup, Sidebar, …) — the table below is illustrative, not exhaustive:

| Component | Element | Values                                  |
| --------- | ------- | --------------------------------------- |
| Checkbox  | box     | `checked`, `unchecked`, `indeterminate` |
| Dialog    | dialog  | `open`, `closed`                        |

Use `data-[state=checked]:` in `slotClasses` or consumer CSS to style based on state.

## The "make it operable" boolean

A component that **can** be operable but need not be exposes one boolean for it. It resolves into two separate derivations, and keeping them separate is the whole point:

```typescript
// Badge.svelte — the look
const isInteractive = $derived(purpose === 'chip' || interactive || !!onclick);
// …and, independently, the semantics
const isActivatable = $derived(!!onclick && !disabled);
```

**The boolean buys the look, not the semantics.** `interactive` (and `purpose="chip"`) turn on the interactive **appearance** — pointer cursor, hover scale, mint — so a drag target or a decorative chip can read as touchable without a handler. They hand out **no** `role="button"` and **no** tab stop. Only a real activation path does that: on `Badge`, `role="button"` and `tabindex={0}` follow `onclick && !disabled`, because a focus stop on which every key is dead helps nobody (#201). A disabled badge is inert and never a button.

**The prop name does not tell you which element you get.** Three components carry this pattern, with three answers — and only one of them swaps its root:

- **`Badge`** — `interactive` only. Stays a `<span>`; gains the button role and a tab stop when activatable, per above.
- **`Avatar`** — carries **both** `interactive` and `clickable`, as aliases: they fold together with `onclick` into one `isInteractive`. It stays a `<div>` that takes `role="button"` + `tabindex={0}` when interactive, and never renders a `<button>`.
- **`Card`** — `clickable` is the public prop and the one that genuinely changes the element: `<a>` with `href`, `<button>` under `clickable` or `onclick`, `<div>` otherwise. Card's `interactive` is an internal `tv()` axis those three resolve to — addressable (`overrides: [{ interactive: true, … }]`) and deliberately **not** settable, because a card made to look operable without being operable is the WCAG 3.2 failure the split exists to prevent.

For anything new, prefer a native `<button>` root to `role="button"` on a `<div>`. The two above predate that preference and keep it for their own reasons: an Avatar is an image first, a Badge is text in a flow.

## Styling props (`class`, `unstyled`, `slotClasses`, `preset`)

> **Canon.** The prop surface — which props a component ships, how each is typed, which
> element each reaches — is described once, here. The mechanism they drive is
> [ARCHITECTURE.md § The override cascade](ARCHITECTURE.md#the-override-cascade); other docs
> link to one of the two rather than restating either.

Every visible component ships all four. What they **do** — the order they fold in, what `overrides` match against, how `unstyled` propagates, how a wrapper and a compound part are addressed — is [ARCHITECTURE.md § The override cascade](ARCHITECTURE.md#the-override-cascade). This section is the surface: how each is typed, and which element each reaches.

### `slotClasses`

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

No component lacks a `tv()` config to derive from, and a hand-written slot name survives in three shapes, each for a reason `SlotNames` cannot cover.

- **A union written out whole**, where there is nothing to read the names off: `Separator` and `Popover` resolve through the **no-slot** `tv()` overload, which returns a string rather than a slot map; and `CalendarHeader` deliberately narrows Calendar's union to the seven keys its own element tree carries.
- **A derived union extended by hand**, where the extra key addresses a *nested* component instead of a slot of this config: `Guide`'s `skip` / `prev` / `next` become the `class` on the footer's `<Button>`s.
- **A slot name in filter position** — `Exclude<XSlots, 'base'>` where a compound part does not own one slot of a shared config, `Extract<XSlots, …>` where it owns only some. The set is every `Exclude<`/`Extract<` over a `*Slots` type in a `slotClasses` **prop** — six components today; `AccordionContext.slotClasses` reads the same way and is a context field, not a prop.

The third shape fails the most quietly, which is worth knowing before reaching for it: a filter name that matches nothing silently **widens** the prop by a slot under `Exclude`, and silently collapses it to `never` under `Extract` — measured, both leave `bun run check` at 0 errors. Exactly one such typo is caught today, and by accident rather than by design: a `@ts-expect-error` in `provider/component-slots.types.test.ts` asserts that `SegmentGroup` has no `item`, so breaking that one name surfaces as an *unused directive* somewhere else entirely.

Where a component forwards slot classes to one it embeds, `SidebarLayout` is the shape to copy rather than any of the three: its union is `` `sidebar${Capitalize<SidebarSlots>}` `` and the runtime map walks the same config, so neither the slot names nor the prefix is written twice, and `SidebarLayout.svelte.test.ts` asserts that each key reaches the slot it names — identified by the classes Sidebar's own config paints there, because a crossed pair keeps every marker landing on a distinct element and passes a check that asks only whether it landed. `ConfirmDialog` is in neither shape: it reuses `DialogSlots` outright.

Values merge with the tv() defaults when `unstyled` is `false` and replace them when it is `true`. They sit second-from-last in one chain, conflict-resolved per Tailwind bucket with the later source winning: `defaults.slotClasses → defaults.overrides[match] → preset.slotClasses → preset.overrides[match] → instance slotClasses → instance class`. Everything about that chain — why a wrapper such as `NumberInput` carries two provider names at once, and how to write your own wrapper that resolves it — is [ARCHITECTURE.md § The override cascade](ARCHITECTURE.md#the-override-cascade).

To restyle an embedded component (e.g. make an Input look borderless inside a custom container), override the visual boundary slot:

```svelte
<Input slotClasses={{ base: 'border-0 bg-transparent focus-visible:ring-0' }} />
```

### `class` hits exactly one slot

The `class` prop reaches **one slot and no other**; every remaining element is reachable solely through `slotClasses.<slot>`. For almost every component that slot is the outermost one — and by convention `base` is the interactive core element, so for wrapper components the root slot is **not** `base`. On `Input` the root is `wrapper` (the label + field column) and `base` is the actual `<input>`, so `<Input class="rounded-full" />` rounds the column, not the field; the field needs `<Input slotClasses={{ base: 'rounded-full' }} />`. (Same story for any multi-slot component — see the [Customization → class Root-Slot Trap](../apps/docs/src/routes/customization/+page.svelte) page.)

One shape of exception: where the outermost element is a shell that only positions an overlay, `class` goes to the panel inside it. `Dialog`, `Drawer` and `ConfirmDialog` are that shape — their root `dialog` slot is a full-viewport `fixed inset-0 … w-full h-full` element that takes `slotClasses.dialog` and never `class`, while `class` lands on the panel (measured: the carrier is the `role="document"` div, and the `<dialog>` in the tree does not have the class). `PaginationItem` looks like a further case and is not one: with `href` it renders the `<a>` itself, dressed by `buttonVariants()`, with its label in a `content` span and nothing interactive inside, so the anchor is its root and `class` lands there (measured); the label span is reachable by neither `class` nor `slotClasses`.

Do not read "root slot" as "the first slot the `tv()` config declares". The two come apart wherever a component declares its trigger before its wrapper, which `ReasoningDisclosure` and `ToolCallCard` both do — their first slot is a `<button>`, their `class` carrier the root `<div>`. **Which element carries `class` is a per-component fact, and every component states it at its own `class` prop**: that is the place to check it, and the place to fix it when it is wrong.

### The override ladder

The five rungs a consumer reaches for, the rule that their numbering is blast radius rather than cascade strength, and how `unstyled` propagates are in [ARCHITECTURE.md § The override cascade](ARCHITECTURE.md#the-override-cascade). Two consequences bind the **prop surface** and belong here:

- **`unstyled` is a plain `boolean` on every visible component**, defaulting to `false`, and it is OR-ed with the provider flag (`unstyledProp || blocksConfig?.unstyled`). A component that renders other blocks components forwards it; one that renders consumer `children` does not.
- **Its JSDoc must not promise an empty element.** `unstyled` removes the `tv()` pass, not every class: a component's own semantic hooks survive, as does the plumbing of any [internal core](ARCHITECTURE.md#the-internal-core-layer) it embeds. "Remove the default variant classes" is accurate; "only user classes apply" is not.

### `variantProps` and the house axis order

> **Canon.** `variantProps` and the house axis order are described once, here.
> [ComponentStructureStandard.md](ComponentStructureStandard.md) links here for the authoring
> rules that follow from them.

The implementation hinge is one type-annotated `variantProps` derived in `ComponentName.svelte` (`const variantProps: XVariants = $derived({ … })`). It feeds both `styles = xVariants(variantProps)` and the `activeProps` argument of `resolveSlotClasses`, and the same `xVariants.config` goes to `tv()` and to the resolver — so the `tv()` output and the prop-conditional `overrides` cannot match against different variants. The annotation is mandatory — without it the string-literal ternaries widen to `string` and silently stop matching the variant keys.

Three rules follow, and the first is the one that decides the other two: **the keys of `variantProps` are the axes the component speaks for.** A key that is there — even at `undefined` — says "this is my axis, and my value for it"; the resolver answers an `undefined` from the config's `defaultVariants`. A key that is absent says nothing, and no rule may claim it.

- **Name every axis the component is actually in.** An axis it leaves out is unaddressable, and that is right when the axis is not the component's to speak for: `SegmentItem` shares `segmentGroupVariants` with `SegmentGroup`, so `fullWidth` (the track's) stays out while `disabled` (the item's own state) is named. Nine configs are shared by 2–5 components; an axis folded in from a sibling paints rules onto components that were never in that state. The same for an axis passed per slot-call rather than per component (`iconPosition` on Input, `disabled` on Menu's rows) — one resolved record is applied to every slot, so a component-level key would claim it of all of them.
- **A boolean axis carries its raw value**, never `x || undefined`. Both spellings work — the fold turns the `undefined` back into the config's `false`, measured — so this is a legibility rule, not a functional one: the raw value makes the condition say what it means without a second lookup, and holds even for an axis whose config declares no default. The three a project-wide rule reaches for are `disabled`, `readonly` and `error`; `provider/boolean-conditions.svelte.test.ts` asserts both sides of each, for every component declaring the prop, and pins both directions of the fold.
- **A component whose `tv()` declares no axes cannot be targeted conditionally at all** (`Chat`, `ChatMessageList`, the five `Guide*` parts). `tv()` sees the same emptiness, so there is nothing to select on and nothing to fold in; unconditional `slotClasses` and presets still reach them. `DatePicker` / `DateRangePicker` are the deliberate exception — the root is a positioning context with no axes, so their object is built for `resolveSlotClasses` alone, out of the values they forward to the components they wrap.

A **wrapper** names no axes at all. It hands its name to the component it wraps, and that component's `variantProps` — this same object — is what the wrapper's rules are matched against, so one rule gets one answer under both names instead of two. An item beside its siblings speaks only for the axes it names, and must not stand in for its neighbour's.

**The house axis order** in `*.variants.ts` is `tier → variant → size → intent → structural flags (hasIcon, striped, …) → state axes (disabled, readonly, messageType, error, pressed, active, connected)`. States come last because a state must dominate the resting look, and the order is load-bearing rather than cosmetic: the engine folds axes in declaration order and every later one strips the earlier one's Tailwind buckets ([ARCHITECTURE.md § The tv() variant engine](ARCHITECTURE.md#the-tv-variant-engine)). Deviate deliberately and leave a comment — Button declares `pressed` before `variant`, the table `sortable` after `sorted`.

## Polymorphic Elements (Link-Buttons, Anchor-as-Card, etc.)

A component takes `href` only when it owns **structure** the consumer cannot rebuild from the exported variants function alone — `Card` (header · content · footer) today, a `ListRow` with slots if one is ever built. Single-box controls never swap their root element: a `Button` always renders `<button>`, a `Badge` always renders `<span>`, a `Toggle` always renders `<button role="switch">`. Where the whole component **is** the anchor and nothing else, reach for `Link` — the Navigation-family member that is always `<a>` and never polymorphic, in an `inline` voice for prose and a `standalone` one for a handle in a `<nav>`.

The line sits there because a swappable root has three real costs, and only structure pays for them (decided 2026-09-08, kino consumer feedback): the props type splits between `HTMLButtonAttributes` and `HTMLAnchorAttributes` and forces a `Record<string, unknown>` cast; navigation-resolution lint rules have to be scoped off for the component; and internal-vs-external URL, `resolve()`, `target`/`rel` are app-routing decisions the library cannot see. `Card` pays all three, and it is worth it, because an `<a>` around a `cardVariants()` shell would have to rebuild three slots. An `<a>` around `buttonVariants()` rebuilds nothing — so that is the recipe, and the library holds itself to it (#427).

When you need a link that looks like a *button* — `Link` is a link look — write a thin wrapper in your app and reuse the exported variant function:

```svelte
<!-- LinkButton.svelte -->
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

This keeps the controls narrow, leaves `resolve()` decisions in app code, and avoids the polymorphic type. Apply the same approach for an anchor styled like a Badge — call `badgeVariants()` directly. The recipe has to reach consumers where they look — the primer, `get-component Button`, the Button docs page (#428) — a rule that lives only in this file is a rule nobody follows.

## Snippet vs. Component Cell Rendering

Components that accept per-row content (most prominently `Table` via `column.cell`) expose two rendering hooks:

- **Snippet (`column.cell`)** — concise, defined inline in the consumer's `.svelte` template. Best for one-off cells that read a couple of fields.
- **Component (`column.component` + `column.componentProps`)** — pulls a typed Svelte component out into its own file. Best when the cell has more than ~10 lines of logic, gets reused across tables, or needs its own tests.

Prefer the **component** form when:

- The cell is non-trivial (state, effects, lifecycle, deeper trees).
- A tool in your own pipeline chokes on snippet type annotations like `{#snippet name(item: T, _value: unknown)}` — `svelte-check` accepts the syntax, and this repo runs no `.svelte` ESLint pass any more, but component cells sidestep the snippet-arg parser entirely either way.
- You want full TypeScript inference on the cell's `Item` generic without leaning on `T`-typed snippet arguments.

Each cell component should accept `item: Item` plus any extra props passed through `componentProps`, and stay agnostic of the table's surrounding context.

## `tier` Prop

The tier model — the three tokens, the two axes that share the name, which components read the context and which only sit on a fixed tier — is [ARCHITECTURE.md § The tier system](ARCHITECTURE.md#the-tier-system). The API rules:

- The prop is **optional** and its type is the narrow one for the component's axis: `'commit' | 'modify'` for an interactive tier, `'contain' | 'bridge'` for a container tier. Never a six-value union covering both.
- **Per-instance beats context beats the family default**, always resolved the same way:

  ```ts
  import { getTierContext } from '$lib/utils';

  const tierCtx = getTierContext();
  const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'commit'); // family default
  ```

- A component with **fixed geometry exposes no `tier` prop at all** — which families those are, and why `Badge` is the one exception, is [ARCHITECTURE.md § The tier system](ARCHITECTURE.md#the-tier-system).

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
| `data-docs-note` | `NoteList` and `InfoCard` roots | Marks reading material rather than an exhibit. A skin running a narrower reading edge than its exhibit edge (the docs app: 46rem prose inside a 60rem column) caps these with the prose instead of letting them stretch to the width a table gets |
| `data-room-hero` | hand-rolled section-landing heroes | Full-width colour-field band flush to the app sidebar (the page nests an inner `max-w` wrapper for alignment); `data-room-chip` flips a room-tinted chip to read on the fill |

Consumers writing their own theme can hook the same attributes. The library defaults remain unchanged. See [the docs-site README § The Color Rooms theme](../apps/docs/README.md#the-color-rooms-theme) for the full theme architecture.

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

`Button` follows the contract via **conditional merges** (since 2026-07-22):
its selection-group attributes (`role`/`aria-checked`/`data-value`) and modeled
state (`pressed`/`disabled`/`loading`) win when the component has something to
say, and fall back to the consumer's restProps value when it doesn't — a plain
explicit attribute after the spread would *remove* a standalone consumer's
`role="link"` (explicit `undefined` deletes the attribute). Reference:
`Button.svelte` for selection-wired attributes. `ButtonGroup`'s container
follows the same treatment (also 2026-07-22): the computed
`radiogroup`/`group` role wins outright, the roving `onkeydown` is composed
via `composeHandlers`, and the `group` arm actively removes a consumer
`aria-orientation` even against restProps (ARIA disallows it on `role=group`).
`Toolbar`'s container spreads restProps first too (also 2026-07-22) — the
simple case: no merges needed, because its post-spread attributes are always
defined (`role="toolbar"` static, `orientation` defaulted, `aria-label` a
required destructured prop) and `aria-orientation` is valid on `role=toolbar`
on both arms, so there is no removal case.

## Stability

Every `*Props` interface may carry a `@stability` JSDoc tag —
`experimental | beta | stable | deprecated`, defaulting to `stable` when
omitted (see the `component-metadata` skill). The tag drives the docs-page
badge, the MCP catalog with the landing page's status column, and — for every
level but `stable` — a note under the heading of the component's `llm.txt`,
which is what `llms-full.txt` and `urbicon get-component` print. The levels
promise:

- **`experimental`** – shipped to be used and judged, but the API may change
  in any release without notice. Feedback is the point.
- **`beta`** – the API shape is settled and documented; behaviour-level fixes
  may still land as breaking changes in a minor.
- **`stable`** (default) – the conventions in this document hold and breaking
  changes follow the versioning policy ([VERSIONING.md](VERSIONING.md)).
- **`deprecated`** – scheduled for removal; the JSDoc names the replacement.

### Promotion: beta → stable

A component is promoted when all five hold:

1. Its docs page exists and has been through the editorial pass
   ([EDITORIAL.md](EDITORIAL.md)).
2. No open P1/P2 issue targets the component.
3. Its public API is unchanged for at least 30 days. Not "for N releases":
   this repo has cut twelve minors in eleven days, three of them on a single
   day, so a release count measures the maintainer's cadence rather than the
   API's. Measured on the component's `index.ts` — the props surface — with
   `git log -1 --date=short -- <path>/index.ts`.

   A purely additive change that brings the component *onto* a convention in
   this document does not restart the clock — it removes a deviation rather
   than exploring a design. Renaming a prop, changing its type, or changing
   what an existing one means does restart it — and so does a commit with
   `!` in its subject that touches the component's directory, even when
   `index.ts` is untouched: a rendered contract a consumer's selector depends
   on (a role, an accessible name, a live region) is public API too, and the
   2026-09-09 auth a11y pass changed exactly that on five `beta` managers
   without touching a single `index.ts`. Take the later of the two dates.
4. The conventions in this document hold — in particular the standard props of
   § Common props. `stable` is defined by that sentence, so the criteria have
   to ask it: eleven components in `blocks` take no `restProps`, and one of
   them (QRCode) was promoted in the first wave without anyone checking. Grep
   for `...rest` in the component's own root `.svelte`.
5. Tests cover the core behaviour (interaction and, where applicable, a11y).

The reverse move is not silent: discovering a violated criterion on a stable
component is an issue against the component, not a quiet tag flip.

## Accessibility

- All interactive elements must have `focus-visible` styles
- Form elements need `aria-describedby` linking to error/helper messages
- Dialog must implement focus trap
- Use `role`, `aria-label`, `aria-expanded` where semantically appropriate
- Set `aria-invalid` only when there is an actual error – not as `aria-invalid="false"`
- For hidden native inputs (Checkbox, Toggle), use `peer` on the input and `peer-focus-visible:` on the visible element to relay the focus ring
- Compound components: use correct ARIA roles (`radiogroup`/`radio` for single-select, `group`/`checkbox` for multi-select)
- **Live-region roles follow the prop that names the message's purpose, and an explicit `role`
  always wins.** `Badge` derives its role from `purpose` (8.20.0: `status` for a state marker, none
  for a tag, a count or a chip, `button` only with an `onclick`). `Alert` does **not** derive one
  yet: it renders a static `role="alert"` at every intent, so a polite callout needs an explicit
  `role="status"`, and a static one that announces nothing needs `role="note"` or
  `role={undefined}`.

  > **Decided 2026-09-10, pending #462** — `Alert` is to derive its role from
  > `intent`: `danger` and `warning` render `role="alert"` (implicitly assertive), every other
  > intent renders `role="status"` (polite), because a saved-message must not interrupt what is
  > being read. It lands as a `fix(blocks)!`.

  One live region per outcome, in either world: never nest a `role="alert"` inside an `aria-live`
  region; the region exists before its content changes. Reference: auth's
  `_shared/FormErrorAlert.svelte` (an assertive and a polite region, both persistent, the inner
  `Alert` role removed through the pass-through).
