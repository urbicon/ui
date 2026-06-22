/**
 * `urbicon get-component <slug> [--section …]` — a component's API (`llm.txt`) from
 * the version-pinned bundle, the local, version-correct mirror of the remote
 * `get_component`. Default prints the full `llm.txt`; `--section` slices one part
 * via the shared `@urbicon-ui/design-engine/search` parser (so local and remote
 * extract identically). Unlike the remote tool (which defaults to a token-compact
 * summary for an LLM), the CLI defaults to full text — the local consumer reads it
 * directly and token budget is not a constraint here.
 */

import { extractSection, type LlmTxtSection } from '@urbicon-ui/design-engine/search';
import { type Flags, stringFlag } from '../args.js';
import { loadComponentLlm } from '../content.js';
import { EXIT, printError } from '../output.js';

const SECTIONS: LlmTxtSection[] = ['overview', 'examples', 'variants', 'api', 'slots'];

export async function runGetComponent(positionals: string[], flags: Flags): Promise<number> {
  const slug = positionals[0];
  if (!slug) {
    printError('get-component needs a component slug, e.g. `urbicon get-component button`');
    return EXIT.USAGE;
  }

  const section = stringFlag(flags, 'section');
  if (section && section !== 'full' && !SECTIONS.includes(section as LlmTxtSection)) {
    printError(`--section must be one of: ${SECTIONS.join(', ')}, full`);
    return EXIT.USAGE;
  }

  let content: string | null;
  try {
    content = await loadComponentLlm(slug);
  } catch (err) {
    printError(`could not read component "${slug}" (${(err as Error).message}).`);
    return EXIT.FAIL;
  }

  if (content === null) {
    printError(`component "${slug}" not found. Run \`urbicon find <query>\` to discover the slug.`);
    return EXIT.FAIL;
  }

  // Default / explicit `full` → the complete llm.txt.
  if (!section || section === 'full') {
    console.log(content.trim());
    return EXIT.OK;
  }

  const extracted = extractSection(content, section as LlmTxtSection);
  if (extracted === null) {
    printError(
      `component "${slug}" has no "${section}" section. Try \`--section full\` or another of: ${SECTIONS.join(', ')}.`
    );
    return EXIT.FAIL;
  }
  console.log(extracted);
  return EXIT.OK;
}
