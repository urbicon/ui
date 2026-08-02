# Component Structure Standard

Standard file structure for all Urbicon UI components. Enables automatic documentation generation via `docs-gen` and consistent DX.

## Folder Structure

```
packages/blocks/src/lib/primitives/[ComponentName]/
├── index.ts                 # Props interface + re-exports (single source of truth)
├── [ComponentName].svelte   # Svelte 5 implementation
├── [component].variants.ts  # in-house tv() (variants) definition
└── docs/                    # Optional: examples, playground config
```

A component must not import another public component's `.svelte` for a trivial
embedded control (close ×, loading spinner, icon-only nav button) — use the
behaviour-only cores in `src/lib/internal/core/` (`CoreIconButton`,
`CoreSpinner`) and put the control's look into an own variants slot
(`closeButton`, `removeButton`, …). Essential compositions (ConfirmDialog →
Dialog, DatePicker → Calendar) stay public-to-public but need an allowlist
entry in `scripts/imports-lint.ts` (`bun run imports:lint`). See
[ARCHITECTURE.md → The internal core layer](ARCHITECTURE.md#the-internal-core-layer).

## index.ts

The props interface extends `ComponentVariants` and relevant HTML attributes. Prop order: Content → Variants → Behavior → Callbacks → Mint → Styling → Accessibility.

```typescript
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ComponentSlots, ComponentVariants } from './component.variants';
import type { MintProp } from '$lib/mint';

export interface ComponentNameProps
  extends ComponentVariants,
    Omit<HTMLAttributes<HTMLElement>, 'children'> {
  children?: Snippet;
  class?: string;
  disabled?: boolean;
  onclick?: (event: MouseEvent) => void;
  mint?: MintProp;
  'aria-label'?: string;
  id?: string;

  // === Styling === (every visible component ships all three — see COMPONENT-API-CONVENTIONS.md)
  /** Remove default tv() classes — only user-provided classes apply. */
  unstyled?: boolean;
  /** Per-slot class overrides merged with tv() styles. Keys come from the tv() config. */
  slotClasses?: Partial<Record<ComponentSlots, string>>;
  /** Apply a named preset registered via `<BlocksProvider presets={{ ComponentName: {...} }}>`. */
  preset?: string;
}

export { componentVariants, type ComponentVariants } from './component.variants';
export { default as ComponentName } from './ComponentName.svelte';
```

### Omit Pattern for Divergent Prop Types

When a prop type differs from `ComponentVariants` (e.g. `error: string` instead of `boolean`), use `Omit` and redefine the prop with specific JSDoc:

```typescript
export interface CheckboxProps
  extends Omit<CheckboxVariants, 'error' | 'checked'>,
    Omit<HTMLInputAttributes, 'type' | 'size' | 'checked' | 'class' | 'children'> {
  /** Error message that replaces helper text and sets aria-invalid. */
  error?: string;
  /** Current checked state. Supports bind:checked. */
  checked?: boolean;
}
```

Internal variant props that are not part of the public API (e.g. `elementType`) should also be excluded via `Omit`.

A compound subcomponent that only owns a slice of the parent's slots constrains its `slotClasses` keys from the derived `*Slots` type via `Exclude`/`Extract`/`Pick` — never a hand-written union that drifts when a slot is renamed. `AccordionItem` uses `Partial<Record<Exclude<AccordionSlots, 'base'>, string>>`; `TabItem` uses `Partial<Record<Extract<TabSlots, 'trigger' | 'icon' | 'label' | 'badge'>, string>>`.

### Compound Components: Context Interface

For compound components (ButtonGroup + Button, Menu + MenuItem), define the context interface in the parent component's `index.ts`. Context values must be reactive (getters, not snapshots):

```typescript
export interface ButtonGroupContext {
  readonly size: ComponentSize;
  readonly intent: ComponentIntent;
  registerButton: (value: string | undefined) => {
    readonly isSelected: boolean;
    onClick: () => void;
    getButtonProps: () => { role?: 'radio' | 'checkbox'; 'aria-checked'?: boolean };
  };
}
```

## ComponentName.svelte

Imports the props type from `index.ts` – no redefinition. Uses `$props()` with defaults:

```svelte
<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import type { ComponentNameProps } from './index';
  import { componentVariants, type ComponentVariants } from './component.variants';

  let {
    children,
    variant = 'filled',
    size = 'md',
    intent = 'primary',
    disabled = false,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: ComponentNameProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // Variant props feed both the tv() style computation and the slot-class
  // cascade — extracted into one derived so `resolveSlotClasses` can match
  // conditional `overrides` against the component's active variants.
  // The `: ComponentVariants` annotation is MANDATORY: without it, the
  // string-literal ternaries below widen to `string` and stop matching the
  // tv() variant keys (silent loss of styling + overrides).
  const variantProps: ComponentVariants = $derived({
    variant,
    size,
    intent,
    disabled: disabled || undefined
  });

  const styles = $derived(componentVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'ComponentName', preset, variantProps, slotClassesProp)
  );
</script>

<button
  class={[
    'blocks-componentname',
    unstyled
      ? [slotClasses?.base, className].filter(Boolean).join(' ')
      : styles.base({ class: [slotClasses?.base, className] })
  ]}
  {...restProps}
>
  {@render children?.()}
</button>
```

The root slot folds `class` and `slotClasses.base` together (so `class` reaches the outermost element); every **other** slot reads only `slotClasses.<slot>`:

```svelte
<!-- Multi-slot pattern (e.g. Input, whose root slot is `wrapper`, not `base`) -->
<span
  class={unstyled ? (slotClasses?.icon ?? '') : styles.icon({ class: slotClasses?.icon })}
>
  …
</span>
```

**Every declared tv-slot must be wired in the markup.** A slot that exists in `*.variants.ts` (and therefore in `ComponentSlots`) but is never rendered with `styles.<slot>(…)` / `slotClasses?.<slot>` is dead surface — it autocompletes for the consumer but silently does nothing. Typed == wired.

## component.variants.ts

Uses the in-house `tv()` engine (`$lib/utils/variants`, ~600 LoC, zero-dep) with slots, variants, and semantic design tokens (see [COMPONENT-API-CONVENTIONS.md](COMPONENT-API-CONVENTIONS.md)):

```typescript
import { tv, type SlotNames, type VariantProps } from '$lib/utils/variants';

export const componentVariants = tv({
  slots: {
    base: ['...'],
  },
  variants: {
    variant: { filled: {}, outlined: {}, ghost: {} },
    size: { sm: {}, md: {}, lg: {} },
    intent: { primary: {}, neutral: {}, danger: {} },
  },
  defaultVariants: { variant: 'filled', size: 'md', intent: 'primary' },
});

export type ComponentVariants = VariantProps<typeof componentVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type ComponentSlots = SlotNames<typeof componentVariants>;
```

### Variant Interactions — axis order is semantic

The `tv()` engine folds an ordered list of sources: `slots.base` → **each variant axis in declaration order** → **each `compoundVariant` in array order** → call-site `class`. Every later source strips the conflicting Tailwind buckets of everything before it, so the winner of a shared bucket is decided by the config, not by stylesheet order.

Authoring rules that follow:

1. **Declare the axis that must win a shared bucket later.** The house order is `tier → variant → size → intent → structural flags (hasIcon, striped, …) → state axes (disabled, readonly, messageType, error, pressed, active, connected)` — states last, because a state must dominate the resting look. Deviate deliberately and leave a comment (see Button's `pressed` before `variant`, table's `sortable` after `sorted`).
2. **Shared styles may live in the base slot** — any axis overrides them cleanly (`bg-surface-base` in base, `bg-transparent` in ghost).
3. **Within one class string nothing is stripped** — intentional pairings like `rounded-md rounded-t-none` stay intact.
4. **A class every reachable combination strips is dead** and fails `bun run variants:lint`. Don't leave aspirational tokens in an axis that a later axis always overrides — move them to a compound or delete them.

**Variant × Intent conflicts:** if `intent` (declared after `variant`) sets a `border-color`, it deterministically replaces the variant's border. Where a specific combination needs a different answer than the axis order gives (ghost must stay `border-transparent` under intents), use `compoundVariants` — they resolve **after** all axes:

```typescript
compoundVariants: [
  {
    variant: 'ghost',
    intent: ['success', 'warning', 'danger'],
    error: false,
    class: { base: 'border-transparent' }
  }
]
```

### Variant Distinctness

Every variant option must produce a visible difference. Empty variant definitions (`variant: { outlined: {}, filled: {} }`) are a bug. When differences are state-dependent (e.g. Checkbox unchecked vs. checked), use `compoundVariants`:

```typescript
compoundVariants: [
  { checked: false, variant: 'outlined', class: { box: 'bg-surface-base border-border-default' } },
  { checked: false, variant: 'ghost',    class: { box: 'bg-transparent border-transparent' } },
]
```

### Size Progressions

Each size step must differ noticeably from adjacent sizes. Identical values for neighboring sizes (e.g. `xs` and `sm` both `w-4 h-4`) should be corrected.

### Tier-aware components

If the component belongs to the Action / Form / Navigation / Container family ([COMPONENT-FAMILIES.md](COMPONENT-FAMILIES.md)), it accepts an optional `tier` prop and reads `<TierContext>` from a wrapping container. Standard wiring in `ComponentName.svelte`:

```ts
import { getTierContext } from '$lib/utils';

const tierCtx = getTierContext();
const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'commit'); // family default
```

The variant file consumes `tier` like any other variant axis:

```ts
// componentname.variants.ts
variants: {
  tier: {
    commit: { base: 'rounded-commit' },
    modify: { base: 'rounded-modify' }
  }
}
defaultVariants: { tier: 'commit' /* or 'modify' per family */ }
```

Vorbild: `Toggle/toggle.variants.ts` + `Toggle.svelte` (Action family, commit default). Compound components (`Stepper`, `Tab`, `SegmentGroup`, `RadioGroup`) set the tier on their own context so the children pick it up — see [`Tab/tab.context.ts`](../packages/blocks/src/lib/primitives/Tab/tab.context.ts).

Feedback / Ambient and Identity components do **not** take a `tier` prop — they have fixed geometry. Badge is the only exception (`tier` exposed because Badge-in-Toolbar wants to flatten).

## JSDoc Quality

Every prop in `index.ts` needs specific JSDoc. Generic descriptions like "Controls the visual appearance" are marked as tv-only in the playground and provide no added value.

```typescript
// Bad: generic
/** Controls the size of the component. */
size?: 'sm' | 'md' | 'lg';

// Good: specific
/** Stack direction. */
orientation?: 'horizontal' | 'vertical';

// Good: explains behavior
/** Show a clear button when the input has a value. Press Escape or click to clear. */
clearable?: boolean;

// Good: names side effects
/** Error message that replaces helper text, styles the message red, and sets aria-invalid. */
error?: string;
```

Props whose description comes exclusively from `tv()` (no JSDoc in `index.ts`) automatically show a "V" badge in the playground instead of an info tooltip.

## Example Quality (Docs.svelte)

Page content is not this document's subject — see **[DocsPageGuide.md](DocsPageGuide.md)** for
section order, the examples strategy and the accessibility section.

> This file used to carry a "Required Example Sections" list demanding a Variants, an Intents and
> a Sizes section on every page. The DocsPageGuide has told authors to delete exactly those on
> sight since XC-6, and the pages followed the guide: of 185 pages, **one** has a `variants`
> section, **two** have `sizes`, **none** has `intents`. The list was contradicted by the
> codebase and by the other document at the same time, so it is gone rather than reconciled.
> The Playground is the variant explorer; examples are use-cases.

## docs-gen Integration

The `docs-gen` pipeline automatically extracts from this structure: Props + JSDoc from `index.ts`, variant options + defaults from `*.variants.ts`, inheritance hierarchy (Omit patterns, HTML attributes).

In the playground, use `extractPlaygroundDocs(componentData.props)` to separate `propDocs` (hand-written descriptions) from `variantKeys` (tv-only props).
