import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { MintProp } from '#lib/mint/index.js';
import type { FileUploadSlots, FileUploadVariants } from './fileUpload.variants';

// ── Error Codes & File Wrapper ────────────────────────────────────────────────
//
// These types are re-exported aliases of the shared file-intake core
// (`#lib/utils/file-intake.js`) — the single source of truth for FileUpload and
// PromptInput. The public FileUpload names are preserved for API stability.

import type {
  FileIntakeRejection as FileRejection,
  FileIntakeError as FileUploadError,
  FileIntakeErrorCode as FileUploadErrorCode,
  FileIntakeEntry as FileUploadFile,
  FileIntakeStatus as FileUploadStatus
} from '#lib/utils/file-intake.js';

export type {
  FileRejection,
  FileUploadError,
  FileUploadErrorCode,
  FileUploadFile,
  FileUploadStatus
};

// ── MIME Presets ──────────────────────────────────────────────────────────────

export const IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif'
];
export const PDF_MIME_TYPE = ['application/pdf'];
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
export const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'];

// ── Snippet Contexts ─────────────────────────────────────────────────────────

export interface FileItemContext {
  /** The file entry. */
  fileEntry: FileUploadFile;
  /** Remove this file from the list. */
  remove: () => void;
}

// ── Slot Names ───────────────────────────────────────────────────────────────

/** Slot names for `slotClasses` — derived from the `tv()` config (single source of truth). */
export type FileUploadSlotName = FileUploadSlots;

// ── Props ────────────────────────────────────────────────────────────────────

/**
 * @summary Drop files here: validation, previews and progress included.
 * @description Drag-and-drop file upload with validation, image previews, progress tracking, and animated file list.
 * The root is a `region` landmark, named by an `aria-label` you pass or else the localized
 * "File upload" — give each one its own name when a page has two.
 *
 * The focusable control is the visually hidden `<input type="file">`, not the dropzone. `id`,
 * `aria-labelledby`, `aria-describedby`, `aria-invalid` and `aria-required` land on it, so a
 * `<label for>` (as FormField renders) names it and a click on the label opens the file dialog;
 * every other attribute, `class` and `aria-label` included, stays on the root. Label it, through
 * FormField or `aria-labelledby`: without a label the browser names the input by its own button
 * text — in Chromium "Choose Files", or "Choose File" once `maxFiles` is 1 and `multiple` is off —
 * and the dropzone text is its description. The `title` it carries, the region's name, only
 * satisfies axe's WCAG `label` rule; axe's best-practice `label-title-only` still reports an
 * unlabelled one. While `maxFiles` is reached the dropzone is gone and the input leaves the tab
 * order, but stays the label's target.
 * @tag form
 * @related Input
 * @related Button
 * @related Progress
 *
 * @example
 * ```svelte
 * <FileUpload
 *   bind:files
 *   multiple
 *   maxFiles={5}
 *   maxFileSize={10 * 1024 * 1024}
 *   title="Drop files here or click to browse"
 *   description="PDF, DOCX, XLSX — max 10 MB per file"
 * />
 * ```
 *
 * @example
 * ```svelte
 * <FileUpload
 *   bind:files
 *   accept={IMAGE_MIME_TYPES}
 *   multiple
 *   maxFiles={8}
 *   title="Upload images"
 *   description="PNG, JPG, WebP — max 5 MB"
 *   onFileReject={(rejections) => console.log('Rejected:', rejections)}
 * />
 * ```
 */
export interface FileUploadProps
  extends Omit<FileUploadVariants, 'dragging' | 'invalid'>,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  // ── Content ──
  /**
   * Default slot for fully custom dropzone content. Its text becomes the file input's
   * description, since the dropzone itself takes no focus.
   */
  children?: Snippet;
  /** Custom file item renderer. Receives file entry and remove callback. */
  fileItem?: Snippet<[FileItemContext]>;
  /** Custom dropzone icon snippet. */
  dropzoneIcon?: Snippet;
  /** Dropzone title text. */
  title?: string;
  /** Dropzone description text (accepted types, limits). */
  description?: string;

  // ── File constraints ──
  /** Accepted MIME types or file extensions (e.g. 'image/*', '.pdf'). */
  accept?: string | string[];
  /** Maximum number of files. */
  maxFiles?: number;
  /** Maximum file size in bytes. */
  maxFileSize?: number;
  /** Minimum file size in bytes. */
  minFileSize?: number;
  /** Allow selecting multiple files. */
  multiple?: boolean;
  /** Custom validation function. Return errors array or null. */
  validate?: (file: File) => FileUploadError[] | null;

  // ── Behavior ──
  /** Enable drag-and-drop. @default true */
  allowDrop?: boolean;
  /** Enable paste from clipboard. @default false */
  allowPaste?: boolean;
  /** Prevent browser navigation when files are dropped outside the zone. @default true */
  preventDocumentDrop?: boolean;
  /** Disable all interaction. */
  disabled?: boolean;
  /** Mark as required for form validation. */
  required?: boolean;
  /**
   * Shared `name` for native form submission. When set, the underlying
   * `<input type="file">` carries the current file list — including
   * files added via drag/drop, paste, or programmatic `bind:files`, not
   * just files picked through the file dialog. Submits as a `File[]` under
   * `{name}` in the FormData payload.
   */
  name?: string;

  // ── State (bindable) ──
  /** Current file list. Supports two-way binding. */
  files?: FileUploadFile[];

  /**
   * Convenience binding for single-file uses. Two-way:
   * - Reads as `files[0]?.file ?? null`.
   * - Setting to a `File` replaces the current selection (object URLs are
   *   revoked, no validation re-runs — assumes the caller already validated).
   * - Setting to `null` clears the list.
   *
   * Recommended when `maxFiles === 1` (e.g. logo / avatar uploads). Use
   * `bind:files` instead when you need progress, errors, or status metadata.
   */
  file?: File | null;

  // ── Callbacks ──
  /** Fires when valid files are accepted. */
  onFileAccept?: (files: FileUploadFile[]) => void;
  /** Fires when files are rejected by validation. */
  onFileReject?: (rejections: FileRejection[]) => void;
  /** Fires when the file list changes (add or remove). */
  onFilesChange?: (files: FileUploadFile[]) => void;
  /** Fires when a file is removed. */
  onFileRemove?: (file: FileUploadFile) => void;

  // ── Mint ──
  /**
   * Micro-interaction preset applied to the dropzone. Only applies while
   * not disabled.
   * @default 'none'
   */
  mint?: MintProp;

  // ── Styling ──
  /** Additional CSS class for the root element. */
  class?: string;
  /**
   * Remove the default variant classes. The control's own classes stay: `sr-only peer` on the
   * file input hides it and relays its focus ring to the dropzone, and `relative` on the root
   * keeps the input's focus scroll inside the scroller the upload sits in.
   */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<Record<FileUploadSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ FileUpload: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as FileUpload } from './FileUpload.svelte';
export { type FileUploadVariants, fileUploadVariants } from './fileUpload.variants';
