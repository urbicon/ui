import type { Snippet } from 'svelte';
import type { HTMLDialogAttributes } from 'svelte/elements';
import type { DialogSlots, DialogVariants } from './dialog.variants';

/**
 * @description Overlay dialog built on native dialog element. Can be used as a simple
 * content-agnostic overlay or as a structured dialog with title, footer, and intent accent.
 *
 * @tag overlay
 * @related Drawer
 *
 * @example Simple (content-only)
 * ```svelte
 * <Dialog bind:open>
 *   <p>Are you sure?</p>
 *   <Button onclick={() => (open = false)}>Close</Button>
 * </Dialog>
 * ```
 *
 * @example Structured (title + footer)
 * ```svelte
 * <Dialog bind:open title="Confirm deletion" intent="danger">
 *   <p>This action cannot be undone.</p>
 *   {#snippet footer()}
 *     <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
 *     <Button intent="danger" onclick={handleDelete}>Delete</Button>
 *   {/snippet}
 * </Dialog>
 * ```
 */
export interface DialogProps extends Omit<HTMLDialogAttributes, 'children' | 'open'> {
  /** Controls whether the dialog is visible. Supports bind:open. */
  open?: boolean;

  /** Dialog body content. When `title` is omitted the content fills the entire panel. */
  children: Snippet;

  /** Action buttons rendered in a footer bar. Only rendered when provided. */
  footer?: Snippet;

  /** Heading displayed in a header bar. Enables the structured header/body/footer layout. */
  title?: string;

  /** Controls the maximum width of the dialog panel. @default 'sm' */
  size?: DialogVariants['size'];

  /** Vertical placement within the viewport. Use 'top' for command-palette style positioning. @default 'center' */
  placement?: DialogVariants['placement'];

  /**
   * Semantic purpose marker (e.g. `danger` for destructive actions). After the
   * Lighter-Refactor, the Dialog itself no longer paints an accent bar — the
   * value is exposed on the panel as `data-intent="…"` so consumers can hook
   * presets, CSS overrides, or icon/title color via their own snippets.
   * @default 'neutral'
   */
  intent?: DialogVariants['intent'];

  /** Whether clicking the backdrop dismisses the dialog. @default true */
  closeOnBackdropClick?: boolean;

  /** Whether pressing Escape dismisses the dialog. @default true */
  closeOnEscape?: boolean;

  /**
   * Hides the built-in close button. Only takes effect when `title` is
   * also set — the close button only renders in the structured (titled)
   * header. Without a title, no close button exists to hide.
   * @default false
   */
  hideCloseButton?: boolean;

  /**
   * Override the enter/exit animation duration in milliseconds.
   * Defaults to the overlay token `--blocks-overlay-enter-duration` /
   * `--blocks-overlay-exit-duration` (200ms / 180ms). Set globally via
   * the CSS custom properties or per-instance via this prop. Respects
   * `prefers-reduced-motion`.
   */
  transitionDuration?: number;

  /** Override the enter/exit easing function. Defaults to the overlay token easing (`quintOut`). */
  transitionEasing?: (t: number) => number;

  /** Fires when the dialog is dismissed via Escape, backdrop click, or close button. */
  onClose?: () => void;

  /** Additional CSS classes applied to the dialog panel. */
  class?: string;

  /** Strip all default styles. Combine with slotClasses for fully custom appearance. */
  unstyled?: boolean;

  /** Per-slot class overrides merged with variant styles. */
  slotClasses?: Partial<Record<DialogSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Dialog: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

/**
 * Maximum-width preset for the dialog panel. Mirrors the `size` variant
 * exposed via {@link DialogProps.size}.
 */
export type DialogSize = NonNullable<DialogVariants['size']>;

/**
 * Vertical placement of the dialog within the viewport.
 */
export type DialogPlacement = NonNullable<DialogVariants['placement']>;

/**
 * Accent intent of the dialog header strip.
 */
export type DialogIntent = NonNullable<DialogVariants['intent']>;

export { default as Dialog } from './Dialog.svelte';
export { type DialogVariants, dialogVariants } from './dialog.variants';
