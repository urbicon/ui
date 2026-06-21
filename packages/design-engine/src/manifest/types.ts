/**
 * Types for the design manifest — the per-consumer-project memory of design
 * intent (docs/DESIGN-MCP.md, Option C). The manifest is a Markdown file
 * (`design.manifest.md`) at the consumer's project root with three parts:
 *
 *  1. Frontmatter — the enforced intake decisions (paradigm, theme, density).
 *  2. Pattern Usages — an auto-generated index of `data-design-pattern` markers
 *     found in the source (so "which pages follow pattern X" is a grep, not a
 *     guess — answering the open question from DESIGN-SYSTEM-INTELLIGENCE.md).
 *  3. Design Decisions — append-only ADRs recording deliberate deviations.
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

/** Parsed view of a manifest file. */
export interface DesignManifest {
  /** Flat key→value frontmatter (paradigm, theme, density, …). */
  frontmatter: Record<string, string>;
  usages: PatternUsage[];
  decisions: DesignDecision[];
  /** Whether a manifest file actually existed (false → defaults returned). */
  exists: boolean;
}
