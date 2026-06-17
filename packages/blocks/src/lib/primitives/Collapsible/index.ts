import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { CollapsibleVariants } from './collapsible.variants';

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
  /** Whether the content is visible. Supports bind:open. */
  open?: boolean;
  /** Initial open state for uncontrolled usage @default false */
  defaultOpen?: boolean;
  /** Callback fired when open state changes */
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
  /** Custom CSS class */
  class?: string;
  /** Remove default styles */
  unstyled?: boolean;
  /** Per-slot class overrides */
  slotClasses?: Partial<
    Record<'base' | 'trigger' | 'chevron' | 'content' | 'contentInner', string>
  >;
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
