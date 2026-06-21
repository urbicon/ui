/**
 * Types for the Urbicon UI design linter.
 *
 * The linter turns the prose Anti-Patterns and Design-Quality guidance (served
 * today by `get_design_principles`, `suggest_implementation`,
 * `get_implementation_checklist`) into executable checks. Deterministic rules
 * produce `error`/`warning` findings; distribution heuristics produce `info`
 * findings. See the design-loop context in docs/DESIGN-MCP.md.
 */

/** How serious a finding is. Drives the score deduction and the report grouping. */
export type Severity = 'error' | 'warning' | 'info';

/**
 * Whether a finding comes from a deterministic rule (regex/string match — a fact
 * about the code) or a statistical heuristic (a distribution judgement that can
 * have false positives). Surfaced in the report so consumers can weight them.
 */
export type FindingKind = 'deterministic' | 'heuristic';

/** A single linter finding, anchored to a location when one exists. */
export interface Finding {
  /** Stable rule identifier, e.g. `raw-tailwind-color`. Used for tests and suppression. */
  ruleId: string;
  severity: Severity;
  kind: FindingKind;
  /** Human-readable description of what is wrong. */
  message: string;
  /** Concrete fix hint — what to do instead. */
  fix: string;
  /** 1-based line number, when the finding is anchored to one. */
  line?: number;
  /** The offending snippet (e.g. the class token), when applicable. */
  match?: string;
}

/**
 * Per-run context threaded into every {@link Rule.check}. Holds values that
 * depend on the call options rather than the source under lint — today only the
 * effective token whitelist (the built-in cores merged with any
 * {@link LintOptions.extraTokens}). This is the seam future per-call rule inputs
 * (e.g. project-tuned thresholds) hang off, so rules never reach for module-global
 * state that a caller cannot influence.
 */
export interface LintContext {
  /**
   * The valid semantic token cores for this run: the built-in whitelist plus any
   * project-specific cores supplied via {@link LintOptions.extraTokens}.
   */
  validTokenCores: ReadonlySet<string>;
}

/** A deterministic rule: scans the source and emits findings. */
export interface Rule {
  id: string;
  severity: Severity;
  /** One-line description of what the rule enforces, shown in `validate_design` rule listings. */
  description: string;
  /**
   * Run the rule over the already-prepared source lines.
   * @param lines source split by `\n`, with comments masked (see linter.ts)
   * @param raw the original source (for rules that need cross-line context)
   * @param ctx per-run context (e.g. the effective token whitelist). Always supplied
   *   by {@link lintDesign}; optional so a rule stays callable standalone, in which
   *   case it falls back to its own built-in defaults.
   */
  check(lines: string[], raw: string, ctx?: LintContext): Finding[];
}

/**
 * Two-axis design score (DESIGN-MCP-V2 §6: "two tracks, never mixed"). Each axis
 * is an independent 0–100 so a correctness defect never hides behind a clean slop
 * axis, and a generic-looking page never passes just because its tokens are valid.
 */
export interface LintScores {
  /**
   * Stage 1 — "is it correct Urbicon?". Deducts the deterministic-rule findings
   * (the `error`/`warning` defects: raw colours, `dark:`/`focus:`, hardcoded
   * z-index, broken dynamic classes, hallucinated tokens). Counted per occurrence —
   * every defect is its own fix.
   */
  correctness: number;
  /**
   * Stage 2 — "does it look generic?". Deducts the system-agnostic slop-floor
   * heuristics (the `heuristic`-kind findings). Each heuristic is one holistic
   * judgement about the page, so it costs a flat weight once, regardless of how
   * many times the pattern repeats.
   */
  slop: number;
}

/** Aggregate result of linting one code unit. */
export interface LintReport {
  findings: Finding[];
  /** Two-axis 0–100 score; 100/100 = no findings on that axis. See {@link LintScores}. */
  scores: LintScores;
  counts: { error: number; warning: number; info: number };
  /** Optional label (e.g. filename) echoed back in the report. */
  filename?: string;
}

/** Options for a lint run. */
export interface LintOptions {
  filename?: string;
  /** Skip the distribution heuristics (the `info`-level checks). Default: false. */
  skipHeuristics?: boolean;
  /**
   * Project-specific semantic token cores to treat as valid for this run, merged
   * into the built-in whitelist so the `token-hallucination` rule does not flag
   * them (the "context as parameter" trick — lets a consumer on a customised or
   * newer token set avoid false positives without the engine reading their CSS).
   *
   * A "core" is the part after the utility prefix, matching {@link VALID_TOKEN_CORES}:
   * pass `surface-brand` (for `bg-surface-brand`), not `bg-surface-brand` and not the
   * `--color-surface-brand` CSS variable. Only affects cores that already look
   * semantic; raw-palette and `dark:`/`focus:` gates are unaffected.
   */
  extraTokens?: readonly string[];
}
