// Unit tests for the shared file-intake core (node environment — pure logic,
// no DOM). The object-URL browser API is stubbed deterministically so preview
// creation/revocation is observable off the main thread.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createIntakeEntry,
  dragItemsMatchAccept,
  type FileIntakeEntry,
  type FileIntakeMessages,
  formatFileSize,
  isImageFile,
  matchesAccept,
  partitionIntake,
  revokeIntakePreviews,
  validateIntakeFile
} from './file-intake';

// ── Fixtures ───────────────────────────────────────────────────────────────

/** Build a File with an exact byte size and MIME type. */
function makeFile(name: string, size: number, type = ''): File {
  return new File([new Uint8Array(size)], name, { type });
}

/** Cast minimal `{ kind, type }` literals as DataTransferItem for drag tests. */
function dragItems(...defs: { kind: string; type: string }[]): DataTransferItem[] {
  return defs as unknown as DataTransferItem[];
}

/** Identifiable message stubs so tests can assert which factory fired + its arg. */
const messages: FileIntakeMessages = {
  invalidType: (type) => `invalid:${type}`,
  tooLarge: (size) => `large:${size}`,
  tooSmall: (size) => `small:${size}`,
  exists: () => 'exists',
  tooMany: (count) => `many:${count}`
};

// ── Object-URL stub (browser-only API absent in node) ────────────────────────

let stubUrlSeq = 0;
const realCreate = URL.createObjectURL;
const realRevoke = URL.revokeObjectURL;

beforeEach(() => {
  // Guard: if the runtime lacks the object-URL API (node), inject a stub; if it
  // has one (some bundlers/bun), still override for a deterministic return.
  stubUrlSeq = 0;
  URL.createObjectURL = vi.fn(() => `blob:stub-${++stubUrlSeq}`) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
});

afterEach(() => {
  URL.createObjectURL = realCreate;
  URL.revokeObjectURL = realRevoke;
  vi.restoreAllMocks();
});

// ── matchesAccept ────────────────────────────────────────────────────────────

describe('matchesAccept', () => {
  it('returns true when accept is undefined (no constraint)', () => {
    expect(matchesAccept(makeFile('a.bin', 1, 'application/octet-stream'), undefined)).toBe(true);
  });

  it('matches file extensions case-insensitively', () => {
    expect(matchesAccept(makeFile('photo.PNG', 1, ''), '.png')).toBe(true);
    expect(matchesAccept(makeFile('photo.png', 1, ''), '.PNG')).toBe(true);
    expect(matchesAccept(makeFile('doc.pdf', 1, ''), '.png')).toBe(false);
  });

  it('matches a type/* prefix pattern', () => {
    expect(matchesAccept(makeFile('a', 1, 'image/png'), 'image/*')).toBe(true);
    expect(matchesAccept(makeFile('a', 1, 'text/plain'), 'image/*')).toBe(false);
  });

  it('matches an exact MIME type', () => {
    expect(matchesAccept(makeFile('a.pdf', 1, 'application/pdf'), 'application/pdf')).toBe(true);
    expect(matchesAccept(makeFile('a.pdf', 1, 'application/json'), 'application/pdf')).toBe(false);
  });

  it('accepts an array of patterns (any match)', () => {
    const accept = ['.pdf', 'image/*'];
    expect(matchesAccept(makeFile('a', 1, 'image/jpeg'), accept)).toBe(true);
    expect(matchesAccept(makeFile('a.pdf', 1, ''), accept)).toBe(true);
    expect(matchesAccept(makeFile('a.txt', 1, 'text/plain'), accept)).toBe(false);
  });

  it('splits and trims a comma-separated accept string', () => {
    const accept = 'image/*, .pdf';
    expect(matchesAccept(makeFile('a', 1, 'image/png'), accept)).toBe(true);
    expect(matchesAccept(makeFile('a.pdf', 1, ''), accept)).toBe(true);
    expect(matchesAccept(makeFile('a', 1, 'text/plain'), accept)).toBe(false);
  });
});

// ── dragItemsMatchAccept ─────────────────────────────────────────────────────

