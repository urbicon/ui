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

/** True when a parsed value has the minimal shape of a history entry. */
function isEntry(value: unknown): value is ValidationHistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.date === 'string' && typeof e.correctness === 'number' && typeof e.slop === 'number'
  );
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
      const parsed: unknown = JSON.parse(trimmed);
      if (isEntry(parsed)) entries.push(parsed);
    } catch {
      // malformed/partial line — read tolerant, skip it
    }
  }
  return entries;
}
