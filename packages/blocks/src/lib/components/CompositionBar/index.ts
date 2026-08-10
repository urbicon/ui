import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { CompositionBarSlots, CompositionBarVariants } from './composition-bar.variants';

export type CompositionBarIntent =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral';

/** A single share in the stacked bar. */
export interface CompositionItem {
  /** Stable ID for highlight synchronization and snippet identity. */
  id?: string | number;
  /** Display label in the legend and the default tooltip. */
  label: string;
  /** Numeric value, defines the segment width. */
  value: number;
  /** Overrides the default intent from the component palette. */
  intent?: CompositionBarIntent;
  /** Raw color value (CSS color), bypasses the token system. Takes precedence over `intent`. */
  color?: string;
  /** Arbitrary metadata — passed through to snippets. */
  meta?: Record<string, unknown>;
}

/**
 * @summary One bar showing what a total is made of, with the legend to read it.
 * @description Stacked bar with legend that breaks an aggregate value down into
 * its components. Suited for budget splits, pool composition, resource
 * allocation, token vesting — anywhere `pool = a + b + c` should be visible
 * at a glance.
 *
 * Small segments (< 2% of the total width) are kept minimally visible;
 * hovering/focusing the bar or the legend highlights the counterpart in
 * sync. Tooltip content is fully overridable via the `tooltip` snippet.
 *
 * @tag display
 * @tag data
 *
 * @example
 * ```svelte
 * <CompositionBar
 *   items={[
 *     { label: 'Gas',         value: 220609, intent: 'primary' },
 *     { label: 'Power',       value: 112731, intent: 'secondary' },
 *     { label: 'Maintenance', value:  36102, intent: 'success' }
 *   ]}
 *   formatValue={(v) => formatCurrency(v)}
 *   size="lg"
 *   legendPlacement="right"
 *   showTotal
 * />
 * ```
 */
export interface CompositionBarProps
  extends Omit<CompositionBarVariants, 'isHovered'>,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Composition shares in the order they should appear in the bar. */
  items: CompositionItem[];

  /**
   * Optional fixed total value. Default: Σ items.value. If the explicit total
   * exceeds the sum, the remaining area is rendered neutrally ("unaccounted
   * share"). If it is below the sum, segments are scaled to 100% and a
   * console warning is emitted.
   */
  total?: number;

  /** Format function for values (tooltip, legend, total). */
  formatValue?: (value: number) => string;

  /**
   * Format function for percentages. Default: 1 fraction digit, formatted with the active
   * locale (e.g. `12.3 %`).
   */
  formatPercent?: (percent: number) => string;

  /** Default intent for items without their own `intent`/`color`. @default 'primary' */
  intent?: CompositionBarIntent;

  /** Show the legend. Position it with `legendPlacement`. @default true */
  showLegend?: boolean;

  /** Show percentages in legend and tooltip. @default true */
  showPercentages?: boolean;

  /** Render the total value after the legend. @default false */
  showTotal?: boolean;

  /**
   * Render the value directly inside the bar segment (in addition to the
   * legend). Narrow segments are skipped automatically to prevent overflow
   * — only segments with sufficient width (≥ 8% or ~40 px) show their
   * value. Useful for print, PDF attachments, or dense dashboards where
   * hover tooltips are not enough.
   * @default false
   */
  showValues?: boolean;

  /**
   * Label rendered before the total. Defaults to the localized "Total" label from the blocks
   * i18n bundle.
   */
  totalLabel?: string;

  /**
   * Minimum segment width in percent. Values below it are raised to this
   * width so they stay visible in the bar (nothing gets swallowed). Larger
   * segments are shrunk proportionally so the sum still adds up to 100%.
   * @default 1.5
   */
  minSegmentPercent?: number;

  /**
   * Selection callback fired when a bar segment or legend entry is clicked.
   * Receives the item and its index. Makes the bar interactive (cursor +
   * click handler).
   */
  onItemSelect?: (item: CompositionItem, index: number) => void;

  /** Extra classes merged onto the wrapper. */
  class?: string;

  /** Remove all default classes; only the layout structure remains. */
  unstyled?: boolean;

  /** Per-slot class overrides. */
  slotClasses?: Partial<Record<CompositionBarSlots, string>>;

  /** Preset name (registered via `<BlocksProvider presets={{ CompositionBar: {...} }}>`). */
  preset?: string;

  /**
   * Custom rendering of a legend entry. Receives the item and its percentage.
   * Fully replaces the default rendering (dot + label + value/percent).
   */
  legendItem?: Snippet<[item: CompositionItem, percent: number]>;

  /**
   * Custom tooltip content. Replaces the default layout (label, value, percent).
   */
  tooltip?: Snippet<[item: CompositionItem, percent: number]>;
}

export { default as CompositionBar } from './CompositionBar.svelte';
export { type CompositionBarVariants, compositionBarVariants } from './composition-bar.variants';
