/**
 * Types for the design manifest — the per-consumer-project memory of design
 * intent (docs/internal/DESIGN-MCP.md, Option C). The manifest is a Markdown file
 * (`design.manifest.md`) at the consumer's project root, plus a sidecar ndjson
 * log. Its parts (DESIGN-MCP-V2 §7):
 *
 *  1. Frontmatter — the enforced intake decisions (paradigm, theme, density).
 *  2. Product Intent — the target identity (audience, voice, references,
 *     anti-references): the difference between "consistent" and merely "generic".
 *  3. Token Overrides — project-specific semantic token cores, fed to
 *     `urbicon validate` so they are not flagged as hallucinated (the local,
 *     manifest-sourced counterpart to the remote `validate_design(extraTokens)`).
 *  4. Pattern Usages — an auto-generated index of `data-design-pattern` markers
 *     found in the source (so "which pages follow pattern X" is a grep, not a
 *     guess — answering the open question from DESIGN-SYSTEM-INTELLIGENCE.md).
 *  5. Design Decisions — append-only ADRs recording deliberate deviations.
 *
 * The Validation History ({@link ValidationHistoryEntry}) lives in a sidecar
 * `*.history.ndjson` file, not in the Markdown — append-only, machine-written,
 * so it never disturbs the human-edited manifest.
 */

/** One `data-design-pattern="…"` marker found in the source tree. */
export interface PatternUsage {
  /** The pattern name, e.g. "dashboard". */
  pattern: string;
  /** Source file, relative to the project root. */
  file: string;
}

/** A recorded design decision (ADR). */
export interface DesignDecision {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  title: string;
  /** accepted | proposed | superseded — free text, defaults to "accepted". */
  status: string;
  decision: string;
  rationale?: string;
}

/**
 * The target identity a project designs toward — the "missing half" of design
 * memory (DESIGN-MCP-V2 §7). Without it, "consistent change" has no anchor and
 * generation drifts to generic-pretty. Arrays default to `[]` (never undefined);
 * an entirely empty intent means the `## Product Intent` section is absent or blank.
 */
export interface ProductIntent {
  /** Who uses this — their context, constraints, expertise. */
  audience?: string;
  /** The voice as a few adjectives (canonically three), e.g. `['calm','precise','trustworthy']`. */
  voice: string[];
  /** Products/sites whose feel to move toward. */
  references: string[];
  /** The generic defaults to avoid (e.g. "Bootstrap admin", "rainbow SaaS dashboard"). */
  antiReferences: string[];
}

/**
 * One validation run, appended to the sidecar `*.history.ndjson` so design drift
 * is measurable over time (DESIGN-MCP-V2 §7). One entry per `urbicon validate
 * --record` invocation; scores are the mean across the files in that run, counts
 * are summed. ndjson (not a Markdown table) keeps it append-only and machine-owned.
 */
export interface ValidationHistoryEntry {
  /** ISO 8601 timestamp of the run (full precision, for a time series). */
  date: string;
  /** Files linted in this run. */
  files: number;
  /** Summed `error`-severity findings across all files. */
  errors: number;
  /** Summed `warning`-severity findings. */
  warnings: number;
  /** Summed `info`-severity (slop-floor) findings. */
  infos: number;
  /** Mean correctness score across files (0–100, rounded). The drift signal. */
  correctness: number;
  /** Mean slop-floor score across files (0–100, rounded). */
  slop: number;
}

/**
 * One `## Exempt` entry: a deliberately off-system surface (landing poster, a
 * page rendering linter output as prose) with the exact rule ids `urbicon
 * validate` suppresses for it. A rule list is required — there is deliberately
 * no blanket off-switch — and suppressions stay visible in every report
 * (`LintReport.suppressed`), so an exemption is a recorded decision, not a
 * silent hole in the gate. The in-file counterpart is the `urbicon-ignore`
 * pragma; use the manifest form when the intent is project-level.
 */
export interface ExemptEntry {
  /**
   * Project-root-relative path (forward slashes). A trailing `/` exempts the
   * whole subtree (`src/routes/marketing/`); otherwise the match is exact.
   */
  path: string;
  /** Linter rule ids to suppress for this path (e.g. `raw-tailwind-color`). */
  rules: string[];
  /** Free-text reason (the part after the second ` — `). */
  note?: string;
}

/** Parsed view of a manifest file. */
export interface DesignManifest {
  /** Flat key→value frontmatter (paradigm, theme, density, …). */
  frontmatter: Record<string, string>;
  /** Target identity (audience, voice, references, anti-references). Empty when unset. */
  intent: ProductIntent;
  /**
   * Project-specific semantic token cores declared valid for this project (e.g.
   * `surface-brand`). Cores only — the part after the utility prefix, matching the
   * linter whitelist — not full utilities (`bg-surface-brand`) nor CSS variables.
   */
  tokenOverrides: string[];
  /** Deliberately off-system surfaces with the rule ids suppressed for them. */
  exempts: ExemptEntry[];
  usages: PatternUsage[];
  decisions: DesignDecision[];
  /** Whether a manifest file actually existed (false → defaults returned). */
  exists: boolean;
}
