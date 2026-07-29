import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { SplitPaneLimit } from './split-pane.utils';
import type { SplitPaneSlots, SplitPaneVariants } from './split-pane.variants';

/**
 * @summary Two panes and a divider the user can move.
 * @description Resizable two-pane layout. A draggable divider (ARIA "window
 * splitter", role="separator") splits the container into a `start` and an `end`
 * pane; the first pane's share is controlled by `ratio` (0–1) and supports
 * `bind:ratio`. Resize by pointer drag or keyboard (Arrow / Home / End), with
 * optional collapse-to-zero. Panes clip their own overflow so their content
 * scrolls independently. For an application shell with a permanent nav rail
 * prefer SidebarLayout / Sidebar; reach for SplitPane when both regions are
 * primary content the user should be able to rebalance.
 *
 * @tag layout
 * @related SidebarLayout
 * @related Sidebar
 * @stability experimental
 *
 * @example
 * ```svelte
 * <SplitPane bind:ratio={split} min="20%" max="80%">
 *   {#snippet start()}<nav class="p-4">…</nav>{/snippet}
 *   {#snippet end()}<main class="p-4">…</main>{/snippet}
 * </SplitPane>
 * ```
 *
 * @example
 * ```svelte
 * <SplitPane orientation="vertical" collapsible defaultRatio={0.3}>
 *   {#snippet start()}<section class="overflow-auto">Editor</section>{/snippet}
 *   {#snippet end()}<section class="overflow-auto">Preview</section>{/snippet}
 * </SplitPane>
 * ```
 */
export interface SplitPaneProps
  extends Omit<SplitPaneVariants, 'dragging' | 'orientation' | 'disabled'>,
    Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> {
  // === Content ===
  /** First pane. In `horizontal` orientation it is the leading (left) pane; in `vertical` the top pane. Required. */
  start: Snippet;
  /** Second pane — fills the space the first pane leaves. Required. */
  end: Snippet;
  /** Custom content rendered inside the divider (e.g. a grip icon). Replaces the default line; the divider stays the focusable separator. */
  handle?: Snippet;

  // === Variants ===
  /** Layout axis. `horizontal` places panes side by side (vertical divider); `vertical` stacks them (horizontal divider). @default 'horizontal' */
  orientation?: 'horizontal' | 'vertical';

  // === Behavior ===
  /** First pane's share of the container, `0`–`1`. Supports `bind:ratio`. When omitted, starts at `defaultRatio` and is managed internally. */
  ratio?: number;
  /** Initial ratio for uncontrolled use; also the target of a double-click reset. @default 0.5 */
  defaultRatio?: number;
  /** Lower bound for the first pane — px (`number`) or percentage string (`'20%'`). @default '10%' */
  min?: SplitPaneLimit;
  /** Upper bound for the first pane — px (`number`) or percentage string (`'90%'`). @default '90%' */
  max?: SplitPaneLimit;
  /**
   * Allow the first pane to collapse to zero: dragging below
   * `collapseThreshold`, or pressing Enter on the divider, snaps it shut.
   * @default false
   * @summary Let the first pane collapse shut by dragging it small or pressing Enter on the divider.
   */
  collapsible?: boolean;
  /** Pixel width/height of the first pane below which a drag snaps it collapsed. Only used when `collapsible`. @default 48 */
  collapseThreshold?: number;
  /** Disable resizing — the divider becomes inert (not focusable, no pointer/keyboard response). Panes stay visible. @default false */
  disabled?: boolean;

  // === Callbacks ===
  /** Fires after a drag/keyboard interaction changes the ratio. Receives the new ratio (`0`–`1`). Does not fire for consumer-driven `bind:ratio` writes. */
  onRatioChange?: (ratio: number) => void;
  /** Fires when the first pane collapses (`true`) or re-expands (`false`) via drag or Enter. */
  onCollapsedChange?: (collapsed: boolean) => void;

  // === Accessibility ===
  /** Accessible name for the divider (its `aria-label`). @default 'Resize panes' */
  handleLabel?: string;

  // === Mint ===
  /** Micro-interaction preset applied to the divider. @default 'none' */
  mint?: MintProp;

  // === Styling ===
  /** Extra classes merged onto the root container (the flex box). */
  class?: string;
  /** Remove all default tv() classes; combine with `slotClasses` to rebuild the look. */
  unstyled?: boolean;
  /**
   * Per-slot class overrides merged with tv() styles. Slots: root (the flex
   * container — what `class` also targets) | startPane | endPane | handle (the
   * draggable divider / separator).
   */
  slotClasses?: Partial<Record<SplitPaneSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ SplitPane: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as SplitPane } from './SplitPane.svelte';
// Only the public-facing types are re-exported; the pure geometry functions in
// `split-pane.utils` stay internal (the component and its unit tests import them
// directly from that module) so `export *` in the blocks barrel does not leak
// them into the public API.
export type { SplitPaneLimit, SplitPaneOrientation } from './split-pane.utils';
export { type SplitPaneVariants, splitPaneVariants } from './split-pane.variants';
