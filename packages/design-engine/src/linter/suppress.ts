/**
 * The exemption mechanism — the explicit, in-band way to mark a deliberately
 * off-system surface (a landing poster, a page that renders linter output as
 * prose) so `urbicon validate` / the hook / CI do not permanently fail it.
 *
 * Two declaration channels, one semantics:
 *
 *  1. **In-file pragma** — visible next to the code it exempts:
 *     `<!-- urbicon-ignore rule-a rule-b — reason -->` (Svelte/HTML) or
 *     `// urbicon-ignore rule-a rule-b — reason` (TS/JS). File-scoped; the
 *     em-dash separates the rule list from a free-text reason.
 *  2. **Caller option** — {@link LintOptions.suppressRules}, fed by the CLI from
 *     the manifest's `## Exempt` section (project-level intent, per file path).
 *
 * Design rules (repo maxim: fail-loud over silent fallbacks):
 *  - A rule *list* is required — there is deliberately no blanket off-switch.
 *  - An empty pragma or an unknown rule id suppresses nothing and instead emits
 *    a deterministic `invalid-suppression` **warning**, so a typo can never
 *    silently widen (or no-op) an exemption.
 *  - Suppressed findings are dropped from counts/scores but always surfaced in
 *    {@link LintReport.suppressed} with per-rule counts — an exemption is
 *    visible in every report, never swallowed.
 */

import { HEURISTIC_RULE_IDS } from './heuristics.js';
import { RULES } from './rules.js';
import type { Finding, SuppressedRule } from './types.js';

/** The rule id under which suppression misuse itself is reported. */
export const INVALID_SUPPRESSION_ID = 'invalid-suppression';

/** Every id a suppression may name: deterministic rules + slop heuristics. */
export function knownRuleIds(): ReadonlySet<string> {
  return new Set([...RULES.map((r) => r.id), ...HEURISTIC_RULE_IDS]);
}

/**
 * `urbicon-ignore` pragmas in any comment flavour. The id list runs to the end
 * of the comment or to the first em-dash (`—`), which starts the human reason
 * (HTML comments cannot contain `--`, so the ASCII form is not an option).
 */
const PRAGMA_RES: readonly RegExp[] = [
  /<!--\s*urbicon-ignore\b([^>]*?)-->/g, // <!-- urbicon-ignore … -->
  /\/\/\s*urbicon-ignore\b(.*)$/gm, // // urbicon-ignore …
  /\/\*\s*urbicon-ignore\b([\s\S]*?)\*\//g // /* urbicon-ignore … */
];

const ID_SHAPE = /^[a-z][a-z0-9-]*$/;

function lineOf(code: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < code.length; i++) {
    if (code[i] === '\n') line++;
  }
  return line;
}

export interface SuppressionSet {
  /** ruleId → declaration source. Only known rule ids land here. */
  rules: Map<string, 'pragma' | 'option'>;
  /** Loud `invalid-suppression` warnings for empty pragmas / unknown ids. */
  findings: Finding[];
}

function invalid(message: string, line?: number, match?: string): Finding {
  return {
    ruleId: INVALID_SUPPRESSION_ID,
    severity: 'warning',
    kind: 'deterministic',
    message,
    fix:
      'List exact rule ids: `<!-- urbicon-ignore magic-dimension inline-style — reason -->`. ' +
      'Unknown ids suppress nothing; a blanket off-switch is deliberately not supported.',
    line,
    match
  };
}

/**
 * Parse the in-file pragmas of `code` and merge the caller-supplied
 * `suppressRules` (the manifest `## Exempt` channel). Unknown/empty entries
 * become `invalid-suppression` warnings instead of silent no-ops.
 */
export function collectSuppressions(
  code: string,
  suppressRules: readonly string[] | undefined
): SuppressionSet {
  const known = knownRuleIds();
  const rules = new Map<string, 'pragma' | 'option'>();
  const findings: Finding[] = [];

  for (const re of PRAGMA_RES) {
    for (const m of code.matchAll(re)) {
      const line = lineOf(code, m.index ?? 0);
      // Everything after `urbicon-ignore`, up to the first em-dash (the reason).
      const idPart = (m[1] ?? '').split('—')[0] ?? '';
      const tokens = idPart.split(/[\s,]+/).filter(Boolean);
      if (tokens.length === 0) {
        findings.push(
          invalid('`urbicon-ignore` pragma without rule ids — nothing is suppressed.', line)
        );
        continue;
      }
      for (const token of tokens) {
        if (ID_SHAPE.test(token) && known.has(token)) {
          if (!rules.has(token)) rules.set(token, 'pragma');
        } else {
          findings.push(
            invalid(
              `\`${token}\` in an \`urbicon-ignore\` pragma is not a known rule id.`,
              line,
              token
            )
          );
        }
      }
    }
  }

  for (const id of suppressRules ?? []) {
    const token = id.trim();
    if (token === '') continue;
    if (known.has(token)) {
      if (!rules.has(token)) rules.set(token, 'option');
    } else {
      findings.push(
        invalid(
          `\`${token}\` (suppressRules / manifest Exempt) is not a known rule id.`,
          undefined,
          token
        )
      );
    }
  }

  return { rules, findings };
}

/**
 * Partition findings into kept vs suppressed. Returns the kept findings plus
 * the always-visible per-rule suppression summary (declared-but-unused entries
 * keep a count of 0 so stale exemptions are noticeable).
 */
export function applySuppressions(
  findings: Finding[],
  set: SuppressionSet
): { kept: Finding[]; suppressed: SuppressedRule[] } {
  if (set.rules.size === 0) return { kept: findings, suppressed: [] };
  const counts = new Map<string, number>();
  for (const id of set.rules.keys()) counts.set(id, 0);
  const kept: Finding[] = [];
  for (const f of findings) {
    if (set.rules.has(f.ruleId)) counts.set(f.ruleId, (counts.get(f.ruleId) ?? 0) + 1);
    else kept.push(f);
  }
  const suppressed: SuppressedRule[] = [...set.rules.entries()]
    .map(([ruleId, source]) => ({ ruleId, count: counts.get(ruleId) ?? 0, source }))
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId));
  return { kept, suppressed };
}
