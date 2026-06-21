/**
 * `urbicon verbs` / `urbicon verb <name>` — the local half of the design-verb
 * delivery (DESIGN-MCP-V2 §8). The recipes ship inside this package
 * (`skill/verbs/*.md`) — the same single source the remote MCP prompts serve — so
 * the CLI reads them package-relative, no content bundle needed. `verbs` lists the
 * table; `verb <name>` prints one recipe (pipe it to an agent, or read it inline).
 */

import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Flags } from '../args.js';
import { EXIT, printError } from '../output.js';
import { findPackageRoot } from '../package-root.js';

/** Verb names are fixed recipe slugs; guard the path join since the name comes from argv. */
const SAFE_VERB = /^[a-z][a-z0-9-]*$/;

async function resolveVerbsDir(): Promise<string | null> {
  const root = await findPackageRoot();
  return root ? resolve(root, 'skill', 'verbs') : null;
}

/** The first `# <name> — <purpose>` heading of a recipe, reduced to its purpose. */
function purposeOf(body: string): string {
  const heading = body.split('\n', 1)[0] ?? '';
  const m = heading.match(/^#\s+[a-z-]+\s+[—-]\s+(.+)$/);
  return m ? m[1]!.trim() : '';
}

export async function runVerbList(_positionals: string[], _flags: Flags): Promise<number> {
  const dir = await resolveVerbsDir();
  if (!dir) {
    printError('could not locate the bundled skill — reinstall @urbicon-ui/design');
    return EXIT.FAIL;
  }

  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.md')).sort();
  } catch {
    printError(`no verb recipes found at ${dir}`);
    return EXIT.FAIL;
  }

  console.log('Design verbs — run `urbicon verb <name>` to print one:\n');
  for (const file of files) {
    const name = file.replace(/\.md$/, '');
    let purpose = '';
    try {
      purpose = purposeOf(await readFile(resolve(dir, file), 'utf-8'));
    } catch {
      // unreadable recipe — list the name without a purpose
    }
    console.log(`  ${name.padEnd(10)} ${purpose}`);
  }
  return EXIT.OK;
}

export async function runVerb(positionals: string[], _flags: Flags): Promise<number> {
  const name = positionals[0];
  if (!name) {
    printError(
      'verb requires a name, e.g. `urbicon verb compose` (list them with `urbicon verbs`)'
    );
    return EXIT.USAGE;
  }
  if (!SAFE_VERB.test(name)) {
    printError(`invalid verb name "${name}"`);
    return EXIT.USAGE;
  }

  const dir = await resolveVerbsDir();
  if (!dir) {
    printError('could not locate the bundled skill — reinstall @urbicon-ui/design');
    return EXIT.FAIL;
  }

  try {
    console.log(await readFile(resolve(dir, `${name}.md`), 'utf-8'));
    return EXIT.OK;
  } catch {
    printError(`unknown verb "${name}" — list the available verbs with \`urbicon verbs\``);
    return EXIT.USAGE;
  }
}
