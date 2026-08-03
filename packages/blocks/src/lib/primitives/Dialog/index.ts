import type { Snippet } from 'svelte';
import type { HTMLDialogAttributes } from 'svelte/elements';
import type { DialogSlots, DialogVariants } from './dialog.variants';

/**
 * @summary A window over the page for something that needs finishing first.
 * @description Overlay dialog built on native dialog element. Can be used as a simple
 * content-agnostic overlay or as a structured dialog with title, optional header icon and
 * footer. `intent` tints the header markers (title, icon) and is exposed as `data-intent`
 * on the panel; the panel surface itself stays neutral, because a tinted surface under a
 * consumer's form or table would hijack that content's contrast ratios.
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
export interface DialogProps extends Omit<HTMLDialogAttributes, 'children' | 'open' | 'draggable'> {
  /** Controls whether the dialog is visible. Supports bind:open. */
  open?: boolean;

  /** Dialog body content. When `title` is omitted the content fills the entire panel. */
  children: Snippet;

  /** Action buttons rendered in a footer bar. Only rendered when provided. */
  footer?: Snippet;

  /** Heading displayed in a header bar. Enables the structured header/body/footer layout. */
  title?: string;

  /**
   * Icon rendered before the title in the header bar. Takes its colour from
   * `intent`, so a bare icon component is enough — no wrapper needed. Marked
   * `aria-hidden`: it repeats the intent the title already carries in words.
   * Requires `title` (no header renders without one).
   */
  icon?: Snippet;

  /** Controls the maximum width of the dialog panel. @default 'sm' */
  size?: DialogVariants['size'];

  /** Vertical placement within the viewport. Use 'top' for command-palette style positioning. @default 'center' */
  placement?: DialogVariants['placement'];

  /**
   * Semantic purpose marker (e.g. `danger` for destructive actions). Tints the
   * header markers — the title and, when given, `icon`. The panel surface stays
   * neutral by design: this is a container for arbitrary content, and a tinted
   * surface would hijack the contrast ratios of the form, table or code block
   * inside it (the Toast makes the same split). The value is additionally
   * exposed on the panel as `data-intent="…"` for presets and CSS overrides.
   * @default 'neutral'
   * @summary Colours the title and header icon; the panel itself stays neutral.
   */
  intent?: DialogVariants['intent'];

  /**
   * Whether clicking the backdrop dismisses the dialog.
   *
   * Turning this off together with `closeOnEscape` and `hideCloseButton` is a
   * legitimate pattern for a forced choice (terms to accept, data loss to
   * confirm, an expired session) — but only when the dialog itself renders the
   * action that resolves it. Without one there is no way out, and DEV warns.
   * @default true
   * @summary Whether a click on the backdrop dismisses the dialog.
   */
  closeOnBackdropClick?: boolean;

  /**
   * Whether pressing Escape dismisses the dialog.
   *
   * The ARIA APG recommends Escape and does not forbid disabling it; the same
   * condition as {@link closeOnBackdropClick} applies — with every exit closed,
   * the dialog must carry its own action.
   *
   * Escape is dismissed one layer at a time: a control INSIDE the dialog that
   * handles Escape itself — an open `Select`/`Combobox`/`Menu` panel, a
   * `clearable` `Input` with text in it — consumes the key, and the dialog stays
   * up. The second Escape closes the dialog. This is about controls in the
   * content; it does not apply to a consumer `onkeydown` on the Dialog itself,
   * which cannot veto the dismiss (see utils/compose-handlers.ts) — use this
   * prop for that.
   * @default true
   * @summary Whether the Escape key dismisses the dialog.
   */
  closeOnEscape?: boolean;

  /**
   * Let the user reposition the dialog by dragging its header. Off by default.
   * The structured header (rendered when `title` is set) becomes the drag
   * handle; the close button and any header controls stay clickable, and the
   * offset resets each time the dialog reopens. Most useful for a dialog the
   * user may want to shove aside to see the content behind it. Requires a
   * `title` — without a header there is nothing to grab. Overrides the native
   * HTML `draggable` attribute, which has no meaningful use on a dialog.
   * @default false
   */
  draggable?: boolean;

  /**
   * Hides the built-in close button. Only takes effect when `title` is
   * also set — the close button only renders in the structured (titled)
   * header. Without a title, no close button exists to hide.
   *
   * The last of the three exits; see {@link closeOnBackdropClick} for what
   * closing all of them requires.
   * @default false
   * @summary Hides the built-in close button. Only a titled dialog has one.
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
 * Semantic intent of the dialog. Tints the header markers (title, icon) and is
 * mirrored on the panel as `data-intent`.
 */
export type DialogIntent = NonNullable<DialogVariants['intent']>;

export { default as Dialog } from './Dialog.svelte';
export { type DialogVariants, dialogVariants } from './dialog.variants';
