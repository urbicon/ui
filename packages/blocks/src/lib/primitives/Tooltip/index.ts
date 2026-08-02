import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { Placement } from '$lib/utils/floating';
import type { TooltipSlots, TooltipVariants } from './tooltip.variants';

/**
 * @summary A short explanation on hover or focus.
 * @description Contextual overlay that displays brief, supplementary text on hover or focus.
 * Built on the library's own positioning engine for precise placement and accessibility support.
 * Renders as phrasing content — trigger, panel and arrow are all `<span>` — so it is valid inside a
 * paragraph, the position it is meant for. `Popover` needs its `inline` prop for that; `Tooltip`
 * needs no opt-in, because `label` is a string and cannot carry block content. Two caveats: the
 * trigger children are yours, and a `<div>` there closes the paragraph again; and the trigger
 * wrapper is `inline-flex`, so it is atomic — a multi-word trigger will not break across lines.
 *
 * @tag display
 * @related Popover
 *
 * @example
 * ```svelte
 * <Tooltip label="Save your changes">
 *   <Button>Save</Button>
 * </Tooltip>
 * ```
 *
 * @example
 * ```svelte
 * <Tooltip label="Copy to clipboard" placement="right" arrow showDelay={100}>
 *   <Button variant="ghost" size="sm" onclick={handleCopy}>Copy</Button>
 * </Tooltip>
 * ```
 *
 * @example Controlled mode — programmatic "Copied!" feedback via `bind:open`
 * ```svelte
 * <script lang="ts">
 *   let copied = $state(false);
 *   async function copy() {
 *     await navigator.clipboard.writeText(text);
 *     copied = true;
 *     setTimeout(() => (copied = false), 1500);
 *   }
 * </script>
 *
 * <Tooltip label="Copied!" bind:open={copied}>
 *   <Button onclick={copy}>Copy</Button>
 * </Tooltip>
 * ```
 */
export interface TooltipProps
  extends TooltipVariants,
    // `HTMLSpanElement`, because that is what `restProps` is spread onto. The
    // panel is a `<span>` so a tooltip is legal inside a paragraph — the
    // position it is documented for. See the markup comment in Tooltip.svelte.
    //
    // Type-level break for anyone who annotated a handler as
    // `HTMLDivElement` or extended `TooltipProps` with div-typed handlers:
    // svelte's `HTMLAttributes<T>` feeds `T` to the event `currentTarget`.
    // Zero call sites in this repo (svelte-check across blocks, table, docs
    // and the docs app).
    Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Text displayed inside the tooltip bubble. */
  label: string;

  /** The trigger element(s) that activate the tooltip. */
  children: Snippet;

  /** Where the tooltip appears relative to the trigger. Auto-flips when clipped. @default 'top' */
  placement?: Placement;

  /** Milliseconds before the tooltip appears after hover/focus. Prevents accidental activation. @default 200 */
  showDelay?: number;

  /** Milliseconds before the tooltip disappears after leaving the trigger. @default 100 */
  hideDelay?: number;

  /**
   * Override the fade duration in milliseconds. Distinct from `showDelay` /
   * `hideDelay`, which time *when* the tooltip appears — this is how fast the
   * opacity fade itself runs. Defaults to the tooltip token
   * `--blocks-tooltip-duration` (fast, 150ms). Respects `prefers-reduced-motion`.
   */
  transitionDuration?: number;

  /**
   * Override the fade easing as a CSS `<easing-function>` (e.g. `'linear'`,
   * `'ease-out'`, `'cubic-bezier(0.4,0,0.2,1)'`). Defaults to the tooltip token
   * `--blocks-tooltip-easing`. A CSS string, not a JS easing fn, because the
   * tooltip fade is a pure CSS transition.
   */
  transitionEasing?: string;

  /** Whether to show a directional arrow pointing at the trigger. @default true */
  arrow?: boolean;

  /** Prevent the tooltip from appearing regardless of hover/focus. @default false */
  disabled?: boolean;

  /**
   * Controls tooltip visibility. Supports `bind:open` for programmatic
   * display (e.g. a transient "Copied!" confirmation). Hover/focus keep
   * driving the state in parallel — the delays apply only to those
   * interaction paths, a `bind:open` write takes effect immediately.
   * @default false
   */
  open?: boolean;

  /**
   * Fires when the tooltip opens or closes from user interaction (hover
   * in/out, focus/blur, Escape). Receives the new open state. Not called
   * when the consumer writes `bind:open` directly.
   */
  onOpenChange?: (open: boolean) => void;

  /** Remove default tv classes; only consumer classes apply. */
  unstyled?: boolean;

  /** Per-slot class overrides merged with (or replacing, when unstyled) tv styles. */
  slotClasses?: Partial<Record<TooltipSlots, string>>;

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Tooltip: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;

  /**
   * Additional CSS class for the tooltip panel.
   *
   * One class to avoid: anything that sets `display`. The panel is a `<span>`
   * that CSS blockifies through its `position: fixed`, and an author-level
   * `display` also beats the UA rule `[popover]:not(:popover-open) { display:
   * none }` — the closed tooltip then keeps a laid-out box, invisible but
   * present in the a11y tree and to find-in-page. The same applies to
   * `slotClasses.base`, a `preset`, and `BlocksProvider` overrides. A unit
   * test holds this component's own variants to the rule; nothing checks
   * what you pass in.
   */
  class?: string;
}

export type { Placement as TooltipPlacement } from '$lib/utils/floating';
export { default as Tooltip } from './Tooltip.svelte';
export { type TooltipVariants, tooltipVariants } from './tooltip.variants';