describe('dragItemsMatchAccept', () => {
  it('returns true when accept is undefined', () => {
    expect(dragItemsMatchAccept(dragItems({ kind: 'file', type: 'text/plain' }), undefined)).toBe(
      true
    );
  });

  it('returns false when any item is not a file', () => {
    const items = dragItems(
      { kind: 'file', type: 'image/png' },
      { kind: 'string', type: 'text/plain' }
    );
    expect(dragItemsMatchAccept(items, 'image/*')).toBe(false);
  });

  it('treats .ext patterns permissively (names unknown during dragenter)', () => {
    // No file name available, so an extension constraint can only pass permissively.
    expect(dragItemsMatchAccept(dragItems({ kind: 'file', type: '' }), '.pdf')).toBe(true);
  });

  it('matches a type/* prefix on the item MIME', () => {
    expect(dragItemsMatchAccept(dragItems({ kind: 'file', type: 'image/gif' }), 'image/*')).toBe(
      true
    );
    expect(dragItemsMatchAccept(dragItems({ kind: 'file', type: 'text/plain' }), 'image/*')).toBe(
      false
    );
  });

  it('matches an exact MIME on the item', () => {
    expect(
      dragItemsMatchAccept(dragItems({ kind: 'file', type: 'application/pdf' }), 'application/pdf')
    ).toBe(true);
    expect(
      dragItemsMatchAccept(dragItems({ kind: 'file', type: 'application/json' }), 'application/pdf')
    ).toBe(false);
  });

  it('requires ALL items to match', () => {
    const items = dragItems(
      { kind: 'file', type: 'image/png' },
      { kind: 'file', type: 'text/plain' }
    );
    expect(dragItemsMatchAccept(items, 'image/*')).toBe(false);
  });
});

// ── validateIntakeFile ───────────────────────────────────────────────────────

describe('validateIntakeFile', () => {
  const noExisting: FileIntakeEntry[] = [];

  it('returns no errors for a valid file', () => {
    const errors = validateIntakeFile(
      makeFile('a.png', 100, 'image/png'),
      noExisting,
      { accept: 'image/*', maxFileSize: 1000, minFileSize: 0 },
      messages
    );
    expect(errors).toEqual([]);
  });

  it('flags an invalid type, passing the file type (or "unknown")', () => {
    const withType = validateIntakeFile(
      makeFile('a.txt', 10, 'text/plain'),
      noExisting,
      { accept: 'image/*' },
      messages
    );
    expect(withType).toEqual([{ code: 'FILE_INVALID_TYPE', message: 'invalid:text/plain' }]);

    const noMime = validateIntakeFile(
      makeFile('a', 10, ''),
      noExisting,
      { accept: 'image/*' },
      messages
    );
    expect(noMime).toEqual([{ code: 'FILE_INVALID_TYPE', message: 'invalid:unknown' }]);
  });

  it('flags a file larger than maxFileSize with the formatted limit', () => {
    const errors = validateIntakeFile(
      makeFile('a.png', 2048, 'image/png'),
      noExisting,
      { maxFileSize: 1024 },
      messages
    );
    expect(errors).toEqual([{ code: 'FILE_TOO_LARGE', message: `large:${formatFileSize(1024)}` }]);
  });

  it('flags a file smaller than minFileSize with the formatted limit', () => {
    const errors = validateIntakeFile(
      makeFile('a.png', 10, 'image/png'),
      noExisting,
      { minFileSize: 1024 },
      messages
    );
    expect(errors).toEqual([{ code: 'FILE_TOO_SMALL', message: `small:${formatFileSize(1024)}` }]);
  });

  it('flags a duplicate by matching name AND size', () => {
    const existing: FileIntakeEntry[] = [createIntakeEntry(makeFile('dup.png', 500, 'image/png'))];

    const sameNameSize = validateIntakeFile(
      makeFile('dup.png', 500, 'image/png'),
      existing,
      {},
      messages
    );
    expect(sameNameSize).toEqual([{ code: 'FILE_EXISTS', message: 'exists' }]);

    // Same name, different size → not a duplicate.
    const sameNameDiffSize = validateIntakeFile(
      makeFile('dup.png', 999, 'image/png'),
      existing,
      {},
      messages
    );
    expect(sameNameDiffSize).toEqual([]);
  });

  it('passes custom validate errors through', () => {
    const errors = validateIntakeFile(
      makeFile('a.png', 10, 'image/png'),
      noExisting,
      { validate: () => [{ code: 'CUSTOM', message: 'nope' }] },
      messages
    );
    expect(errors).toEqual([{ code: 'CUSTOM', message: 'nope' }]);
  });

  it('ignores a custom validate that returns null', () => {
    const errors = validateIntakeFile(
      makeFile('a.png', 10, 'image/png'),
      noExisting,
      { validate: () => null },
      messages
    );
    expect(errors).toEqual([]);
  });

  it('accumulates multiple errors in order (type, size)', () => {
    const errors = validateIntakeFile(
      makeFile('a.txt', 5000, 'text/plain'),
      noExisting,
      { accept: 'image/*', maxFileSize: 1024 },
      messages
    );
    expect(errors.map((e) => e.code)).toEqual(['FILE_INVALID_TYPE', 'FILE_TOO_LARGE']);
  });
});

