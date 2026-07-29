import type { Snippet } from 'svelte';
import type { HTMLAttributes, HTMLInputAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { InteractiveTier } from '$lib/utils';
import type {
  RadioGroupSlots,
  RadioGroupVariants,
  RadioItemSlots,
  RadioItemVariants
} from './radioGroup.variants';

/**
 * @summary Pick exactly one, with all the options in sight.
 * @description Accessible radio group for single-option selection with semantic intents and form integration.
 * Uses native radio inputs for correct form behavior and ARIA semantics with keyboard navigation.
 *
 * @tag form
 * @related Checkbox
 * @related Select
 *
 * @example
 * ```svelte
 * <RadioGroup label="Plan" bind:value={plan}>
 *   <RadioItem value="free" label="Free" />
 *   <RadioItem value="pro" label="Pro" description="Best for teams" />
 * </RadioGroup>
 * ```
 */
export interface RadioGroupProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> {
  /** RadioItem children to render inside the group. */
  children: Snippet;

  /** Currently selected value. Supports two-way binding via `bind:value`. */
  value?: string;

  /** Shared `name` attribute for all radio inputs. Auto-generated if omitted. */
  name?: string;

  /** Stack direction for the radio items. @default 'vertical' */
  orientation?: 'horizontal' | 'vertical';

  /** Visual size propagated to all child RadioItems. @default 'md' */
  size?: RadioItemVariants['size'];

  /** Semantic color propagated to all child RadioItems. @default 'primary' */
  intent?: RadioItemVariants['intent'];

  /** Visual weight propagated to all child RadioItems. @default 'outlined' */
  variant?: RadioItemVariants['variant'];

  /**
   * Semantic radius tier propagated to every RadioItem. Default `commit`
   * — radio indicators read as identity circles. Set to `modify` (or
   * inherit via TierContext from a wrapping `<Toolbar tier="modify">`)
   * for inline-toolbar contexts where a circle feels oversized.
   *
   * @default 'commit'
   */
  tier?: InteractiveTier;

  /** Disable all radio items in the group. */
  disabled?: boolean;

  /** Mark the group as required for form validation. Adds an asterisk to the label. */
  required?: boolean;

  /** Error message below the group. Replaces `helper` and sets `aria-invalid`. */
  error?: string;

  /** Hint text below the group. Hidden when `error` is set. */
  helper?: string;

  /** Group label displayed above the radio items. */
  label?: string;

  /** Fired after the selected value changes. Receives the new value. */
  onValueChange?: (value: string) => void;

  /** Extra classes merged onto the root wrapper element. */
  class?: string;

  /** Remove all default tv() classes. Only user-provided classes apply. */
  unstyled?: boolean;

  /** Per-slot class overrides merged with tv() styles. */
  slotClasses?: Partial<Record<RadioGroupSlots, string>>;

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ RadioGroup: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;

  /** Micro-interaction preset propagated to child RadioItems. @default 'none' */
  mint?: MintProp;

  /** Explicit `id` for the group element. Auto-generated if omitted. */
  id?: string;
}

/** Reactive context exposed to child RadioItem components via `getRadioGroupContext()`. */
export interface RadioGroupContext {
  readonly name: string;
  readonly size: NonNullable<RadioItemVariants['size']>;
  readonly intent: NonNullable<RadioItemVariants['intent']>;
  readonly variant: NonNullable<RadioItemVariants['variant']>;
  readonly tier: InteractiveTier;
  readonly disabled: boolean;
  readonly error: boolean;
  readonly value: string | undefined;
  readonly mint: MintProp;
  select: (value: string) => void;
}

/**
 * Individual radio option inside a RadioGroup.
 * Renders a hidden native `<input type="radio">` for form semantics and a styled visual indicator.
 * The indicator exposes a `data-state` attribute (`checked | unchecked`) for CSS-based custom styling.
 *
 * @example
 * ```svelte
 * <RadioItem value="dark" label="Dark Mode" description="Easier on the eyes" />
 * ```
 */
export interface RadioItemProps
  extends Omit<HTMLInputAttributes, 'type' | 'size' | 'checked' | 'class' | 'children' | 'value'> {
  /** The value submitted when this item is selected. Must be unique within the group. */
  value: string;

  /** Text label displayed next to the radio indicator. */
  label?: string;

  /** Secondary text below the label for additional context. */
  description?: string;

  /** Disable this individual item (in addition to group-level `disabled`). */
  disabled?: boolean;

  /** Extra classes merged onto the item wrapper element. */
  class?: string;

  /** Remove all default tv() classes for this item. */
  unstyled?: boolean;

  /** Per-slot class overrides for this item. */
  slotClasses?: Partial<Record<RadioItemSlots, string>>;

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ RadioItem: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;

  /** Explicit `id` for the radio input. Auto-generated if omitted. */
  id?: string;
}

export { default as RadioGroup } from './RadioGroup.svelte';
export { default as RadioItem } from './RadioItem.svelte';
export {
  type RadioGroupVariants,
  type RadioItemVariants,
  radioGroupVariants,
  radioItemVariants
} from './radioGroup.variants';
