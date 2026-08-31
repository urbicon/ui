import { createOptionalContext, resolveClassChain } from '@urbicon-ui/blocks';
import { LAYOUT_SWITCH_CLASSES } from '../variants/table.variants';

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
   * Visible table frame (border, radius, shadow) — whichever layout is showing:
   * it holds the `<table>` above the `cardsBelow` step and the record list below
   * it, so a frame override reaches both.
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
  /**
   * `<th>` of a **data column**. The table's structural header cells (select-all
   * checkbox, group toggle, expand spacer) are chrome, not columns, and are
   * deliberately not part of this slot — see {@link TableSlotClasses.cell}.
   */
  headerCell?: string;
  /** `<tr>` in tbody */
  row?: string;
  /**
   * `<td>` of a **data column**.
   *
   * Deliberately scoped to the cells that render column content. The table's
   * own structural cells — selection checkbox, expand chevron, group
   * indentation spacer — are chrome with fixed widths (`w-10`/`w-12`) and stay
   * out of this slot, so a `cell` override (padding, alignment, typography)
   * cannot deform the controls it was never aimed at. Style those through
   * `row`, or restyle the whole table with `unstyled`.
   */
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
  /** One record of the card list below `cardsBelow` (the stacked form of a `row`) */
  mobileCard?: string;
}

export type TableVariant = 'flush' | 'surface' | 'framed';

export interface TableStyleConfig {
  unstyled: boolean;
  slotClasses: Partial<TableSlotClasses>;
  variant: TableVariant;
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
  return getTableStyleContextRaw() ?? { unstyled: false, slotClasses: {}, variant: 'flush' };
}

/**
 * The classes a slot may emit that `unstyled` must not take away — see
 * {@link LAYOUT_SWITCH_CLASSES} for what qualifies and why.
 */
const STRUCTURAL = new Set<string>(LAYOUT_SWITCH_CLASSES);

/**
 * Resolves classes for a slot, respecting `unstyled` mode.
 *
 * Routes the caller's overrides **through** the `tv()` slot function (via its
 * `class` option) instead of string-concatenating them onto the already-resolved
 * variant string. This puts them inside the tv() conflict fold, so a
 * `slotClasses` (or `className`) utility that shares a Tailwind bucket with a
 * base/variant class **wins** instead of merely co-existing and losing to
 * stylesheet order — e.g. `slotClasses={{ table: 'w-auto' }}` beats the slot's
 * own `w-full` (before that an `!` prefix was needed).
 *
 * Two sources, in ladder order:
 *
 *  1. `slotClass` + `structural`, together. Deliberately ONE source: a direct
 *     conflict between them is left to the CSS cascade, because `structural`
 *     carries the layout switch's halves and a consumer's slot class must not
 *     be able to remove them (see "What `unstyled` takes away" below).
 *  2. `className` — the consumer's own `class` prop, the top rung of the
 *     override ladder, so it strips whichever of the two it collides with.
 *
 * ## What `unstyled` takes away
 *
 * The table's **look**, and only that. Two kinds of class stay:
 *
 *  - what the caller passed (`slotClass`, `structural`) — never ours to strip;
 *  - the structural classes the config itself emits, which today are exactly
 *    the desktop/card switch ({@link LAYOUT_SWITCH_CLASSES}).
 *
 * The second is why this branch is not the plain drop it used to be. The
 * switch's two `hidden` halves arrive as `structural` and always survived,
 * while the query container they are measured against is a base class of the
 * `container` slot — dropping that one alone left both halves unable to match
 * anything, so the grid and the card list rendered at the same time.
 *
 * @param slotFn - The `tv()` slot **function** (pass `styles.row`, NOT `styles.row()`)
 * @param slotClass - User-provided class for this slot from `slotClasses`
 * @param unstyled - Whether to strip the slot's look (see above)
 * @param structural - Call-site classes that are not this component's look:
 *   positioning and layout utilities, the layout switch's halves. Kept verbatim
 *   under `unstyled`. NOT the consumer's `class` prop — that is `className`.
 * @param className - The consumer's own `class` prop, resolved as the rung
 *   above `slotClass`/`structural`.
 */
export function resolveSlotClass(
  slotFn: (opts?: { class?: (string | undefined)[] }) => string,
  slotClass: string | undefined,
  unstyled: boolean,
  structural?: string,
  className?: string
): string {
  const overrides = [slotClass, structural].filter(Boolean).join(' ');
  if (unstyled) {
    const kept = slotFn()
      .split(/\s+/)
      .filter((cls) => STRUCTURAL.has(cls));
    // `kept` is prepended, NOT folded: these are the classes `unstyled` may not
    // take away, and a caller's `className` in the same Tailwind bucket would
    // strip them. Measured: with `kept` as a fold source,
    // `resolveSlotClass(container, undefined, true, undefined, '@container/x')`
    // returned `@container/x` alone — both write `container-type`, so the query
    // container the switch is measured against went with it and neither half of
    // the desktop/card switch could match.
    return [...kept, resolveClassChain(overrides, className)].filter(Boolean).join(' ');
  }
  return slotFn({ class: [overrides, className] });
}
