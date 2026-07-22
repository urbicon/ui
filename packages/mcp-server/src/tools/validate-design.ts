import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Finding, LintReport, Severity } from '@urbicon-ui/design-engine/linter';
import { lintDesign } from '@urbicon-ui/design-engine/linter';
import { z } from 'zod';

const SEVERITY_LABEL: Record<Severity, string> = {
  error: '🔴 Errors',
  warning: '🟠 Warnings',
  info: '🔵 Slop-floor'
};

function renderFindings(findings: Finding[], severity: Severity): string {
  const group = findings.filter((f) => f.severity === severity);
  if (group.length === 0) return '';

  let md = `### ${SEVERITY_LABEL[severity]} (${group.length})\n\n`;
  for (const f of group) {
    const loc = f.line ? `L${f.line}` : '—';
    const where = f.match ? ` \`${f.match}\`` : '';
    md += `- **[${f.ruleId}]** ${loc}${where} — ${f.message}\n`;
    md += `  ↳ ${f.fix}\n`;
  }
  return `${md}\n`;
}

function renderSuppressed(report: LintReport): string {
  const suppressed = report.suppressed ?? [];
  if (suppressed.length === 0) return '';
  let md = `### ⚪ Suppressed (${suppressed.reduce((a, s) => a + s.count, 0)})\n\n`;
  md += 'Deliberate exemptions — excluded from counts/scores but always listed, never hidden:\n\n';
  for (const s of suppressed) {
    const via = s.source === 'pragma' ? '`urbicon-ignore` pragma' : 'caller `suppressRules`';
    const unused = s.count === 0 ? ' — matched nothing (stale?)' : '';
    md += `- **[${s.ruleId}]** ×${s.count} via ${via}${unused}\n`;
  }
  return `${md}\n`;
}

function renderReport(report: LintReport): string {
  const { scores, counts, findings, filename } = report;
  const hardFails = counts.error + counts.warning;
  const verdict = hardFails === 0 ? '✅ PASS' : '❌ NEEDS FIXES';

  let md = `# Design Validation — ${verdict}\n\n`;
  if (filename) md += `> \`${filename}\`\n\n`;
  md += `**Correctness ${scores.correctness}/100 · Slop-floor ${scores.slop}/100** · ${counts.error} error(s), ${counts.warning} warning(s), ${counts.info} slop note(s)\n\n`;
  md +=
    'Two axes, never mixed: **correctness** is the blocking gate (fix every error/warning to pass); **slop-floor** is advisory — system-agnostic "looks generic" signals to raise distinctiveness.\n\n';

  if (findings.length === 0) {
    md +=
      'No issues found. Tokens are valid, no `dark:`/`focus:`/hardcoded z-index, and the slop-floor heuristics are satisfied.\n';
    md += renderSuppressed(report);
    return md;
  }

  if (counts.error > 0) {
    md +=
      'Errors are deterministic defects (broken output or token-system bypass) — fix all of them before shipping.\n\n';
  }
  md += renderFindings(findings, 'error');
  md += renderFindings(findings, 'warning');
  md += renderFindings(findings, 'info');
  md += renderSuppressed(report);

  md += '---\n\n**Next steps:**\n';
  md += '- `get_css_reference()` — exact valid token names (fixes hallucinated tokens)\n';
  md +=
    '- `get_design_principles(as="rubric")` — score the design qualitatively after the linter passes\n';
  md += '- Re-run `validate_design` after fixing to confirm.\n';
  return md;
}

/**
 * Register the `validate_design` tool: a thin facade over the engine's
 * `lintDesign`. It renders the {@link LintReport} into markdown (findings
 * grouped by severity, with per-finding fixes and the two scores) but adds no
 * rules of its own — the linter is shared verbatim with the `urbicon validate`
 * CLI, so local and remote verdicts agree.
 */
export function registerValidateDesignTool(server: McpServer): void {
  server.tool(
    'validate_design',
    'Lint generated Svelte/HTML markup against the Urbicon UI design rules. Two axes, never mixed: (1) **correctness** — deterministic defects (raw Tailwind colours, `dark:`/`focus:` misuse, hardcoded z-index, broken dynamic classes, hallucinated tokens, foreign-library component APIs like `tone=`/`variant="outline"`, icon-only buttons with no accessible name), the blocking gate; (2) **slop-floor** — system-agnostic "looks generic" heuristics (generic fonts, animated width/height, magic-number sizes, low-contrast text on colour, inline styles, `!important`, placeholder copy, emoji-as-icon, heading-level skips, small touch targets, intent-colour rainbow, uniform spacing/weights, identical Cards), advisory. Returns a correctness score and a slop-floor score (both 0–100; correctness −10/error, −5/warning; slop −10 per signal; floored) plus per-finding fixes. Run in a generate → validate → fix loop after producing UI code. Pass `extraTokens` to whitelist semantic tokens your project defines on top of Urbicon’s so they are not flagged as hallucinated. Class rules scan class attributes, slotClasses and tv()/script literals — prose that merely *quotes* an anti-pattern (docs, before/after examples) is not flagged. A deliberately off-system surface can exempt specific rules in-file via `<!-- urbicon-ignore rule-id … — reason -->`; suppressions are always reported, never silent.',
    {
      code: z
        .string()
        .describe(
          'The Svelte/HTML/JSX source to validate (the markup of a generated page or component).'
        ),
      filename: z
        .string()
        .optional()
        .describe('Optional label echoed back in the report (e.g. "dashboard/+page.svelte").'),
      skipHeuristics: z
        .boolean()
        .optional()
        .describe(
          'Skip the advisory distribution heuristics; report only deterministic violations. Default: false.'
        ),
      extraTokens: z
        .array(z.string())
        .optional()
        .describe(
          'Project-specific semantic token cores to treat as valid for this call, merged into the built-in whitelist so they are not flagged as hallucinated. A "core" is the part after the utility prefix: pass "surface-brand" (for `bg-surface-brand`), not "bg-surface-brand" and not the "--color-surface-brand" CSS variable. Use when your project extends the Urbicon token set or runs a newer library version than this server. This server is stateless and cannot read your CSS, so supply the cores explicitly.'
        )
    },
    { readOnlyHint: true },
    async ({ code, filename, skipHeuristics, extraTokens }) => {
      const report = lintDesign(code, { filename, skipHeuristics, extraTokens });
      return { content: [{ type: 'text' as const, text: renderReport(report) }] };
    }
  );
}
