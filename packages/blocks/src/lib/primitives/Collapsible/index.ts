import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { CollapsibleSlots, CollapsibleVariants } from './collapsible.variants';

/**
 * Props interface for the Collapsible component
 *
 * @description A single expand/collapse panel with animated content, trigger button,
 * and full ARIA support. Can be used standalone or as the foundation for compound
 * components like Accordion.
 *
 * @tag layout
 * @related Accordion
 * @related Card
 *
 * @example
 * ```svelte
 * <Collapsible title="Show details">
 *   <p>Hidden content revealed when expanded.</p>
 * </Collapsible>
 * ```
 *
 * @example
 * ```svelte
 * <Collapsible bind:open={isOpen} variant="card">
 *   {#snippet trigger({ open, toggle })}
 *     <button onclick={toggle}>
 *       {open ? 'Hide' : 'Show'} settings
 *     </button>
 *   {/snippet}
 *   <SettingsForm />
 * </Collapsible>
 * ```
 */
export interface CollapsibleProps
  extends CollapsibleVariants,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /**
   * Whether the content is visible. Supports bind:open. Trigger-driven transitions
   * are applied optimistically: `open` is updated first, then `onOpenChange` reports
   * the change. When passing `open` without `bind:`, mirror every `onOpenChange`
   * back into your state — an ignored change leaves the component and your source
   * of truth diverged. To conditionally reject transitions, drive `open` from your
   * own state and toggle it from a custom `trigger` snippet instead of calling the
   * provided `toggle`.
   */
  open?: boolean;
  /** Initial open state for uncontrolled usage @default false */
  defaultOpen?: boolean;
  /**
   * Callback fired once per trigger-driven open transition, after the state is
   * applied. Not fired for consumer writes via `bind:open`.
   */
  onOpenChange?: (open: boolean) => void;
  /** Disable the trigger @default false */
  disabled?: boolean;
  /** Trigger label text (used by the default trigger) */
  title?: string;
  /** Custom trigger snippet — receives open state, toggle fn, disabled flag, and ARIA IDs */
  trigger?: Snippet<
    [
      {
        open: boolean;
        toggle: () => void;
        disabled: boolean;
        triggerId: string;
        contentId: string;
      }
    ]
  >;
  /** Collapsible content */
  children: Snippet;
  /** Base name for generating ARIA IDs. Defaults to auto-generated. */
  name?: string;
  /**
   * Override the expand/collapse animation duration in milliseconds. Defaults to the
   * `--blocks-collapse-duration` token (the `normal` 250ms). Set globally via that CSS
   * custom property or per-instance here. Respects `prefers-reduced-motion` (near-instant).
   */
  transitionDuration?: number;
  /**
   * Override the expand/collapse easing as a CSS `<easing-function>` — e.g. `'ease-in-out'`,
   * `'cubic-bezier(0.4,0,0.2,1)'`, or a token such as `'var(--blocks-ease-springy)'`. Defaults
   * to the `--blocks-collapse-easing` token.
   *
   * Note: unlike the overlay components (Dialog/Drawer), whose Svelte transitions take an easing
   * **function** `(t: number) => number`, Collapsible animates via CSS — so its easing is a CSS
   * string. Same intent, representation follows the transition mechanism.
   */
  transitionEasing?: string;
  /** Custom CSS class */
  class?: string;
  /** Remove default styles */
  unstyled?: boolean;
  /** Per-slot class overrides. Slots: base | trigger | chevron | content | contentInner */
  slotClasses?: Partial<Record<CollapsibleSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Collapsible: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as Collapsible } from './Collapsible.svelte';
export { type CollapsibleVariants, collapsibleVariants } from './collapsible.variants';