// ── partitionIntake ──────────────────────────────────────────────────────────

describe('partitionIntake', () => {
  it('accepts valid files with pending status, empty errors, and unique ids', () => {
    const { accepted, rejected } = partitionIntake(
      [makeFile('a.png', 10, 'image/png'), makeFile('b.png', 20, 'image/png')],
      [],
      { accept: 'image/*' },
      messages
    );
    expect(rejected).toEqual([]);
    expect(accepted).toHaveLength(2);
    expect(accepted.every((e) => e.status === 'pending')).toBe(true);
    expect(accepted.every((e) => e.errors.length === 0)).toBe(true);
    expect(accepted[0].id).not.toBe(accepted[1].id);
  });

  it('rejects excess files with TOO_MANY_FILES before validation runs', () => {
    // maxFiles 1 → first is processed, the rest are excess. The excess file has
    // an invalid type but must still be rejected as TOO_MANY_FILES, not typed.
    const { accepted, rejected } = partitionIntake(
      [makeFile('ok.png', 10, 'image/png'), makeFile('bad.txt', 10, 'text/plain')],
      [],
      { accept: 'image/*', maxFiles: 1 },
      messages
    );
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].file.name).toBe('bad.txt');
    expect(rejected[0].errors).toEqual([{ code: 'TOO_MANY_FILES', message: 'many:1' }]);
  });

  it('counts existing files against the maxFiles budget', () => {
    const existing = partitionIntake(
      [makeFile('a.png', 10, 'image/png')],
      [],
      {},
      messages
    ).accepted;
    const { accepted, rejected } = partitionIntake(
      [makeFile('b.png', 10, 'image/png')],
      existing,
      { maxFiles: 2 },
      messages
    );
    expect(accepted).toHaveLength(1);
    expect(rejected).toEqual([]);
  });

  it('rejects everything when the remaining budget is <= 0', () => {
    const existing: FileIntakeEntry[] = [
      createIntakeEntry(makeFile('a.png', 10, 'image/png')),
      createIntakeEntry(makeFile('b.png', 20, 'image/png'))
    ];
    const { accepted, rejected } = partitionIntake(
      [makeFile('c.png', 30, 'image/png')],
      existing,
      { maxFiles: 2 },
      messages
    );
    expect(accepted).toEqual([]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].errors[0].code).toBe('TOO_MANY_FILES');
  });

  it('rejects ALL incoming when existing already overfills maxFiles (remaining < 0)', () => {
    // bind:files can be seeded past maxFiles externally. remaining = maxFiles -
    // existing.length goes negative; Math.max(0, remaining) clamps the intake
    // window to zero, so every incoming file is rejected as TOO_MANY_FILES and
    // none is accepted.
    const existing: FileIntakeEntry[] = [
      createIntakeEntry(makeFile('a.png', 10, 'image/png')),
      createIntakeEntry(makeFile('b.png', 20, 'image/png')),
      createIntakeEntry(makeFile('c.png', 30, 'image/png'))
    ];
    const { accepted, rejected } = partitionIntake(
      [makeFile('d.png', 40, 'image/png'), makeFile('e.png', 50, 'image/png')],
      existing,
      { maxFiles: 2 },
      messages
    );
    expect(accepted).toEqual([]);
    expect(rejected).toHaveLength(2);
    expect(rejected.every((r) => r.errors[0].code === 'TOO_MANY_FILES')).toBe(true);
  });

  it('accepts two byte-identical files in ONE batch (duplicate check is against existing only)', () => {
    // The duplicate guard compares each incoming file against the EXISTING list,
    // which stays empty here and is never mutated mid-batch — so two identical
    // files in the same drop both pass (FileUpload parity).
    const { accepted, rejected } = partitionIntake(
      [makeFile('same.png', 100, 'image/png'), makeFile('same.png', 100, 'image/png')],
      [],
      {},
      messages
    );
    expect(rejected).toEqual([]);
    expect(accepted).toHaveLength(2);
  });

  it('accumulates ALL error codes in the fixed order for one file failing every check', () => {
    // maxFileSize < size < minFileSize makes TOO_LARGE and TOO_SMALL both fire.
    const existing: FileIntakeEntry[] = [createIntakeEntry(makeFile('dup.txt', 500, 'text/plain'))];
    const { accepted, rejected } = partitionIntake(
      [makeFile('dup.txt', 500, 'text/plain')],
      existing,
      {
        accept: 'image/*',
        maxFiles: 10,
        maxFileSize: 100,
        minFileSize: 1000,
        validate: () => [{ code: 'CUSTOM', message: 'nope' }]
      },
      messages
    );
    expect(accepted).toEqual([]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].errors.map((e) => e.code)).toEqual([
      'FILE_INVALID_TYPE',
      'FILE_TOO_LARGE',
      'FILE_TOO_SMALL',
      'FILE_EXISTS',
      'CUSTOM'
    ]);
  });

  it('rejects a within-budget file that fails validation', () => {
    const { accepted, rejected } = partitionIntake(
      [makeFile('bad.txt', 10, 'text/plain')],
      [],
      { accept: 'image/*' },
      messages
    );
    expect(accepted).toEqual([]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].errors[0].code).toBe('FILE_INVALID_TYPE');
  });

  it('honors a custom id prefix', () => {
    const { accepted } = partitionIntake(
      [makeFile('a.png', 10, 'image/png')],
      [],
      {},
      messages,
      'attachment'
    );
    expect(accepted[0].id.startsWith('attachment-')).toBe(true);
  });
});

