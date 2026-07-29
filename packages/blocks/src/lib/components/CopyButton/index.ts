import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import type { CopyPhase } from '$lib/internal/copy-state.svelte';
import type { ButtonProps } from '$lib/primitives/Button';
import type { CopyButtonSlots } from './copy-button.variants';

/**
 * @summary Copies a value to the clipboard and says so.
 * @description One-tap copy-to-clipboard button with built-in success feedback (the icon
 * swaps to a check and the intent flips to success for a moment). Icon-only by default;
 * pass `label` for the string shorthand or `children` to fill it like any other Button.
 * Forwards `variant`/`intent`/`size`/`tier` to the underlying Button, so it inherits the
 * full button styling vocabulary.
 *
 * @tag action
 * @related Button
 * @related Kbd
 * @related Tooltip
 * @stability beta
 *
 * @example
 * ```svelte
 * <CopyButton value="npm i @urbicon-ui/blocks" />
 * ```
 *
 * @example
 * ```svelte
 * <CopyButton value={apiKey} label="Copy key" variant="outlined" />
 * ```
 */
export interface CopyButtonProps
  extends Pick<ButtonProps, 'variant' | 'intent' | 'size' | 'tier' | 'disabled'>,
    // `children` is omitted from the HTML attributes and redeclared below: the
    // DOM typing has it as `Snippet<[]>`, and this one takes the copy phase.
    Omit<HTMLButtonAttributes, 'value' | 'onclick' | 'class' | 'disabled' | 'children'> {
  /** The text written to the clipboard when pressed. */
  value: string;
  /** Optional visible label next to the icon. When omitted the button is icon-only. */
  label?: string;
  /**
   * Button content, like any other Button — an icon plus text, a `Kbd`, whatever
   * the action needs. Wins over `label`, which stays as the string shorthand for
   * the common case. Receives the copy phase, so the content can answer the copy
   * itself; ignoring the argument keeps the content static while the icon and
   * intent still flip.
   *
   * @example
   * ```svelte
   * <CopyButton value={apiKey}>
   *   {#snippet children(phase)}
   *     {phase === 'copied' ? 'In your clipboard' : 'Copy API key'}
   *   {/snippet}
   * </CopyButton>
   * ```
   */
  children?: Snippet<[CopyPhase]>;
  /** Visible label shown for `timeout` ms after a successful copy. @default the i18n "Copied" string */
  copiedLabel?: string;
  /** How long the success/error state stays before reverting, in ms. `0` keeps it until the next copy. @default 2000 */
  timeout?: number;
  /** Hide the copy/check icon (label-only). @default false */
  hideIcon?: boolean;
  /** Called with `value` after it is written to the clipboard. */
  onCopy?: (value: string) => void;
  /** Called with the thrown error when the clipboard write fails (permission denied, insecure context, …). */
  onError?: (error: unknown) => void;
  /** Additional CSS class merged onto the underlying Button. */
  class?: string;
  /** Strip all default styles; forwarded to the underlying Button. */
  unstyled?: boolean;
  /** Per-slot class overrides. Slots: base | icon | label */
  slotClasses?: Partial<Record<CopyButtonSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ CopyButton: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent.
   */
  preset?: string;
}

/** Phase handed to the `children` snippet: `idle` | `copied` | `error`. */
export type { CopyPhase } from '$lib/internal/copy-state.svelte';
export { default as CopyButton } from './CopyButton.svelte';
export { type CopyButtonVariants, copyButtonVariants } from './copy-button.variants';
