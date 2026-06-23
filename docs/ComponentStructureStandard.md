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

### Variant Interactions and CSS Cascade

The in-house `tv()` engine concatenates classes in this order: `slots.base` → variant overrides → `compoundVariants` → call-site `class`. There is no `twMerge`-style class collapsing — the CSS cascade decides which rule wins (last matching declaration of equal specificity). In practice, semantic tokens (`bg-surface-base`, `bg-transparent`) compose cleanly because variant classes appear *after* base classes in the generated string. Shared styles (background, border, hover, focus) **may live in the base slot**; variants override them correctly:

```typescript
slots: { base: ['border bg-surface-base hover:border-border-default ...'] },
variants: {
  variant: {
    outlined: { base: 'border-border-subtle' },
    filled:   { base: 'bg-surface-interactive border-transparent hover:bg-surface-hover' },
    ghost:    { base: 'bg-transparent border-transparent hover:bg-surface-subtle' },
  }
}
```

**Watch out for Variant x Intent conflicts:** Variants are applied in definition order. If `intent` (defined after `variant`) sets a `border-color`, it overrides the variant's border. For `ghost` (which needs `border-transparent`) this is a problem – ghost ends up looking like outlined.

Fix via `compoundVariants`, which are applied **after** all regular variants:

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

Documentation examples serve as the first impression of a component and should follow these guidelines:

### Visual Impact

Every example should be visually compelling and modern. Use realistic, well-designed content instead of lorem-ipsum placeholders. Customization examples (slotClasses, unstyled) should show creative design variants (glassmorphism, gradients, terminal look, neon glow, etc.) that go beyond standard configuration.

### Avoid Duplicating Configuration

Examples should not manually rebuild what the component API already offers through props. An intent showcase uses the `intent` prop – it does not manually build colored buttons. Customization examples deliberately show designs that are *not* achievable through standard props.

### Required Example Sections

Each Docs.svelte should cover at least these areas (where applicable):

1. **Variants** – All visual variants side by side
2. **Intents** – All 6 standard intents, preferably in `filled` for maximum color visibility
3. **Sizes** – All sizes with labels
4. **Feature-specific demos** – Special props of the component (layouts, states, boundary controls, etc.)
5. **Micro-interactions (Mint)** – If supported, with its own section
6. **Customization** – slotClasses, unstyled, realistic embedding scenarios
7. **Accessibility** – ARIA behavior, keyboard, reduced motion

### Interactive Examples

Where possible, examples should be interactive (e.g. clickable pagination, toggle state). Use `$state` for local state in `Docs.svelte`.

## docs-gen Integration

The `docs-gen` pipeline automatically extracts from this structure: Props + JSDoc from `index.ts`, variant options + defaults from `*.variants.ts`, inheritance hierarchy (Omit patterns, HTML attributes).

In the playground, use `extractPlaygroundDocs(componentData.props)` to separate `propDocs` (hand-written descriptions) from `variantKeys` (tv-only props).