// ── createIntakeEntry & previews ─────────────────────────────────────────────

describe('createIntakeEntry', () => {
  it('wraps a file as a pending entry with a prefixed, unique id', () => {
    const a = createIntakeEntry(makeFile('a.png', 10, 'image/png'));
    const b = createIntakeEntry(makeFile('b.png', 10, 'image/png'));
    expect(a.status).toBe('pending');
    expect(a.errors).toEqual([]);
    expect(a.id.startsWith('file-')).toBe(true);
    expect(a.id).not.toBe(b.id);
  });

  it('generates a preview object-URL only for image files (isImageFile gating)', () => {
    const image = createIntakeEntry(makeFile('a.png', 10, 'image/png'));
    const doc = createIntakeEntry(makeFile('a.pdf', 10, 'application/pdf'));
    expect(image.preview).toBe('blob:stub-1');
    expect(doc.preview).toBeUndefined();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});

describe('revokeIntakePreviews', () => {
  it('revokes each entry that has a preview and skips the rest', () => {
    const image = createIntakeEntry(makeFile('a.png', 10, 'image/png'));
    const doc = createIntakeEntry(makeFile('a.pdf', 10, 'application/pdf'));
    revokeIntakePreviews([image, doc]);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(image.preview);
  });
});

// ── formatFileSize ───────────────────────────────────────────────────────────

describe('formatFileSize', () => {
  it('returns "0 B" for zero', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('returns an empty string for non-finite values', () => {
    expect(formatFileSize(Infinity)).toBe('');
    expect(formatFileSize(-Infinity)).toBe('');
    expect(formatFileSize(Number.NaN)).toBe('');
  });

  it('formats bytes, kilobytes, and megabytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
  });
});

// ── isImageFile ──────────────────────────────────────────────────────────────

describe('isImageFile', () => {
  it('is true only for image/* MIME types', () => {
    expect(isImageFile(makeFile('a.png', 1, 'image/png'))).toBe(true);
    expect(isImageFile(makeFile('a.svg', 1, 'image/svg+xml'))).toBe(true);
    expect(isImageFile(makeFile('a.txt', 1, 'text/plain'))).toBe(false);
    expect(isImageFile(makeFile('a', 1, ''))).toBe(false);
  });
});
