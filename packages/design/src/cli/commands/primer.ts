/**
 * `urbicon primer` — the design knowledge an agent needs on *every* task, in one
 * call: how to pick a component, and what the tokens are actually called.
 *
 * Why a bundle instead of leaving it to `principles --topic component-selection`
 * + five `css-reference` calls: both are needed for essentially any task, and a
 * recorded agent run reaches for them unevenly. Measured 2026-07-27 on the same
 * task (`prototypes/artifact-frame`): Opus 5 assembled the token reference from
 * six separate calls, Sonnet 5 fetched only two sections and worked with
 * incomplete token knowledge. One call removes that variance — and it lands in
 * the prompt cache on the first round, so the marginal cost over the rest of the
 * session is a rounding error (~7 100 tokens ≈ $0.14 across 55 rounds).
 *
 * What is deliberately NOT here: patterns and recipes. Those are task-dependent
 * (a settings page needs `settings-page`, not all seven), so bundling them would
 * be the mistake this command exists to avoid — paying for context nobody reads.
 * Component APIs are likewise on demand: `get-component <slug> --section api`.
 */

import { extractPrincipleSection, renderCssReference } from '@urbicon-ui/design-engine/reference';
import type { Flags } from '../args.js';
import { loadPrinciplesText } from '../content.js';
import { EXIT, printError } from '../output.js';

/**
 * The token families every task touches. `typography` and `theming` are left out
 * on purpose: type scales and theme authoring are the exception, not the rule,
 * and including them would roughly double the bundle (10 462 vs 5 122 tokens).
 */
const CORE_SECTIONS = ['surfaces', 'text', 'borders', 'intents', 'shadows'] as const;

export async function runPrimer(_positionals: string[], _flags: Flags): Promise<number> {
  let principles: string;
  try {
    principles = await loadPrinciplesText();
  } catch (err) {
    printError(`could not read the design principles (${(err as Error).message}).`);
    return EXIT.FAIL;
  }

  const selection = extractPrincipleSection(principles, 'component-selection');
  if (!selection) {
    // Fail loud: a primer silently missing its selection half would teach tokens
    // and leave the agent guessing at components — the exact failure this bundle
    // was built to prevent.
    printError(
      'the principles bundle has no "component-selection" section — the primer would be half empty.'
    );
    return EXIT.FAIL;
  }

  console.log('# Urbicon UI — primer\n');
  console.log(
    'Everything below applies to every task. Component APIs, composition patterns\n' +
      'and recipes are fetched per task — see the pointers at the end.\n'
  );
  console.log(selection.trim());
  console.log();
  for (const section of CORE_SECTIONS) console.log(`${renderCssReference(section).trim()}\n`);

  console.log(
    '→ `urbicon find <query>` then `get-component <slug> --section api` for a component API\n' +
      '→ `urbicon pattern <name>` for a page archetype · `urbicon recipe <id>` for full code\n' +
      '→ `urbicon css-reference typography|theming` for the sections not bundled here\n' +
      '→ `urbicon validate <path>` before you ship — it is the gate, not a suggestion.'
  );
  return EXIT.OK;
}
