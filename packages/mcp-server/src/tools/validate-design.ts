import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Finding, LintReport, Severity } from '../design-linter/index.js';
import { lintDesign } from '../design-linter/index.js';

const SEVERITY_LABEL: Record<Severity, string> = {
  error: '🔴 Errors',
  warning: '🟠 Warnings',
  info: '🔵 Heuristics'
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

function renderReport(report: LintReport): string {
  const { score, counts, findings, filename } = report;
  const hardFails = counts.error + counts.warning;
  const verdict = hardFails === 0 ? '✅ PASS' : '❌ NEEDS FIXES';

  let md = `# Design Validation — ${verdict}\n\n`;
  if (filename) md += `> \`${filename}\`\n\n`;
  md += `**Score: ${score}/100** · ${counts.error} error(s), ${counts.warning} warning(s), ${counts.info} heuristic note(s)\n\n`;

  if (findings.length === 0) {
    md +=
      'No issues found. Tokens are valid, no `dark:`/`focus:`/hardcoded z-index, and the distribution heuristics are satisfied.\n';
    return md;
  }

  if (counts.error > 0) {
    md +=
      'Errors are deterministic defects (broken output or token-system bypass) — fix all of them before shipping.\n\n';
  }
  md += renderFindings(findings, 'error');
  md += renderFindings(findings, 'warning');
  md += renderFindings(findings, 'info');

  md += '---\n\n**Next steps:**\n';
  md += '- `get_css_reference()` — exact valid token names (fixes hallucinated tokens)\n';
  md +=
    '- `get_design_principles(as="rubric")` — score the design qualitatively after the linter passes\n';
  md += '- Re-run `validate_design` after fixing to confirm.\n';
  return md;
}

export function registerValidateDesignTool(server: McpServer): void {
  server.tool(
    'validate_design',
    'Lint generated Svelte/HTML markup against the Urbicon UI design rules. Deterministic checks (raw Tailwind colours, `dark:`/`focus:` misuse, hardcoded z-index, broken dynamic classes, hallucinated tokens) plus distribution heuristics (intent-colour rainbow, uniform spacing, identical Cards, missing radius strategy). Returns a 0–100 score (each error −10, warning −5, heuristic −2, floored at 0) and per-finding fixes. Run this in a generate → validate → fix loop after producing UI code.',
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
        )
    },
    { readOnlyHint: true },
    async ({ code, filename, skipHeuristics }) => {
      const report = lintDesign(code, { filename, skipHeuristics });
      return { content: [{ type: 'text' as const, text: renderReport(report) }] };
    }
  );
}
