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
 * @param variantClasses - Classes from `tv()` variant (e.g. `styles.row()`)
 * @param slotClass - User-provided class for this slot from `slotClasses`
 * @param unstyled - Whether to strip variant classes
 * @param extra - Additional classes (e.g. from `className` prop)
 */
export function resolveSlotClass(
  variantClasses: string,
  slotClass: string | undefined,
  unstyled: boolean,
  extra?: string
): string {
  if (unstyled) {
    return [slotClass, extra].filter(Boolean).join(' ');
  }
  return [variantClasses, slotClass, extra].filter(Boolean).join(' ');
}
