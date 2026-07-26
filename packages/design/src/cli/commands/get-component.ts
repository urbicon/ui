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
import { loadCatalog, loadComponentLlm } from '../content.js';
import { installStateFor, readConsumerDependencies } from '../installed.js';
import { EXIT, printError } from '../output.js';

const SECTIONS: LlmTxtSection[] = ['overview', 'examples', 'variants', 'api', 'slots'];

/**
 * Warn (on stderr, so piped stdout stays clean) when the component's origin package
 * isn't a dependency here — otherwise the printed API documents an unimportable
 * component (the `Table`-from-`@urbicon-ui/table` dead end). Best-effort: a catalog
 * read failure must not break printing the already-loaded `llm.txt`.
 */
async function warnIfNotInstalled(slug: string): Promise<void> {
  try {
    const entry = (await loadCatalog()).components.find((c) => c.slug === slug);
    if (!entry) return;
    if (installStateFor(entry.package, readConsumerDependencies()) === 'missing') {
      console.error(
        `⚠ ${entry.name} ships from ${entry.package}, which isn't in your dependencies — ` +
          `install it before importing (e.g. \`bun add ${entry.package}\`).`
      );
    }
  } catch {
    // Catalog unreadable — skip the note; the API text below still stands.
  }
}

/**
 * Point at `--section` after printing a large full API — on stderr, so a pipe
 * still gets clean text.
 *
 * The flag has always existed and has always been in `--help`; the problem is
 * that nobody reads the help at the moment it would pay off. A recorded agent run
 * (`prototypes/artifact-frame`, 2026-07-26) called `get-component` twelve times
 * and took the full `llm.txt` — up to 11 kB — every single time, because the only
 * place `--section` was mentioned is a page it never opened. Printing the hint
 * where the cost is actually incurred is what a help text structurally cannot do.
 *
 * Below the threshold the whole file is cheaper than the round-trip a section
 * would cost, so the note would be noise.
 */
const SECTION_HINT_BYTES = 4000;

function noteSectionFlag(slug: string, bytes: number): void {
  if (bytes < SECTION_HINT_BYTES) return;
  console.error(
    `· ${slug}: ${(bytes / 1024).toFixed(1)} kB — for one part only, ` +
      `\`urbicon get-component ${slug} --section ${SECTIONS.join('|')}\``
  );
}

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

  await warnIfNotInstalled(slug);

  // Default / explicit `full` → the complete llm.txt.
  if (!section || section === 'full') {
    const full = content.trim();
    console.log(full);
    noteSectionFlag(slug, full.length);
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
