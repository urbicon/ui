/**
 * Types for the Urbicon UI design linter.
 *
 * The linter turns the prose Anti-Patterns and Design-Quality guidance (served
 * today by `get_design_principles`, `suggest_implementation`,
 * `get_implementation_checklist`) into executable checks. Deterministic rules
 * produce `error`/`warning` findings; distribution heuristics produce `info`
 * findings. See the design-loop context in docs/internal/DESIGN-MCP.md.
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

/**
 * Which slice of the source a deterministic rule scans.
 *
 * - `'code'` — the code view (see `scope.ts`): class-attribute values, string/
 *   template literals in script blocks and `{…}` expressions, and `@apply` lines —
 *   with prose text content, non-class string attributes (`style=`, `aria-label=`,
 *   …) and comments blanked. For rules whose patterns are class utilities or
 *   module specifiers, so a page *quoting* an anti-pattern in prose (linter docs,
 *   before/after migration guides) is not flagged as violating it.
 * - `'file'` — the whole comment-masked file (the default). For rules that do their
 *   own structural scoping (the markup rules) or genuinely need file scope.
 */
export type RuleScope = 'code' | 'file';

/** A deterministic rule: scans the source and emits findings. */
export interface Rule {
  id: string;
  severity: Severity;
  /** One-line description of what the rule enforces, shown in `validate_design` rule listings. */
  description: string;
  /** Which view of the source this rule scans. Default: `'file'`. See {@link RuleScope}. */
  scope?: RuleScope;
  /**
   * Run the rule over the already-prepared source lines.
   * @param lines source split by `\n`, prepared per the rule's {@link RuleScope}
   *   (comment-masked whole file, or the code view with prose blanked)
   * @param raw the same prepared source unsplit (for rules that need cross-line context)
   * @param ctx per-run context (e.g. the effective token whitelist). Always supplied
   *   by {@link lintDesign}; optional so a rule stays callable standalone, in which
   *   case it falls back to its own built-in defaults.
   */
  check(lines: string[], raw: string, ctx?: LintContext): Finding[];
}

/**
 * Two-axis design score (DESIGN-MCP-V2 §6: "two tracks, never mixed"). Each axis
 * is an independent 0–100 so a correctness defect never hides behind a clean craft
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
   * Stage 2 — "does it look considered?". Deducts the system-agnostic craft
   * heuristics (the `heuristic`-kind findings). Each heuristic is one holistic
   * judgement about the page, so it costs a flat penalty once, regardless of how
   * many times the pattern repeats.
   */
  craft: number;
}

/**
 * One rule whose findings were suppressed for this unit — via an in-file
 * `urbicon-ignore` pragma or a caller-supplied list ({@link LintOptions.suppressRules},
 * e.g. the manifest's `## Exempt` section resolved by the CLI). Always surfaced in
 * the report (never silently swallowed): a suppression is a visible, deliberate
 * decision, and a `count` of 0 marks a declared suppression that matched nothing
 * (a candidate for removal).
 */
export interface SuppressedRule {
  ruleId: string;
  /** How many findings of this rule were suppressed in this unit (0 = declared but unused). */
  count: number;
  /** Where the suppression was declared: an in-file pragma or the caller's option. */
  source: 'pragma' | 'option';
}

/** Aggregate result of linting one code unit. */
export interface LintReport {
  findings: Finding[];
  /** Two-axis 0–100 score; 100/100 = no findings on that axis. See {@link LintScores}. */
  scores: LintScores;
  counts: { error: number; warning: number; info: number };
  /**
   * Rules suppressed for this unit (pragma / caller option), with per-rule counts.
   * Suppressed findings are excluded from {@link findings}, {@link counts} and
   * {@link scores} but stay visible here. Absent when nothing was declared.
   */
  suppressed?: SuppressedRule[];
  /** Optional label (e.g. filename) echoed back in the report. */
  filename?: string;
}

/**
 * How the source should be read when building the code view for the
 * class-scoped rules (see {@link RuleScope}).
 *
 * - `'markup'` — a Svelte/HTML document: class values live in attributes,
 *   `{…}` expressions, `<script>` literals and `@apply`; element text content is
 *   prose and never scanned. The default.
 * - `'code'` — a plain TS/JS module (e.g. a `tv()` config file): every string/
 *   template literal in the file is a class-bearing candidate; there is no
 *   markup structure and no prose.
 *
 * When omitted, the mode is inferred from the {@link LintOptions.filename}
 * extension (`.ts`/`.js`/`.mjs`/… → `'code'`), else `'markup'`. Pass it
 * explicitly for extension-less input (stdin) that is not Svelte markup.
 */
export type LintMode = 'markup' | 'code';

/** Options for a lint run. */
export interface LintOptions {
  filename?: string;
  /** Skip the distribution heuristics (the `info`-level checks). Default: false. */
  skipHeuristics?: boolean;
  /** Input kind for the code view. Default: inferred from `filename`, else `'markup'`. See {@link LintMode}. */
  mode?: LintMode;
  /**
   * Rule ids to suppress for this unit, merged with any in-file `urbicon-ignore`
   * pragmas — the caller-side channel for the manifest's `## Exempt` section
   * (resolved per file by the `urbicon` CLI). Suppressed findings are excluded
   * from findings/counts/scores but reported in {@link LintReport.suppressed};
   * unknown rule ids produce a loud `invalid-suppression` warning instead of
   * silently suppressing nothing.
   */
  suppressRules?: readonly string[];
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
  /**
   * The project has already decided shape at the tier level (`--radius-commit` /
   * `-modify` / `-contain` / `-bridge` declared in a theme or app stylesheet) —
   * the same "context as parameter" channel as {@link extraTokens}, resolved by
   * the caller because a single linted unit cannot see the project's CSS.
   *
   * Suppresses `no-radius-strategy` only. Without it, the note fires against
   * exactly the projects that took the mechanism the design system sanctions
   * (`principles.md`, "Semantic Radius Tiers") — a false positive that pushes
   * them toward the per-element override the anti-pattern forbids. A unit that
   * declares the tokens itself is recognised without this flag.
   */
  shapeDecided?: boolean;
}
