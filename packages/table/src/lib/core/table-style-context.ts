import { createOptionalContext } from '@urbicon-ui/blocks';

/**
 * Per-slot class overrides for the Table component.
 * Each key corresponds to a rendering slot in the component tree.
 */
export interface TableSlotClasses {
  /** Outer container (flex-column, holds toolbar + scrollArea) */
  container?: string;
  /** Toolbar wrapper around `SmartFilterBar` or custom `toolbar` snippet (Sticky-Layer L1) */
  toolbar?: string;
  /**
   * Visible table frame (border, radius, shadow). Holds `<table>`.
   * Replaces the former `wrapper` slot from v1.4.x — see docs/STICKY-PINNING.md.
   */
  scrollArea?: string;
  /** `<table>` element */
  table?: string;
  /** `<thead>` */
  thead?: string;
  /** `<tbody>` */
  tbody?: string;
  /** `<tr>` in thead */
  headerRow?: string;
  /** `<th>` */
  headerCell?: string;
  /** `<tr>` in tbody */
  row?: string;
  /** `<td>` */
  cell?: string;
  /** Group header row */
  groupHeader?: string;
  /** Summary row */
  summaryRow?: string;
  /** Empty state container */
  emptyState?: string;
  /** Loading state container */
  loadingState?: string;
  /** Error state container */
  errorState?: string;
  /** Default SmartFilterBar inner container */
  filterBar?: string;
  /** Mobile card wrapper */
  mobileCard?: string;
}

export type TableAppearance = 'flush' | 'surface' | 'framed';

export interface TableStyleConfig {
  unstyled: boolean;
  slotClasses: Partial<TableSlotClasses>;
  appearance: TableAppearance;
}

// Optional — sub-components have a sane default when used outside Table.svelte.
const [getTableStyleContextRaw, setTableStyleContext] = createOptionalContext<TableStyleConfig>();

/**
 * Sets the table style context. Called by `Table.svelte`.
 */
export { setTableStyleContext };

/**
 * Retrieves the table style context. Used by subcomponents to apply `unstyled` + `slotClasses`.
 */
export function getTableStyleConfig(): TableStyleConfig {
  return getTableStyleContextRaw() ?? { unstyled: false, slotClasses: {}, appearance: 'flush' };
}

/**
 * Resolves classes for a slot, respecting `unstyled` mode.
 *
 * Routes the caller's `slotClass` + `extra` **through** the `tv()` slot
 * function (via its `class` option) instead of string-concatenating them onto
 * the already-resolved variant string. This puts the overrides inside the tv()
 * conflict fold, so a `slotClasses` (or `className`) utility that shares a
 * Tailwind bucket with a base/variant class **wins** instead of merely
 * co-existing and losing to stylesheet order — e.g. `slotClasses={{ table:
 * 'min-w-0' }}` now beats the base `min-w-[600px]` (previously both rendered
 * and a `!min-w-0` was needed). Both overrides (`slotClass` and `extra`) win
 * over base/variant classes in the fold; between the two overrides themselves
 * nothing is stripped — they share one call-site source, so a direct conflict
 * there still resolves by stylesheet order, exactly as before.
 *
 * @param slotFn - The `tv()` slot **function** (pass `styles.row`, NOT `styles.row()`)
 * @param slotClass - User-provided class for this slot from `slotClasses`
 * @param unstyled - Whether to strip variant classes (return only the overrides)
 * @param extra - Additional classes (e.g. from `className` prop or structural utilities)
 */
export function resolveSlotClass(
  slotFn: (opts?: { class?: (string | undefined)[] }) => string,
  slotClass: string | undefined,
  unstyled: boolean,
  extra?: string
): string {
  const classes = [slotClass, extra];
  if (unstyled) {
    return classes.filter(Boolean).join(' ');
  }
  return slotFn({ class: classes });
}
