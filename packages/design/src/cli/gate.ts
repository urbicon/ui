/**
 * The pass/fail gate over a run's lint reports — the shared core of every
 * enforcement entry point: `urbicon validate` (CI), the `urbicon hook` PostToolUse
 * adapter, and any future caller. Keeping the verdict here (pure, no I/O, no exit)
 * means the CLI gate and the editor hook can never disagree on what "failing" means.
 *
 * Two axes, asymmetric on purpose (DESIGN-MCP-V2 §6 "two tracks, never mixed"):
 * **correctness** is always blocking — it is deterministic and false-positive free;
 * the **craft** axis is advisory by default and blocks only when the caller opts in
 * with a floor. Craft heuristics are FP-prone (even after hardening ~18% of this
 * repo's own files flag), so gating on them is a deliberate threshold a consumer
 * chooses, not a default that would break legitimate pages (F-S6-3).
 */

import type { LintReport } from '@urbicon-ui/design-engine/linter';

export interface GateOptions {
  /** Fail on warnings too, not just errors — raises the correctness bar. */
  strict: boolean;
  /**
   * Minimum acceptable craft score (0–100). A report scoring below it fails the
   * gate. `null` (the default) keeps the craft axis advisory: it never fails.
   */
  craftFloor: number | null;
}

/** One file whose craft score fell below the configured floor. */
export interface CraftBreach {
  label: string;
  craft: number;
}

export interface GateResult {
  /** Overall verdict: a correctness failure OR any craft-floor breach. */
  failed: boolean;
  /** Whether the correctness axis alone failed — drives the verdict message. */
  correctnessFailed: boolean;
  totals: { error: number; warning: number; info: number };
  /** Files below the craft floor (always empty when `craftFloor` is null). */
  craftBreaches: CraftBreach[];
}

/** Sum the per-file counts and apply the gate rules. Pure — no I/O, no `process.exit`. */
export function evaluateGate(reports: readonly LintReport[], opts: GateOptions): GateResult {
  const totals = { error: 0, warning: 0, info: 0 };
  const craftBreaches: CraftBreach[] = [];
  for (const r of reports) {
    totals.error += r.counts.error;
    totals.warning += r.counts.warning;
    totals.info += r.counts.info;
    // A per-file check, not an average: one generic page must not hide behind
    // many clean ones (the multi-page consistency the craft floor exists to hold).
    if (opts.craftFloor !== null && r.scores.craft < opts.craftFloor) {
      craftBreaches.push({ label: r.filename ?? '<stdin>', craft: r.scores.craft });
    }
  }
  const correctnessFailed = totals.error > 0 || (opts.strict && totals.warning > 0);
  return {
    failed: correctnessFailed || craftBreaches.length > 0,
    correctnessFailed,
    totals,
    craftBreaches
  };
}

/**
 * Parse a `--craft-floor <N>` flag value into a 0–100 threshold:
 * - absent → `null` (craft stays advisory; the default)
 * - a 0–100 integer → that threshold
 * - anything else (bare flag with no number, non-integer, out of range) → `'invalid'`
 *
 * Strict on purpose ("write streng"): a malformed floor is a caller mistake, not a
 * reason to silently skip the gate — the caller asked to gate on craft and got it
 * wrong, so the command must say so (usage error) rather than pass quietly.
 */
export function parseCraftFloor(raw: string | boolean | undefined): number | null | 'invalid' {
  if (raw === undefined) return null;
  if (typeof raw === 'boolean') return 'invalid'; // bare `--craft-floor`, no number given
  // Pure-integer match first: `Number('')`/`Number(' ')` coerce to 0, and `'1e2'`,
  // `'0x10'` parse — none of which a floor flag should silently accept.
  if (!/^\d{1,3}$/.test(raw.trim())) return 'invalid';
  const n = Number(raw);
  if (n > 100) return 'invalid'; // the regex already bounds it to 0–999
  return n;
}
