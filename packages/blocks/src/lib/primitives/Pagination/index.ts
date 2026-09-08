import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { InteractiveTier } from '$lib/utils/tier-context';
import type { PaginationSlots, PaginationVariants } from './pagination.variants';

export interface PaginationPageItem {
  label: string;
  value: number;
  href?: string;
  active?: boolean;
  disabled?: boolean;
}

/**
 * Context handed to the `renderItem` snippet for a single numbered page button.
 * Bundles the page number, its active/disabled state, the style props forwarded
 * from the Pagination (so a custom item stays visually consistent), and a
 * `select` callback that changes the page (guarded against disabled / no-op /
 * out-of-range internally).
 */
export interface PaginationItemContext {
  /** The 1-based page number this item represents. */
  page: number;
  /** Whether this item is the currently active page. */
  active: boolean;
  /** Whether the item is inert (component `disabled` or `loading`). */
  disabled: boolean;
  /** Button size forwarded from the Pagination props. */
  size: 'sm' | 'md' | 'lg';
  /** Button variant forwarded from the Pagination props.
   * @summary How much weight the page buttons carry.
   */
  variant: 'outlined' | 'filled' | 'ghost';
  /** Semantic intent forwarded from the Pagination props. */
  intent: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral';
  /** Semantic radius tier forwarded from the Pagination props. */
  tier?: InteractiveTier;
  /** Micro-interaction preset forwarded from the Pagination props. */
  mint: MintProp;
  /** Navigate to this page. No-op when disabled, already active, or out of range. */
  select: () => void;
}

/**
 * @summary Page through a longer list, in whichever layout fits.
 * @description Navigation control for paged data sets.
 * Supports multiple layouts, intents, button variants, and configurable ellipsis behaviour.
 *
 * @tag navigation
 * @related Table
 *
 * @example
 * ```svelte
 * <Pagination
 *   currentPage={page}
 *   totalPages={20}
 *   onPageChange={(p) => page = p}
 * />
 * ```
 */
