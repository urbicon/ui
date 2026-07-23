// Shared file-intake core — the pure logic behind FileUpload's dropzone and
// PromptInput's attachment strip: accept matching, validation, accepted/
// rejected partitioning, preview object-URL lifecycle, size formatting.
//
// Deliberately stateless functions, not a store class: both consumers keep
// their own `$state`/`$bindable` file lists (FileUpload's `bind:files` must
// stay the single source of truth there), and pure functions are node-testable
// without a DOM. Error texts are injected via `FileIntakeMessages` so each
// component keeps its own i18n/label wiring.

// ── Types ────────────────────────────────────────────────────────────────────

export type FileIntakeErrorCode =
  | 'FILE_INVALID_TYPE'
  | 'FILE_TOO_LARGE'
  | 'FILE_TOO_SMALL'
  | 'TOO_MANY_FILES'
  | 'FILE_EXISTS'
  | 'CUSTOM';

export interface FileIntakeError {
  /** Machine-readable error code. */
  code: FileIntakeErrorCode;
  /** Human-readable error message. */
  message: string;
}

export type FileIntakeStatus = 'pending' | 'uploading' | 'complete' | 'error';

export interface FileIntakeEntry {
  /** Unique identifier for this file entry. */
  id: string;
  /** The native File object. */
  file: File;
  /** Object URL for image previews (auto-generated, auto-revoked). */
  preview?: string;
  /** Upload progress 0–100. Undefined when not tracking. */
  progress?: number;
  /** Current lifecycle status. */
  status: FileIntakeStatus;
  /** Validation or upload errors. */
  errors: FileIntakeError[];
}

export interface FileIntakeRejection {
  /** The rejected file. */
  file: File;
  /** Why it was rejected. */
  errors: FileIntakeError[];
}

/** Validation limits shared by every intake surface. */
export interface FileIntakeConstraints {
  /** Accepted MIME types or file extensions (e.g. 'image/*', '.pdf'). */
  accept?: string | string[];
  /** Maximum number of files across the whole list. */
  maxFiles?: number;
  /** Maximum file size in bytes. */
  maxFileSize?: number;
  /** Minimum file size in bytes. */
  minFileSize?: number;
  /** Custom validation function. Return errors array or null. */
  validate?: (file: File) => FileIntakeError[] | null;
}

/** Error-text factories — components inject their i18n/label source here. */
export interface FileIntakeMessages {
  invalidType: (type: string) => string;
  tooLarge: (formattedSize: string) => string;
  tooSmall: (formattedSize: string) => string;
  exists: () => string;
  tooMany: (count: number) => string;
}

// ── Accept matching ──────────────────────────────────────────────────────────

function acceptList(accept: string | string[]): string[] {
  return Array.isArray(accept) ? accept : accept.split(',').map((t) => t.trim());
}

/** Does a picked/dropped file match the accept spec (`.ext`, `type/*`, exact MIME)? */
export function matchesAccept(file: File, accept: string | string[] | undefined): boolean {
  if (!accept) return true;
  return acceptList(accept).some((type) => {
    if (type.startsWith('.')) return file.name.toLowerCase().endsWith(type.toLowerCase());
    if (type.endsWith('/*')) return file.type.startsWith(type.replace('/*', '/'));
    return file.type === type;
  });
}

/**
 * Dragged-over feedback: do ALL items look acceptable? Extension patterns
 * (`.pdf`) match permissively — file names are unavailable during dragenter,
 * so a definitive verdict only exists for MIME patterns.
 */
export function dragItemsMatchAccept(
  items: Iterable<DataTransferItem>,
  accept: string | string[] | undefined
): boolean {
  if (!accept) return true;
  const types = acceptList(accept);
  return Array.from(items).every((item) => {
    if (item.kind !== 'file') return false;
    return types.some((type) => {
      if (type.endsWith('/*')) return item.type.startsWith(type.replace('/*', '/'));
      if (type.startsWith('.')) return true;
      return item.type === type;
    });
  });
}

// ── Validation & partitioning ────────────────────────────────────────────────

/** Validate one file against the constraints and the existing list (duplicates). */
export function validateIntakeFile(
  file: File,
  existing: readonly FileIntakeEntry[],
  constraints: FileIntakeConstraints,
  messages: FileIntakeMessages
): FileIntakeError[] {
  const errors: FileIntakeError[] = [];
  const { accept, maxFileSize = Infinity, minFileSize = 0, validate } = constraints;

  if (accept && !matchesAccept(file, accept)) {
    errors.push({
      code: 'FILE_INVALID_TYPE',
      message: messages.invalidType(file.type || 'unknown')
    });
  }

  if (file.size > maxFileSize) {
    errors.push({
      code: 'FILE_TOO_LARGE',
      message: messages.tooLarge(formatFileSize(maxFileSize))
    });
  }

  if (file.size < minFileSize) {
    errors.push({
      code: 'FILE_TOO_SMALL',
      message: messages.tooSmall(formatFileSize(minFileSize))
    });
  }

  if (existing.some((f) => f.file.name === file.name && f.file.size === file.size)) {
    errors.push({ code: 'FILE_EXISTS', message: messages.exists() });
  }

  if (validate) {
    const custom = validate(file);
    if (custom) errors.push(...custom);
  }

  return errors;
}

let idCounter = 0;

/**
 * Split incoming files into accepted entries (id + pending status + image
 * preview object-URL) and rejections. Files beyond the remaining `maxFiles`
 * budget are rejected with `TOO_MANY_FILES` before any validation runs.
 * The caller owns the returned entries — including revoking their previews
 * (`revokeIntakePreviews`) when they leave the list.
 */
export function partitionIntake(
  incoming: readonly File[],
  existing: readonly FileIntakeEntry[],
  constraints: FileIntakeConstraints,
  messages: FileIntakeMessages,
  idPrefix = 'file'
): { accepted: FileIntakeEntry[]; rejected: FileIntakeRejection[] } {
  const accepted: FileIntakeEntry[] = [];
  const rejected: FileIntakeRejection[] = [];
  const maxFiles = constraints.maxFiles ?? Infinity;

  const remaining = maxFiles - existing.length;
  const toProcess = incoming.slice(0, Math.max(0, remaining));
  const excess = incoming.slice(Math.max(0, remaining));

  for (const file of excess) {
    rejected.push({
      file,
      errors: [{ code: 'TOO_MANY_FILES', message: messages.tooMany(maxFiles) }]
    });
  }

  for (const file of toProcess) {
    const errors = validateIntakeFile(file, existing, constraints, messages);
    if (errors.length > 0) {
      rejected.push({ file, errors });
    } else {
      accepted.push(createIntakeEntry(file, idPrefix));
    }
  }

  return { accepted, rejected };
}

/** Wrap a (pre-validated) file as a pending entry with id and image preview. */
export function createIntakeEntry(file: File, idPrefix = 'file'): FileIntakeEntry {
  return {
    id: `${idPrefix}-${Date.now()}-${++idCounter}`,
    file,
    status: 'pending',
    errors: [],
    preview: isImageFile(file) ? URL.createObjectURL(file) : undefined
  };
}

/** Revoke the preview object-URLs of the given entries (removal/teardown). */
export function revokeIntakePreviews(entries: Iterable<FileIntakeEntry>): void {
  for (const entry of entries) {
    if (entry.preview) URL.revokeObjectURL(entry.preview);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Human-readable file size (`1.5 MB`). Empty string for non-finite values. */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (!Number.isFinite(bytes)) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

/** Is this file an image (drives preview object-URL creation)? */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}
