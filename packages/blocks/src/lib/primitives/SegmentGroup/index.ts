import type { Snippet } from 'svelte';
import type { HTMLAttributes, HTMLButtonAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { InteractiveTier } from '$lib/utils';
import type { SegmentGroupSlots, SegmentGroupVariants } from './segmentgroup.variants';

/**
 * Reactive context exposed to child SegmentItem components.
 */
export interface SegmentGroupContext {
  registerItem: (value: string, element: HTMLElement) => () => void;
  selectItem: (value: string) => void;
  isActive: (value: string) => boolean;
  readonly size: NonNullable<SegmentGroupVariants['size']>;
  readonly variant: NonNullable<SegmentGroupVariants['variant']>;
  readonly tier: InteractiveTier;
  readonly disabled: boolean;
  readonly unstyled: boolean;
  readonly mint: MintProp;
}

/**
 * @description Segment control with an animated sliding indicator for single selection; collapses to a vertical radio-style stack when its row can't fit the available width.
 * Compact mode/view switcher with smooth animation.
 *
 * @tag navigation
 * @related ButtonGroup
 * @related RadioGroup
 * @related Tab
 *
 * @example
 * ```svelte
 * <SegmentGroup bind:value={view}>
 *   <SegmentItem value="list">List</SegmentItem>
 *   <SegmentItem value="grid">Grid</SegmentItem>
 *   <SegmentItem value="board">Board</SegmentItem>
 * </SegmentGroup>
 * ```
 */
export interface SegmentGroupProps
  extends SegmentGroupVariants,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Segment items to render. Must be SegmentItem components. */
  children?: Snippet;

  /** Currently selected value. Supports `bind:value` for two-way binding. */
  value?: string;

  /** Fires after the selected value changes. Receives the new value. */
  onValueChange?: (value: string) => void;

  /** Prevent interaction and dim the control. @default false */
  disabled?: boolean;

  /** Extra classes merged onto the root element. */
  class?: string;

  /** Remove all default tv() classes. */
  unstyled?: boolean;

  /** Per-slot class overrides merged with tv() styles. */
  slotClasses?: Partial<Record<SegmentGroupSlots, string>>;

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ SegmentGroup: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;

  /** Accessible label for the segment group. */
  ariaLabel?: string;

  /**
   * When the segments can't fit their available width, collapse the horizontal
   * track to a vertical radio-style stack (all options stay visible) instead of
   * overflowing. Triggered by real measured overflow (ResizeObserver), not a
   * viewport breakpoint, so it only engages when an instance genuinely doesn't
   * fit — a 2-segment switcher that fits stays horizontal. Set `false` to keep
   * the track horizontal (it still won't push the page wider than its parent).
   * @default true
   */
  collapseOnOverflow?: boolean;

  /**
   * Micro-interaction effect applied to each segment item (per-item, not the container).
   * Accepts a preset name, an array of names, or configured mint objects.
   *
   * @example
   * ```svelte
   * <SegmentGroup mint="scale" />
   * <SegmentGroup mint={['scale', 'ripple']} />
   * <SegmentGroup mint={[{ name: 'scale', config: { intensity: 1.02 } }]} />
   * ```
   * @default 'none'
   */
  mint?: MintProp;
}

/**
 * Individual option inside a SegmentGroup.
 *
 * @example
 * ```svelte
 * <SegmentItem value="grid">Grid View</SegmentItem>
 * ```
 */
export interface SegmentItemProps extends Omit<HTMLButtonAttributes, 'children'> {
  /** Unique value for this segment option. */
  value: string;

  /** Label content rendered inside the segment button. */
  children?: Snippet;

  /** Disable this individual item. @default false */
  disabled?: boolean;

  /** Extra classes merged onto the button element. */
  class?: string;

  /** Remove all default tv() classes. */
  unstyled?: boolean;

  /** Per-slot class overrides merged with tv() styles. */
  slotClasses?: Partial<Record<Extract<SegmentGroupSlots, 'item'>, string>>;

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ SegmentItem: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as SegmentGroup } from './SegmentGroup.svelte';
export { default as SegmentItem } from './SegmentItem.svelte';
export { type SegmentGroupVariants, segmentGroupVariants } from './segmentgroup.variants';
