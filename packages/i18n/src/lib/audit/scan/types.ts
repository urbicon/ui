/**
 * Shared types for the usage scanner (Feature B/C of the i18n audit).
 *
 * A scan walks source files for translation-key *usage* — every way a key is
 * referenced — so the reconciler can decide which defined keys are unused. The
 * shapes here are AST-agnostic: the TypeScript walker and the Svelte walker both
 * emit into a {@link UsageScan}.
 */

export interface KeyUsageSite {
  /** Source file (as passed to the scanner — the caller decides absolute vs relative). */
  file: string;
  /** 1-based line of the call/usage. */
  line: number;
  /** Trimmed source line, for human-readable reports. */
  context: string;
}

export interface UsageScan {
  /** Static literal keys in render calls (`t`/`plural`/`translate`, `<T key>`), with their sites. */
  staticKeys: Map<string, KeyUsageSite[]>;
  /** Keys seen only in `exists()` probes — they count as *used* but are excluded from used-but-undefined. */
  probeKeys: Set<string>;
  /** Static prefixes from template-literal keys, e.g. `` `filter.op.${x}` `` → `filter.op.` (trailing dot kept). */
  dynamicPrefixes: Array<{ prefix: string; site: KeyUsageSite }>;
  /** Translation calls whose key could not be resolved statically (`t(variable)`). */
  opaqueSites: KeyUsageSite[];
  /** Every string literal seen anywhere — the loose-literal harvest layer. */
  literalPool: Set<string>;
}

export interface ScanOptions {
  /** Extra bare-identifier names to treat as translation render-calls (the escape hatch). */
  functionNames?: string[];
}

/**
 * The classification of a translation call's first argument. A ternary expands to
 * several; an unresolvable argument yields `opaque`.
 */
export type ExtractedKey =
  | { kind: 'static'; value: string }
  | { kind: 'prefix'; prefix: string }
  | { kind: 'opaque' };
