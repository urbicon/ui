import type { HTMLInputAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { InteractiveTier } from '$lib/utils';
import type { ToggleSlots, ToggleVariants } from './toggle.variants';

/**
 * @description Accessible switch control for boolean on/off states.
 * Built on a hidden native input with semantic intents and Mint micro-interactions.
 *
 * @tag form
 * @related Checkbox
 *
 * @example
 * ```svelte
 * <Toggle label="Enable notifications" bind:checked />
 * ```
 *
 * @example
 * ```svelte
 * <Toggle
 *   intent="success"
 *   size="lg"
 *   withBorder
 *   onCheckedChange={(val) => console.log('toggled', val)}
 * />
 * ```
 */
export interface ToggleProps
  extends Omit<ToggleVariants, 'checked'>,
    Omit<HTMLInputAttributes, 'type' | 'size' | 'checked' | 'class' | 'children'> {
  /** Current on/off state. Supports two-way binding via `bind:checked`. */
  checked?: boolean;

  /** Text label displayed to the right of the toggle track. */
  label?: string;

  /** Hint text shown below the control. Useful for explaining side-effects of the toggle. */
  helper?: string;

  /** Prevent interaction and dim the control. */
  disabled?: boolean;

  /** Mark the native input as required for form validation. */
  required?: boolean;

  /** The `name` attribute of the underlying `<input>`. Used for form submission. */
  name?: string;

  /** The value submitted when checked. Defaults to `'on'`. */
  value?: string;

  /** Extra classes merged onto the outermost wrapper element. */
  class?: string;

  /** Strip all default tailwind-variants classes. Use with `slotClasses` for a fully custom look. The track exposes `data-state` for conditional styling. */
  unstyled?: boolean;

  /**
   * Per-slot class overrides merged with (or replacing, when `unstyled`) the
   * default styles. Slots: wrapper (root — what `class` also targets) | control
   * (the `<label>` wrapping the input) | track | thumb | label | message.
   */
  slotClasses?: Partial<Record<ToggleSlots, string>>;

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Toggle: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;

  /** Micro-interaction preset applied to the control area on hover/click. */
  mint?: MintProp;

  /** Fired after the checked state changes. Receives the new `checked` value. */
  onCheckedChange?: (checked: boolean) => void;

  /** Explicit `id` to link `<label>` and `<input>`. Auto-generated if omitted. */
  id?: string;

  /** Draw a subtle border around the track. Helps distinguish the control on busy backgrounds. */
  withBorder?: boolean;

  /**
   * Semantic radius tier. Default `commit` — a toggle declares status
   * (on/off identity), and reads as a pill. Set to `modify` (usually via a
   * wrapping `<Toolbar tier="modify">` propagating through TierContext) for
   * inline-toolbar contexts where the Pill feels oversized — the track and
   * thumb shrink to a soft-rectangle.
   *
   * Inherited from TierContext when omitted; falls back to `commit` outside
   * of any tier-aware container.
   */
  tier?: InteractiveTier;

  /**
   * Visual style. `default` renders a classic Switch-Pill (track + sliding
   * thumb). `dot` renders a small monochrome circular indicator instead —
   * outline-only when off, filled in the intent colour when on. Use `dot`
   * for dense settings rows, inline-toolbars, or anywhere the Switch-Pill
   * is visually too loud.
   *
   * @default 'default'
   */
  appearance?: ToggleVariants['appearance'];
}

export { default as Toggle } from './Toggle.svelte';
export { type ToggleVariants, toggleVariants } from './toggle.variants';
