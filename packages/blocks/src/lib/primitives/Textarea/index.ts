import type { HTMLTextareaAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { TextareaSlots, TextareaVariants } from './textarea.variants';

/**
 * @summary Multi-line text that grows with what you write.
 * @description Multi-line text input with auto-resize, character counter, and validation states.
 * Shares the same variant/intent/size system as Input for visual consistency.
 *
 * @tag form
 *
 * @example
 * ```svelte
 * <Textarea label="Description" placeholder="Tell us more..." bind:value={text} />
 * ```
 *
 * @example
 * ```svelte
 * <Textarea label="Bio" maxlength={280} showCounter autoResize />
 * ```
 */
export interface TextareaProps
  extends Omit<TextareaVariants, 'error' | 'counterState' | 'variant'>,
    Omit<HTMLTextareaAttributes, 'size' | 'class' | 'children'> {
  /**
   * Visual style.
   * - `outlined` (default) — visible border, surface-base background
   * - `filled` — surface-interactive fill, no border
   * - `ghost` — transparent until hover/focus
   * - `underline` — bottom-line only, no border-box (editorial style)
   *
   * @default 'outlined'
   * @summary Visual style of the field: bordered, filled, transparent, or a bottom line.
   */
  variant?: TextareaVariants['variant'];

  /** Label text displayed above the textarea, auto-linked via `for`/`id`. */
  label?: string;

  /** Error message below the textarea. Overrides `helper` and forces danger border styling. */
  error?: string;

  /** Helper text below the textarea. Hidden when `error` is set. */
  helper?: string;

  /** Show a live character counter. Requires `maxlength` to display remaining count. */
  showCounter?: boolean;

  /** Character threshold (percentage of maxlength) at which the counter turns warning color. @default 0.9 */
  counterWarningThreshold?: number;

  /**
   * Automatically grow the textarea height to fit content. Disables manual resize handle.
   * @default false
   */
  autoResize?: boolean;

  /** Minimum number of visible text rows. @default 3 */
  minRows?: number;

  /** Maximum number of visible text rows when autoResize is enabled. */
  maxRows?: number;

  /** @default false */
  disabled?: boolean;

  /** @default false */
  readonly?: boolean;

  /** Adds a required asterisk to the label and sets the native `required` attribute. @default false */
  required?: boolean;

  /**
   * Micro-interaction preset applied to the textarea element. Only applies
   * while not disabled.
   * @default 'none'
   */
  mint?: MintProp;

  /** Extra classes merged onto the root wrapper element. */
  class?: string;

  /** Remove all default tv() classes. Only user-provided classes apply. */
  unstyled?: boolean;

  /**
   * Per-slot class overrides merged with tv() styles. Slots: wrapper (root —
   * what `class` also targets) | base (the `<textarea>` element) | label |
   * footer | message | counter.
   */
  slotClasses?: Partial<Record<TextareaSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Textarea: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as Textarea } from './Textarea.svelte';
export { type TextareaVariants, textareaVariants } from './textarea.variants';
