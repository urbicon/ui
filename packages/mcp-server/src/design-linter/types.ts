/**
 * Types for the Urbicon UI design linter.
 *
 * The linter turns the prose Anti-Patterns and Design-Quality guidance (served
 * today by `get_design_principles`, `suggest_implementation`,
 * `get_implementation_checklist`) into executable checks. Deterministic rules
 * produce `error`/`warning` findings; distribution heuristics produce `info`
 * findings. See design-linter/README context in docs/DESIGN-MCP.md.
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
   */
  check(lines: string[], raw: string): Finding[];
}

/** Aggregate result of linting one code unit. */
export interface LintReport {
  findings: Finding[];
  /** Deterministic 0–100 design-quality score. 100 = no findings. */
  score: number;
  counts: { error: number; warning: number; info: number };
  /** Optional label (e.g. filename) echoed back in the report. */
  filename?: string;
}

/** Options for a lint run. */
export interface LintOptions {
  filename?: string;
  /** Skip the distribution heuristics (the `info`-level checks). Default: false. */
  skipHeuristics?: boolean;
}
