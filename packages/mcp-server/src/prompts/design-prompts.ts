import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * MCP prompts that ship the *process* — the generate → validate → judge →
 * synthesise loop (docs/DESIGN-MCP.md, Option E). MCP prompts are the
 * client-agnostic way to deliver a workflow: any MCP client (Claude Code,
 * Cursor, …) can invoke them, and they orchestrate the server's read-only tools
 * (get_pattern, validate_design, get_design_principles). Manifest state lives in
 * the consumer's repo — read/written with the agent's own file tools or the
 * `urbicon` CLI, never by this stateless server.
 *
 * The creative loop itself runs in the consumer's harness (it needs file access
 * and iteration); these prompts encode the steps so a single-shot generation
 * doesn't regress to the mean.
 */

/** Clamp the requested variant count to a sane range. Prompt args arrive as strings. */
export function variantCount(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(2, n));
}

function patternStep(pattern: string | undefined): string {
  return pattern
    ? `call \`get_pattern("${pattern}")\` and follow its layout, component-selection, and behavioural rules`
    : 'if a composition pattern fits the brief (settings-page, dashboard, form-page, tab-navigation, onboarding-guide), call `get_pattern("<name>")` to load it';
}

const FOOTER =
  'Output the final code, then a one-line rationale for each major design choice. Keep the rationale honest — name the trade-offs.';

export function designPagePrompt(
  brief: string,
  pattern: string | undefined,
  variants: string | undefined
): string {
  const n = variantCount(variants);
  return `You are designing a new page for a project built on Urbicon UI:

> **${brief}**

Run this loop. Do not skip steps — a single-shot answer regresses to a generic template.

1. **Context.** Read the project's \`./design.manifest.md\` — your own file tools, or \`urbicon context\` if the package is installed — and honour its paradigm, theme, density, and recorded decisions (ADRs). Then ${patternStep(pattern)}.
2. **Ground rules.** Call \`get_design_principles\` for the heuristics and \`get_css_reference\` for the exact token names. Note the paradigm's token profile via \`get_design_principles(topic="theming")\`.
3. **Generate ${n} variants.** Produce ${n} genuinely different implementations, each taking a distinct compositional approach *within* the paradigm — vary density, hierarchy emphasis, and the one signature moment. Do not let them converge. Use only real semantic tokens (no \`bg-status-*\`, no invented names).
4. **Validate.** Run \`validate_design\` on every variant. Fix each error and warning. A variant that cannot pass is disqualified.
5. **Judge.** Call \`get_design_principles(as="rubric")\` and score each surviving variant /40. Prefer a panel: judge correctness, hierarchy, paradigm-fidelity, and distinctiveness as separate lenses rather than one overall gut number.
6. **Synthesise.** Pick the winner, then graft the best ideas from the runners-up. Run \`validate_design\` once more on the merged result — it must come back clean.
7. **Record.** If the page follows a pattern, add \`data-design-pattern="<name>"\` to its root element and refresh the manifest's Pattern Usages (\`urbicon sync-manifest\`, or edit \`./design.manifest.md\` yourself). If you deviated from a pattern or principle on purpose, append an ADR (\`urbicon record-decision\`, or add it to \`./design.manifest.md\`).

${FOOTER}`;
}

export function redesignPrompt(
  brief: string,
  code: string | undefined,
  variants: string | undefined
): string {
  const n = variantCount(variants);
  const current = code
    ? `\n\nCurrent implementation:\n\n\`\`\`svelte\n${code}\n\`\`\``
    : '\n\nFirst read the current implementation of the page in question.';
  return `You are redesigning an existing page in a project built on Urbicon UI:

> **${brief}**${current}

Run a diagnosis-first loop:

1. **Context.** Read \`./design.manifest.md\` — your own file tools, or \`urbicon context\` — to recover the project's paradigm, theme, and prior decisions.
2. **Diagnose.** Run \`validate_design\` on the current code, then call \`get_design_principles(as="rubric")\` and score the current page /40. Your revision targets are **every linter finding** plus the **two lowest-scoring criteria** — nothing else.
3. **Generate ${n} variants** that fix exactly those weaknesses. Preserve the page's behaviour, data flow, and overall structure; change only what the diagnosis flagged. Use only real tokens.
4. **Validate.** Run \`validate_design\` on each; fix every error and warning.
5. **Judge.** Re-score each variant with the rubric. A redesign that does not beat the original on its target criteria is not shippable.
6. **Synthesise.** Merge the best result, then run \`validate_design\` once more.
7. **Record.** Append an ADR for any deliberate deviation (\`urbicon record-decision\`, or edit \`./design.manifest.md\`); refresh Pattern Usages (\`urbicon sync-manifest\`) if pattern usage changed.

End with a before/after table of the targeted criteria (old score → new score) and ${FOOTER.toLowerCase()}`;
}

export function registerDesignPrompts(server: McpServer): void {
  server.prompt(
    'design-page',
    'Design a new page with the full generate → validate → judge → synthesise loop (variant exploration + rubric selection + linter gate). Keeps generation from regressing to a generic template.',
    {
      brief: z.string().describe('What to build, e.g. "a billing settings page for a SaaS admin".'),
      pattern: z
        .string()
        .optional()
        .describe(
          'Composition pattern to follow (settings-page, dashboard, form-page, …). Optional.'
        ),
      variants: z.string().optional().describe('How many variants to explore (2–5, default 3).')
    },
    ({ brief, pattern, variants }) => ({
      messages: [
        {
          role: 'user' as const,
          content: { type: 'text' as const, text: designPagePrompt(brief, pattern, variants) }
        }
      ]
    })
  );

  server.prompt(
    'redesign',
    'Redesign an existing page: diagnose with validate_design + the rubric, then fix exactly the flagged weaknesses through variant exploration. Preserves behaviour and structure.',
    {
      brief: z
        .string()
        .describe('What to redesign and why, e.g. "the dashboard feels flat and generic".'),
      code: z
        .string()
        .optional()
        .describe('The current page source. Optional — omit to have the model read it first.'),
      variants: z.string().optional().describe('How many variants to explore (2–5, default 3).')
    },
    ({ brief, code, variants }) => ({
      messages: [
        {
          role: 'user' as const,
          content: { type: 'text' as const, text: redesignPrompt(brief, code, variants) }
        }
      ]
    })
  );
}
