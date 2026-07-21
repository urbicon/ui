/**
 * `urbicon guide [slug]` — the canonical package guides (auth reference, blocks
 * guide system, migration notes, table scroll models) from the version-pinned
 * bundle. The sources ship in each package's npm tarball (docs/DOCS-SURFACES.md);
 * the bundle copy is what makes them version-matched here. With no slug, lists
 * the available guides; with a slug, prints the full guide markdown.
 */

import { boolFlag, type Flags } from '../args.js';
import { type GuideIndexEntry, loadGuideIndex, loadGuideText } from '../content.js';
import { EXIT, printError } from '../output.js';

/** Mirrors the bundle's slug shape — anything else is "unknown guide", not a crash. */
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function runGuide(positionals: string[], flags: Flags): Promise<number> {
  const slug = positionals[0];
  const asJson = boolFlag(flags, 'json');

  let index: GuideIndexEntry[];
  try {
    index = await loadGuideIndex();
  } catch (err) {
    printError(`could not read the package guides (${(err as Error).message}).`);
    return EXIT.FAIL;
  }

  if (!slug) {
    if (asJson) {
      console.log(JSON.stringify(index, null, 2));
      return EXIT.OK;
    }
    console.log(`${index.length} package guide(s):\n`);
    for (const g of index) {
      console.log(`  ${g.title}  ·  ${g.slug}\n    ${g.description}\n`);
    }
    console.log('→ `urbicon guide <slug>` for the full guide.');
    return EXIT.OK;
  }

  const available = index.map((g) => g.slug).join(', ');
  if (!SAFE_SLUG.test(slug)) {
    printError(`guide "${slug}" not found. Available: ${available}`);
    return EXIT.FAIL;
  }

  let content: string | null;
  try {
    content = await loadGuideText(slug);
  } catch (err) {
    printError(`could not read the package guides (${(err as Error).message}).`);
    return EXIT.FAIL;
  }
  if (content === null) {
    printError(`guide "${slug}" not found. Available: ${available}`);
    return EXIT.FAIL;
  }

  console.log(content.trim());
  return EXIT.OK;
}
