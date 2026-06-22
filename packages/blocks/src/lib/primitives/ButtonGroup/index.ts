import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { ComponentIntent, ComponentSize, ComponentVariant, InteractiveTier } from '$lib/utils';
import type { ButtonVariants } from '../Button/button.variants';
import type { ButtonGroupSlots } from './buttongroup.variants';

export type ButtonGroupSelection = 'none' | 'single' | 'multiple';
export type ButtonGroupOrientation = 'horizontal' | 'vertical';
export type ButtonGroupValue = string | string[] | undefined;

/**
 * @description Groups related buttons with shared styling, layout, and optional selection behaviour.
 * Supports single-select (radio), multi-select (checkbox), or no selection.
 *
 * @tag action
 * @related Button
 * @related Toolbar
 *
 * @example
 * ```svelte
 * <ButtonGroup selection="single" bind:value={selectedView}>
 *   <Button value="list">List</Button>
 *   <Button value="grid">Grid</Button>
 * </ButtonGroup>
 * ```
 *
 * @example
 * ```svelte
 * <ButtonGroup
 *   selection="multiple"
 *   bind:value={selectedFormats}
 *   connected
 *   size="sm"
 *   variant="outlined"
 * >
 *   <Button value="bold">B</Button>
 *   <Button value="italic">I</Button>
 *   <Button value="underline">U</Button>
 * </ButtonGroup>
 * ```
 */
export interface ButtonGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Button children to group. */
  children?: Snippet;

  /** Stack direction. */
  orientation?: ButtonGroupOrientation;
  /** Visually connect buttons (overlapping borders, shared rounding). When `false`, buttons are spaced with a small gap. */
  connected?: boolean;
  /** Size propagated to child Buttons (unless a Button sets its own). */
  size?: ComponentSize;
  /** Semantic colour propagated to child Buttons. */
  intent?: ComponentIntent;
  /** Visual weight propagated to child Buttons. */
  variant?: ButtonVariants['variant'];
  /**
   * Semantic radius tier propagated to child Buttons. `commit` (default) →
   * pill caps for the group; `modify` → soft caps. Inherits from a wrapping
   * Toolbar via TierContext when not set explicitly.
   */
  tier?: InteractiveTier;
  /** Disable the entire group and all child Buttons. */
  disabled?: boolean;

  /** Selection mode. `"single"` = radio-group, `"multiple"` = checkbox-group, `"none"` = no selection. */
  selection?: ButtonGroupSelection;
  /** Current selection value. Bind with `bind:value` for two-way sync. String for single, string[] for multiple. */
  value?: ButtonGroupValue;

  /** Micro-interaction preset propagated to child Buttons. */
  mint?: MintProp;
  /** Fired when selection changes. Receives the new value and an array of all selected values. */
  onSelectionChange?: (value: ButtonGroupValue, selectedValues: string[]) => void;

  /** Extra classes merged onto the root element. */
  class?: string;
  /** Remove all default tv classes. */
  unstyled?: boolean;
  /** Per-slot class overrides. Slots: base */
  slotClasses?: Partial<Record<ButtonGroupSlots, string>>;

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ ButtonGroup: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;

  /** Accessible label for the group (prefer this over `aria-label` for correct HTML attribute). */
  ariaLabel?: string;
  /** ID of the element that labels the group. */
  ariaLabelledBy?: string;
}

/** Reactive context exposed to child Button components via `getButtonGroupContext()`. */
export interface ButtonGroupContext {
  readonly orientation: ButtonGroupOrientation;
  readonly connected: boolean;
  readonly size: ComponentSize;
  readonly intent: ComponentIntent;
  readonly variant: ComponentVariant;
  readonly selection: ButtonGroupSelection;
  readonly disabled: boolean;
  readonly mint: MintProp;
  readonly selectedValues: Set<string>;

  registerButton: (value: string | undefined) => {
    readonly isSelected: boolean;
    onClick: () => void;
    getButtonProps: () => {
      role?: 'radio' | 'checkbox';
      'aria-checked'?: boolean;
    };
  };
}

export { default as ButtonGroup } from './ButtonGroup.svelte';
export { type ButtonGroupVariants, buttonGroupVariants } from './buttongroup.variants';
