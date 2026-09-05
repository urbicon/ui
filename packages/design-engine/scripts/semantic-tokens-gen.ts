#!/usr/bin/env bun
/**
 * Generates `src/reference/semantic-tokens.gen.ts` — the surface / text /
 * border tables and the intent roles that the CSS token reference renders —
 * from `packages/blocks/src/lib/style/semantic.css`.
 *
 * The reference ships standalone (the `urbicon` CLI and the remote MCP server
 * carry no blocks CSS at runtime), so the tables have to be a committed
 * module — and a committed copy of a stop drifts silently unless something
 * compares it to the source on every change (#402). Output is deterministic
 * (source order, no timestamp), so `--check` is a stable CI gate that fails
 * only on a real drift. The grammar of the `@role` / `@absent` markers it
 * reads is at the head of semantic.css; the parser fails loudly on a tabled
 * token without one.
 *
 * Usage:
 *   bun run tokens:reference         # regenerate the committed module
 *   bun run tokens:reference:check   # fail when semantic.css changed without a regen
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSemanticTokens, renderModule } from './semantic-tokens-parse.js';

const here = dirname(fileURLToPath(import.meta.url));
const STYLE = resolve(here, '..', '..', 'blocks', 'src', 'lib', 'style');
const SEMANTIC = resolve(STYLE, 'semantic.css');
const FOUNDATION = resolve(STYLE, 'foundation.css');
const OUT = resolve(here, '..', 'src', 'reference', 'semantic-tokens.gen.ts');

function main(): void {
  for (const source of [SEMANTIC, FOUNDATION]) {
    if (!existsSync(source)) throw new Error(`semantic-tokens-gen: source not found at ${source}`);
  }
  const data = parseSemanticTokens(
    readFileSync(SEMANTIC, 'utf8'),
    readFileSync(FOUNDATION, 'utf8')
  );
  const generated = renderModule(data);
  const tokens =
    data.families.surface.length + data.families.text.length + data.families.border.length;
  const summary = `${tokens} tabled tokens, ${data.intents.entries.length} intents × ${data.intents.roles.length} roles`;

  if (process.argv.includes('--check')) {
    const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (current !== generated) {
      console.error(
        'semantic-tokens-gen: semantic-tokens.gen.ts is STALE — semantic.css or foundation.css changed without a regen.\n' +
          'Run `bun run tokens:reference` and commit the result.'
      );
      process.exit(1);
    }
    console.log(`semantic-tokens-gen: semantic-tokens.gen.ts is up to date (${summary}).`);
    return;
  }

  writeFileSync(OUT, generated);
  console.log(`semantic-tokens-gen: wrote ${OUT} (${summary}).`);
}

main();