export interface PaginationProps
  extends Omit<PaginationVariants, 'disabled' | 'loading'>,
    Omit<HTMLAttributes<HTMLElement>, 'class'> {
  /** 1-based index of the currently active page. */
  currentPage: number;
  /** Total number of pages in the data set. */
  totalPages: number;

  /**
   * Visual weight of pagination buttons. The current page carries its own
   * encoding regardless (a filled face on `outlined`, a subtle fill plus ring
   * on `ghost`), so the quiet default keeps a nine-button page window from
   * reading as a row of equally loud pills.
   *
   * @default 'ghost'
   * @summary Visual weight of the page buttons; the current page is marked either way.
   */
  variant?: 'outlined' | 'filled' | 'ghost';
  /** Semantic color applied to every pagination button. @default 'primary' */
  intent?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral';
  /** Button dimensions. Affects page numbers, prev/next, and first/last. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Semantic radius tier forwarded to pagination buttons. */
  tier?: InteractiveTier;

  /** Maximum number of page buttons shown between the ellipsis indicators. */
  visiblePages?: number;
  /**
   * Show "First" / "Last" boundary buttons when the current page is far from
   * the edges. Deliberately redundancy-gated to the number window: the buttons
   * render only beside a start/end ellipsis, so without `showNumbers` there is
   * no number window, no ellipsis — and no First/Last buttons. That coupling is
   * intentional (a compact prev/next-only bar stays compact), not a bug.
   * Setting `showFirstLast` explicitly while `showNumbers` is `false` warns
   * once per instance in dev. @default true
   * @summary Adds First / Last buttons when the current page is far from either end.
   */
  showFirstLast?: boolean;
  /** Show "Previous" / "Next" navigation buttons. */
  showPreviousNext?: boolean;
  /** Show numbered page buttons. Set to false for a compact prev/next-only bar. */
  showNumbers?: boolean;
  /** Show a text summary such as "Page 3 of 10" beneath the controls. */
  showInfo?: boolean;

  /** Label for the "Previous" button. Falls back to i18n key `pagination.previous`. */
  previousLabel?: string;
  /** Label for the "Next" button. Falls back to i18n key `pagination.next`. */
  nextLabel?: string;
  /** Label for the "First" button. Falls back to i18n key `pagination.first`. */
  firstLabel?: string;
  /** Label for the "Last" button. Falls back to i18n key `pagination.last`. */
  lastLabel?: string;
  /** Prefix for the info text (e.g. "Page"). Falls back to i18n key `pagination.page`. */
  pageLabel?: string;
  /** Override the auto-generated info text with a fully custom string. */
  infoText?: string;

  /** Custom icon rendered inside the "Previous" button. */
  previousIcon?: Snippet;
  /** Custom icon rendered inside the "Next" button. */
  nextIcon?: Snippet;
  /** Custom icon rendered inside the "First" button. */
  firstIcon?: Snippet;
  /** Custom icon rendered inside the "Last" button. */
  lastIcon?: Snippet;

  /**
   * Render each numbered page button yourself. Receives a {@link PaginationItemContext}
   * with the page number, its active/disabled state, the forwarded style props
   * (size, variant, intent, tier, mint) and a `select` callback. Only affects the
   * numbered page buttons in the default layout — prev/next/first/last keep their
   * own icon snippets, and the ellipsis is unaffected.
   *
   * @example
   * ```svelte
   * <Pagination {currentPage} {totalPages} {onPageChange}>
   *   {#snippet renderItem({ page, active, disabled, select })}
   *     <button class:active onclick={select} {disabled}>{page}</button>
   *   {/snippet}
   * </Pagination>
   * ```
   */
  renderItem?: Snippet<[PaginationItemContext]>;

  /** Items shown per page. Used by the table layout to compute "Showing X to Y of Z". */
  itemsPerPage?: number;
  /** Total number of items across all pages. Used by the table layout info text. */
  totalItems?: number;
  /** Override the calculated start item number for the info text. */
  startItem?: number;
  /** Override the calculated end item number for the info text. */
  endItem?: number;

  /** Fires when the user selects a different page. Receives the 1-based page number. */
  onPageChange?: (page: number) => void;

  /** Disables all buttons and dims the component. */
  disabled?: boolean;
  /** Shows a loading state with reduced opacity. */
  loading?: boolean;

  /**
   * Micro-interaction preset forwarded to the inner buttons (page items,
   * prev/next, first/last).
   * @default 'none'
   */
  mint?: MintProp;

  /** Additional CSS classes merged onto the root `<nav>` element. */
  class?: string;
  /** Strip all default variant classes, on the page buttons too, for a fully custom build. */
  unstyled?: boolean;
  /** Per-slot class overrides merged with (or replacing, when unstyled) tv styles. Slots: base, info, controls, ellipsis. */
  slotClasses?: Partial<Record<PaginationSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Pagination: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

/**
 * @description Standalone pagination button, usable outside the Pagination compound.
 * Without `href` it wraps a Button with pagination-specific semantics (`aria-current="page"`,
 * page click callback); with `href` it is the `<a>` itself, dressed by `buttonVariants` —
 * the same look, and nothing interactive inside the link.
 *
 * @tag navigation
 * @related Pagination
 *
 * @example
 * ```svelte
 * <PaginationItem page={2} active onPageClick={(p) => goto(p)}>2</PaginationItem>
 * ```
 */
export interface PaginationItemProps
  // `HTMLElement`, not `HTMLButtonElement`: with `href` this renders an `<a>`
  // and without it a `<button>`, and the rest bag reaches whichever one the
  // branch made the interactive element. Typing it for the button made the
  // handlers unassignable to the anchor, which is how the link branch came to
  // spread the bag onto nothing at all.
  extends Omit<HTMLAttributes<HTMLElement>, 'class' | 'type' | 'onclick'> {
  /** The page number this item represents. Rendered as default content when no children are provided. */
  page?: number;
  /**
   * Marks this item as the currently active page. Sets `aria-current="page"`
   * and drives Button's `active` state encoding (a filled face on `outlined`,
   * a subtle fill plus ring on `ghost`) — not the momentary press cue, which
   * is invisible on a transparent surface.
   */
  active?: boolean;
  /**
   * Prevents interaction and dims the button. On the link form: `aria-disabled`,
   * out of the tab order, and activation is cancelled.
   */
  disabled?: boolean;
  /**
   * Shows a loading spinner inside the button. The link form draws none — it
   * keeps its label, takes the wait cursor, sets `aria-busy` and cancels
   * activation while set.
   */
  loading?: boolean;

  /** Button dimensions. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Visual weight of the button. @default 'ghost' */
  variant?: 'outlined' | 'filled' | 'ghost';
  /** Semantic color of the button. */
  intent?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral';
  /** Semantic radius tier; read from the wrapping `TierContext` when unset. */
  tier?: InteractiveTier;

  /**
   * Render an `<a>` instead of a button: the anchor itself carries the button
   * look, with no button inside it. Useful for crawlable pagination.
   * `onPageClick` does not fire in this form — the browser navigates.
   *
   * The anchor resolves no provider cascade, and there is no app-wide route to
   * it: a `defaults.Button` rule dresses the button form only, `Pagination`
   * renders no linked items to hand a rule down to, and this component has no
   * provider name of its own. What reaches the link form is `class` per
   * instance, a `<BlocksProvider unstyled>` (which strips it like any other),
   * and a stylesheet rule on the `blocks-intent-*` class it carries.
   */
  href?: string;
  /**
   * Fires when the item is clicked. Receives the page number. Button form only —
   * with `href` the browser navigates instead.
   */
  onPageClick?: (page?: number) => void;

  /**
   * Micro-interaction preset, applied to whichever element the item renders.
   * @default 'none'
   */
  mint?: MintProp;

  /** Custom content rendered inside the button. Falls back to the page number. */
  children?: Snippet;

  /**
   * Additional CSS classes on the element this item renders as — the `<button>`
   * without `href`, the `<a>` with it. Either is the root; the label sits in a
   * `content` span inside it that neither `class` nor `slotClasses` reaches.
   */
  class?: string;

  /**
   * Strip all default styles. Forwarded by `Pagination`'s own `unstyled`. Without
   * `href` it reaches the inner Button, which keeps three semantic hooks
   * (`blocks-button`, `blocks-intent-*`, `[--blocks-press-scale:1]`); with `href`
   * the anchor keeps the last two and loses everything else, the focus ring
   * included — put one back through `class`.
   * @default false
   */
  unstyled?: boolean;

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Button: {...} }}>`
   * — this item's page buttons resolve under `Button`. Button form only: the
   * anchor of the `href` form resolves no cascade, so it takes none.
   */
  preset?: string;
}

export { default as Pagination } from './Pagination.svelte';
export { default as PaginationItem } from './PaginationItem.svelte';
export { type PaginationVariants, paginationVariants } from './pagination.variants';
