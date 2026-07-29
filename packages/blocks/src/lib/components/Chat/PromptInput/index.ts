import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { FileIntakeEntry, FileIntakeRejection } from '$lib/utils/file-intake';
import type { PromptInputSlots, PromptInputVariants } from './prompt-input.variants';

/**
 * @summary The composer: it grows as you type and turns into a stop button while answering.
 * @description The chat composer: an auto-growing textarea in a single bordered
 * surface with a send button that flips to a stop button while a response is
 * streaming. `onSubmit({ text, attachments })` fires with trimmed text when there
 * is content (or at least one attachment); `onStop` fires from the stop button.
 * Attachment intake (paperclip picker, clipboard paste, drag-and-drop, chip strip)
 * reuses the shared `file-intake` core — the same accept/size/count validation and
 * preview-URL lifecycle as FileUpload — and is opt-in via `allowAttachments`.
 *
 * @tag ai
 * @tag form
 * @related Textarea
 * @related FileUpload
 * @related Chat
 * @stability experimental
 *
 * @example
 * ```svelte
 * <PromptInput
 *   bind:value={draft}
 *   busy={isStreaming}
 *   onSubmit={({ text }) => send(text)}
 *   onStop={abort}
 * />
 * ```
 *
 * @example With attachments and Cmd/Ctrl+Enter to send
 * ```svelte
 * <PromptInput
 *   bind:value={draft}
 *   bind:attachments={files}
 *   allowAttachments
 *   accept="image/*"
 *   maxFiles={4}
 *   submitOn="mod-enter"
 *   onSubmit={({ text, attachments }) => send(text, attachments)}
 * />
 * ```
 */
export interface PromptInputProps
  extends PromptInputVariants,
    Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class' | 'onsubmit'> {
  /** The composer's text (bindable). */
  value?: string;
  /** Called whenever the text changes (including the clear after submit). */
  onValueChange?: (value: string) => void;

  /**
   * The accepted attachments (bindable). Populated by the picker / paste / drop
   * when `allowAttachments` is set. On submit these are handed to `onSubmit` and
   * — with `clearOnSubmit` — cleared from here **without** revoking their preview
   * object-URLs, because ownership transfers to the consumer's message list.
   *
   * Removing chips through the built-in UI revokes their preview URLs for you.
   * Clearing or splicing this array **externally** (e.g. reassigning
   * `bind:attachments`) bypasses that cleanup — such mutations must revoke the
   * dropped entries' previews themselves via `revokeIntakePreviews` (exported
   * from `$lib/utils/file-intake`) to avoid leaking object-URLs.
   */
  attachments?: FileIntakeEntry[];

  /**
   * Fired on send with the trimmed text and the current attachments. Only fires
   * when there is text or at least one attachment, and never while `busy` or
   * `disabled`.
   */
  onSubmit: (payload: { text: string; attachments: FileIntakeEntry[] }) => void;
  /** Fired by the stop button (shown in place of send while `busy`). */
  onStop?: () => void;
  /**
   * Called with the rejected files when an add is refused (bad type, too large,
   * over `maxFiles`, duplicate, or custom `validate`). The first rejection's
   * message also surfaces inline; it clears on the next successful add.
   */
  onAttachmentReject?: (rejections: FileIntakeRejection[]) => void;

  /**
   * Which key gesture sends the message.
   * - `enter` (default) — Enter sends, Shift+Enter inserts a newline.
   * - `mod-enter` — Cmd/Ctrl+Enter sends, Enter inserts a newline.
   *
   * Submission is always suppressed mid-IME-composition.
   * @default 'enter'
   * @summary Which key gesture sends the message, and which one inserts a newline.
   */
  submitOn?: 'enter' | 'mod-enter';

  /**
   * Clear the text and attachments after a successful submit. Preview URLs of
   * the submitted attachments are intentionally **not** revoked — see
   * `attachments`.
   * @default true
   */
  clearOnSubmit?: boolean;

  /** Placeholder text for the textarea. */
  placeholder?: string;
  /** Disables the whole composer (textarea + buttons). @default false */
  disabled?: boolean;
  /**
   * A response is in flight: the send button is replaced by a stop button and
   * Enter no longer submits.
   * @default false
   */
  busy?: boolean;
  /** Focus the textarea on mount. @default false */
  autofocus?: boolean;

  /** Minimum visible rows of the auto-growing textarea. @default 1 */
  minRows?: number;
  /** Maximum visible rows before the textarea scrolls internally. @default 8 */
  maxRows?: number;

  /** Accessible name for the textarea (rendered as `aria-label`). @default 'Message' */
  label?: string;
  /** Accessible label for the send button. @default 'Send' */
  sendLabel?: string;
  /** Accessible label for the stop button. @default 'Stop' */
  stopLabel?: string;
  /** Accessible label for the attach button. @default 'Attach file' */
  attachLabel?: string;
  /** Accessible label factory for a chip's remove button. @default (name) => `Remove ${name}` */
  removeAttachmentLabel?: (name: string) => string;

  /**
   * Enable the attachment surface: paperclip picker, clipboard-image paste,
   * drag-and-drop, and the chip strip above the textarea.
   * @default false
   * @summary Turns on the attachment surface: picker, paste, drag-and-drop, and the chip strip.
   */
  allowAttachments?: boolean;
  /**
   * Prevent browser navigation when a file is dropped outside the composer.
   * Only takes effect while `allowAttachments` is set. @default true
   */
  preventDocumentDrop?: boolean;
  /** Accepted MIME types / extensions (e.g. `'image/*'`, `['.pdf', 'image/png']`). */
  accept?: string | string[];
  /** Maximum number of attachments across the whole list. */
  maxFiles?: number;
  /** Maximum attachment size in bytes. */
  maxFileSize?: number;
  /** Custom per-file validation. Return an errors array or `null`. */
  validate?: (file: File) => FileIntakeEntry['errors'] | null;

  /** Content in the leading (left) action zone, after the attach button. */
  leading?: Snippet;
  /** Content in the trailing (right) action zone, before the send/stop button. */
  trailing?: Snippet;
  /** Helper line rendered under the composer (e.g. "Enter to send"). */
  hint?: Snippet;

  /** Extra classes merged onto the root element. */
  class?: string;
  /** Remove all default tv() classes. */
  unstyled?: boolean;
  /**
   * Per-slot class overrides. Slots: root | attachmentsStrip | attachmentChip |
   * attachmentThumb | attachmentName | attachmentSize | attachmentRemove |
   * textarea | actions | leading | trailing | attachButton | sendButton |
   * stopButton | error | hint
   */
  slotClasses?: Partial<Record<PromptInputSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ PromptInput: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette.
   */
  preset?: string;
}

export { default as PromptInput } from './PromptInput.svelte';
export { type PromptInputVariants, promptInputVariants } from './prompt-input.variants';
