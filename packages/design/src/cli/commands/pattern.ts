/**
 * `urbicon pattern [name]` — composition patterns from the version-pinned bundle,
 * the local, version-correct mirror of the remote `get_pattern`. With no name,
 * lists all patterns; with a name, prints the full pattern text. Parsing is shared
 * via `@urbicon-ui/design-engine/reference` so local and remote slice identically.
 */

import { boolFlag, type Flags } from '../args.js';
import { loadPatternEntries } from '../content.js';
import { EXIT, printError } from '../output.js';

export async function runPattern(positionals: string[], flags: Flags): Promise<number> {
  const name = positionals[0];
  const asJson = boolFlag(flags, 'json');

  let patterns: Awaited<ReturnType<typeof loadPatternEntries>>;
  try {
    patterns = await loadPatternEntries();
  } catch (err) {
    printError(`could not read the composition patterns (${(err as Error).message}).`);
    return EXIT.FAIL;
  }

  if (!name) {
    if (asJson) {
      console.log(
        JSON.stringify(
          patterns.map(({ name: n, title, description }) => ({ name: n, title, description })),
          null,
          2
        )
      );
      return EXIT.OK;
    }
    console.log(`${patterns.length} composition pattern(s):\n`);
    for (const p of patterns) {
      console.log(`  ${p.title}  ·  ${p.name}\n    ${p.description}\n`);
    }
    console.log('→ `urbicon pattern <name>` for the full pattern.');
    return EXIT.OK;
  }

  const pattern = patterns.find((p) => p.name === name);
  if (!pattern) {
    printError(`pattern "${name}" not found. Available: ${patterns.map((p) => p.name).join(', ')}`);
    return EXIT.FAIL;
  }

  console.log(pattern.content.trim());
  console.log(
    '\n→ `urbicon principles` for the design heuristics · `urbicon css-reference` for token names.'
  );
  return EXIT.OK;
}
