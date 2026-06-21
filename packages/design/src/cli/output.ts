/** Shared terminal rendering + exit codes for the urbicon CLI. */

import type { Finding, LintReport, Severity } from '@urbicon-ui/design-engine/linter';

/**
 * CLI exit codes. `FAIL` is the design gate (errors, or warnings under
 * `--strict`); `USAGE` is a caller mistake (bad flags, unreadable input). Kept
 * distinct so a hook/CI can tell "your markup is wrong" (1) from "you called me
 * wrong" (2).
 */
export const EXIT = { OK: 0, FAIL: 1, USAGE: 2 } as const;

const SEVERITY_ICON: Record<Severity, string> = { error: '✗', warning: '!', info: '·' };

function formatFinding(f: Finding): string {
  const loc = f.line ? `:${f.line}` : '';
  const match = f.match ? ` \`${f.match}\`` : '';
  return `  ${SEVERITY_ICON[f.severity]} [${f.ruleId}]${loc}${match} — ${f.message}\n    ↳ ${f.fix}`;
}

/** Human-readable report for a single linted unit. */
export function formatReport(report: LintReport): string {
  const { score, counts, findings, filename } = report;
  const head =
    `${filename ?? '<stdin>'} — score ${score}/100 · ` +
    `${counts.error} error(s), ${counts.warning} warning(s), ${counts.info} note(s)`;
  if (findings.length === 0) return `${head}\n  ✓ no issues`;
  return `${head}\n${findings.map(formatFinding).join('\n')}`;
}

/** Write a CLI error to stderr, prefixed so it is unambiguous in a hook log. */
export function printError(message: string): void {
  console.error(`urbicon: ${message}`);
}
