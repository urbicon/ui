import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadVerb } from '../data/verb-loader.js';

/**
 * MCP prompts that ship the *process* — the full design-verb table (DESIGN-MCP-V2
 * §8). MCP prompts are the client-agnostic way to deliver a workflow: any MCP
 * client (Claude Code, Cursor, …) can invoke them, and they orchestrate the
 * server's read-only tools (get_pattern, validate_design, get_design_principles).
 *
 * The recipe BODY is the single source authored under `@urbicon-ui/design`'s
 * `skill/verbs/*.md` and bundled into `@urbicon-ui/design-content` — the same text
 * the local skill ships, so a verb is maintained once and served two ways (§9).
 * Here we only wrap that body with the per-invocation header (brief / current code)
 * and register it. Manifest state lives in the consumer's repo — read/written with
 * the agent's own file tools or the `urbicon` CLI, never by this stateless server.
 */

/** Clamp the requested variant count to a sane range. Prompt args arrive as strings. */
export function variantCount(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(2, n));
}

type VerbArg = 'brief' | 'code' | 'variants';

interface VerbSpec {
  name: string;
  /** The prompt description shown to MCP clients. */
  summary: string;
  /** Which optional inputs this verb takes (drives the schema + the header). */
  args: VerbArg[];
}

/**
 * The full verb table (§8). Names match the `skill/verbs/<name>.md` recipes one to
 * one; `args` is the precise subset each verb uses (so `onboard` doesn't advertise
 * a `code` field it ignores). Order = the router's narrow-to-broad reading order.
 */
const VERBS: VerbSpec[] = [
  {
    name: 'onboard',
    summary:
      'Greenfield start: interview the product intent (audience, voice, references) + intake (paradigm/theme/density), then seed design.manifest.md — the anchor every later verb reads.',
    args: ['brief']
  },
  {
    name: 'adopt',
    summary:
      'Brownfield start: infer the design language from existing code (tokens, patterns, intent), measure the drift, and seed design.manifest.md.',
    args: ['brief']
  },
  {
    name: 'compose',
    summary:
      'Design a new page/component with the full generate → validate → judge → synthesise loop (variant exploration + rubric + linter gate). Keeps generation off the generic mean.',
    args: ['brief', 'variants']
  },
  {
    name: 'redesign',
    summary:
      'Redesign an existing page: diagnose with the linter + rubric, then fix exactly the flagged weaknesses through variant exploration. Preserves behaviour and structure.',
    args: ['brief', 'code', 'variants']
  },
  {
    name: 'polish',
    summary:
      'Tighten a near-final page: small token-level fixes that raise the slop-floor score without restructuring.',
    args: ['brief', 'code']
  },
  {
    name: 'critique',
    summary:
      'Judge a page without changing it: correctness + slop-floor + rubric → a prioritised fix-list, each item tagged with the verb that repairs it.',
    args: ['brief', 'code']
  },
  {
    name: 'fix',
    summary:
      'Repair correctness defects (raw colours, dark:/focus:, hardcoded z-index, hallucinated tokens) — mechanical, behaviour-preserving.',
    args: ['brief', 'code']
  },
  {
    name: 'retheme',
    summary:
      'Rebrand the system: change the token layer once and propagate across every affected file via the manifest usage-index. Gated per file.',
    args: ['brief']
  },
  {
    name: 'audit',
    summary:
      'App-wide consistency sweep: validate the tree, check each pattern cohort, score a sample, and report drift over time. Recommends repairs, performs none.',
    args: ['brief']
  },
  {
    name: 'migrate',
    summary:
      'Roll out a pattern or library change across every site, file by file, gated per file.',
    args: ['brief']
  }
];

const ARG_DESCRIPTIONS: Record<VerbArg, string> = {
  brief:
    'What to act on — the brief, the page, or the target. Optional; the agent uses the conversation context when omitted.',
  code: 'The current page source. Optional — omit to have the agent read it first.',
  variants: 'How many variants to explore (2–5, default 3).'
};

/** Per-invocation inputs (all optional); the recipe body carries the channel-agnostic steps. */
interface VerbArgs {
  brief?: string;
  code?: string;
  variants?: string;
}

/** Wrap a recipe body with the per-invocation header (verb framing, brief, current code, variant count). */
export function buildVerbPrompt(name: string, body: string, args: VerbArgs): string {
  const parts = [
    `You are running the **${name}** design recipe for a project built on Urbicon UI. Follow it; do not skip steps — a single-shot answer regresses to a generic template.`
  ];
  if (args.brief) parts.push(`\n> **${args.brief}**`);
  if (args.code) parts.push(`\nCurrent implementation:\n\n\`\`\`svelte\n${args.code}\n\`\`\``);
  parts.push('\n---\n');
  parts.push(
    body ||
      '_Recipe text unavailable — rebuild the design-content bundle with `bun run docs:gen:all`._'
  );
  if (args.variants) {
    parts.push(
      `\n\nWhere the recipe says "a few variants", explore exactly ${variantCount(args.variants)}.`
    );
  }
  return parts.join('\n');
}

function schemaFor(args: VerbArg[]): Record<string, z.ZodString | z.ZodOptional<z.ZodString>> {
  const shape: Record<string, z.ZodOptional<z.ZodString>> = {};
  for (const arg of args) shape[arg] = z.string().optional().describe(ARG_DESCRIPTIONS[arg]);
  return shape;
}

export function registerDesignPrompts(server: McpServer): void {
  for (const verb of VERBS) {
    server.prompt(verb.name, verb.summary, schemaFor(verb.args), async (args: VerbArgs) => {
      const body = await loadVerb(verb.name);
      return {
        messages: [
          {
            role: 'user' as const,
            content: { type: 'text' as const, text: buildVerbPrompt(verb.name, body, args) }
          }
        ]
      };
    });
  }
}
