import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { Placement } from '$lib/utils/floating';
import type { PopoverVariants } from './popover.variants';

/**
 * @summary A floating panel that hangs off a trigger and closes when you look away.
 * @description Floating panel anchored to a trigger element. Uses the native Popover API
 * for top-layer rendering, light dismiss, and Escape handling. The library's built-in
 * positioning engine provides automatic flip, shift, and optional width syncing.
 *
 * @tag overlay
 * @related Tooltip
 * @related Menu
 *
 * @example
 * ```svelte
 * <Popover placement="bottom-start">
 *   {#snippet trigger()}
 *     <Button>Open</Button>
 *   {/snippet}
 *   {#snippet children()}
 *     <div class="p-3">Popover content</div>
 *   {/snippet}
 * </Popover>
 * ```
 *
 * @example
 * ```svelte
 * <Popover placement="top" arrow bind:open={showInfo}>
 *   {#snippet trigger()}
 *     <Button variant="ghost" size="sm">More info</Button>
 *   {/snippet}
 *   {#snippet children()}
 *     <div class="max-w-xs p-4">
 *       <h4 class="font-semibold">Details</h4>
 *       <p class="text-text-secondary text-sm">Additional context shown in a floating panel.</p>
 *     </div>
 *   {/snippet}
 * </Popover>
 * ```
 */
export interface PopoverProps
  extends PopoverVariants,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  // ── Content ──────────────────────────────────────────
  /** Popover body rendered inside the floating panel. */
  children: Snippet;
  /** Trigger element that anchors and toggles the popover. Receives click/keyboard handlers when `autoTrigger` is true. */
  trigger?: Snippet;
  /** External trigger element ref. Use instead of the `trigger` snippet when the trigger lives outside the Popover tree. Supports `bind:triggerElement`. */
  triggerElement?: HTMLElement;

  // ── Positioning ──────────────────────────────────────
  /**
   * Where the popover appears relative to the trigger. All standard
   * `Placement` values (side plus optional `-start`/`-end` alignment) are
   * supported.
   * @summary Which side of the trigger the popover opens on, and how it aligns there.
   */
  placement?: Placement;
  /** Gap in px between the trigger edge and the popover. */
  offsetDistance?: number;
  /** Minimum px padding from viewport edges when the popover shifts to stay visible. */
  shiftPadding?: number;
  /**
   * Match the popover width to the trigger width. Useful for
   * select/autocomplete patterns where the floating panel should align with
   * the input.
   * @summary Match the panel width to the trigger, as select and autocomplete patterns want.
   */
  syncWidth?: boolean;
  /** Match the popover's *minimum* width to the trigger width while still letting content grow the panel beyond it. Useful for menu-style overlays where items longer than the trigger should not get truncated. Ignored when `syncWidth` is true (hard width wins). */
  syncMinWidth?: boolean;

  /**
   * Render the floating panel into the browser's top layer via the native
   * `popover` attribute, so it cannot be clipped by `overflow: auto` ancestors.
   * Set to `false` when the popover is itself embedded inside another floating
   * surface (Dialog, Drawer, another Popover) — nested top-layer rendering
   * stacks unpredictably across browsers and stealing focus from the parent
   * surface is usually unwanted. In-flow mode positions the panel absolutely
   * relative to the trigger's offset parent.
   * @default true
   */
  usePortal?: boolean;

  // ── State ────────────────────────────────────────────
  /** Controlled open state. Supports `bind:open`. */
  open?: boolean;
  /** When true (default), the trigger wrapper handles click and keyboard to toggle the popover. Set to `false` to manage `open` yourself. */
  autoTrigger?: boolean;

  // ── Motion ───────────────────────────────────────────
  /**
   * Override the enter/exit fade duration in ms. Defaults to the shared token
   * `--blocks-popover-duration` (150ms; collapses to 1ms under
   * `prefers-reduced-motion`).
   */
  transitionDuration?: number;
  /**
   * Override the enter/exit easing as a CSS `<easing-function>` (e.g.
   * `'linear'`, `'ease-out'`, `'cubic-bezier(0.4,0,0.2,1)'`). Defaults to the
   * token `--blocks-popover-easing`. A CSS string, not a JS easing fn, because
   * the popover motion is a pure CSS transition.
   */
  transitionEasing?: string;

  // ── Dismiss behavior ─────────────────────────────────
  /**
   * Whether the popover closes on Escape key. Default `true`.
   * Set to `false` for cases where Escape should be intercepted by an
   * inner widget (e.g. an editable cell that wants to revert on Escape).
   */
  closeOnEscape?: boolean;
  /**
   * Whether the popover closes on outside click / pointer interaction.
   * Default `true`. Set to `false` to pin the popover open until the
   * consumer explicitly toggles `open`.
   */
  closeOnClickOutside?: boolean;

  // ── Callbacks ────────────────────────────────────────
  /** Fires when the popover opens or closes from user interaction (click, escape, click-outside). Receives the new open state. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Fires after an outside click closes the popover. Use for analytics
   * or to clear ephemeral state on dismiss. Does NOT control whether the
   * popover closes — that is governed by `closeOnClickOutside`.
   */
  onClickOutside?: () => void;
  /**
   * Fires after Escape closes the popover. Use for analytics or to clear
   * ephemeral state on dismiss. Does NOT control whether the popover
   * closes — that is governed by `closeOnEscape`.
   */
  onEscape?: () => void;

  // ── Styling ──────────────────────────────────────────
  /** Extra classes merged onto the floating panel element. */
  class?: string;
  /** Strip all default tv() classes (including the enter/exit motion). Combine with `class` or `slotClasses` for full custom styling; the panel always carries `data-state="open" | "closed"`, so custom motion can rebuild on that hook (see `popoverMotion` in popover.variants.ts for the reference implementation). */
  unstyled?: boolean;
  /** Per-slot class overrides. Available slots: `base` (the floating panel). */
  slotClasses?: Partial<Record<'base', string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Popover: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as Popover } from './Popover.svelte';
export { type PopoverVariants, popoverMotion, popoverVariants } from './popover.variants';
