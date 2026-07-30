/**
 * The validation-history sidecar: an append-only ndjson log of `urbicon validate
 * --record` runs, so design drift is measurable over time (DESIGN-MCP-V2 §7).
 *
 * Pure string ⇆ object conversion only — the file I/O (resolving the sidecar path,
 * appending a line) lives in the CLI's `manifest-io`, mirroring the rest of the
 * manifest module: the engine is dependency-free string logic, the CLI owns the
 * filesystem. ndjson is parsed tolerantly (a malformed or truncated line is
 * skipped, never thrown) — a half-written tail from an interrupted CI run must not
 * make the whole history unreadable.
 */

import type { ValidationHistoryEntry } from './types.js';

/** Serialise one entry to a single ndjson line (no trailing newline — the writer adds it). */
export function serializeHistoryEntry(entry: ValidationHistoryEntry): string {
  return JSON.stringify(entry);
}

/**
 * Normalise a parsed value into a history entry, or `null` when it lacks the shape.
 * Strict on the numeric fields (not just date/correctness/craft) so a hand-corrupted
 * line — `files: "NaN"` — is skipped rather than rendered verbatim into the drift
 * summary; the sidecar is machine-written, so a real entry always carries every field.
 *
 * Read tolerant, write strict: the second axis shipped as `slop` before it was
 * renamed to `craft` (2026-07-30), so an entry written by an older CLI is accepted
 * under either key and returned as `craft`. Without this the shape check would fail
 * on every pre-rename line and `parseHistory` would drop them **silently** — a
 * consumer's whole drift history vanishing on a version bump, with nothing to see.
 * Only the reader is tolerant; {@link serializeHistoryEntry} writes `craft` alone,
 * so a file converges on the current key as soon as it is appended to.
 */
function toEntry(value: unknown): ValidationHistoryEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const e = value as Record<string, unknown>;
  const craft = e.craft ?? e.slop;
  if (
    typeof e.date !== 'string' ||
    typeof e.files !== 'number' ||
    typeof e.errors !== 'number' ||
    typeof e.warnings !== 'number' ||
    typeof e.infos !== 'number' ||
    typeof e.correctness !== 'number' ||
    typeof craft !== 'number'
  ) {
    return null;
  }
  return {
    date: e.date,
    files: e.files,
    errors: e.errors,
    warnings: e.warnings,
    infos: e.infos,
    correctness: e.correctness,
    craft
  };
}

/**
 * Parse an ndjson history blob into entries, newest last (file order preserved).
 * Blank and malformed lines are skipped so a corrupt tail never throws.
 */
export function parseHistory(ndjson: string): ValidationHistoryEntry[] {
  const entries: ValidationHistoryEntry[] = [];
  for (const line of ndjson.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const entry = toEntry(JSON.parse(trimmed));
      if (entry) entries.push(entry);
    } catch {
      // malformed/partial line — read tolerant, skip it
    }
  }
  return entries;
}
