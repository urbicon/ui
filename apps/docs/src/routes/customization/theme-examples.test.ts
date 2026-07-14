import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards the customization docs against the theming mistake the guide itself names
 * as the most common one: recolor `--color-primary-*`, ship it, and the brand button
 * ends up on a cool blue-grey chassis, because `surface-*` / `text-*` / `border-*`
 * derive from `--color-neutral-*`, not from primary.
 *
 * The hub page shipped exactly that example for a while — a forest.css excerpt with
 * the chassis re-tint stripped out — so a reader copy-pasting the first page they
 * land on got the broken result. Prose review did not catch it; this does.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

function svelteFilesIn(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...svelteFilesIn(full));
    else if (entry.endsWith('.svelte')) out.push(full);
  }
  return out;
}

/** Every `@theme { … }` block in the text, brace-matched (nested braces are unusual
 * here but a regex to the first `}` would truncate at a nested rule). */
function extractThemeBlocks(source: string): string[] {
  const blocks: string[] = [];
  const marker = '@theme';
  let from = 0;
  for (;;) {
    const at = source.indexOf(marker, from);
    if (at === -1) break;
    const open = source.indexOf('{', at);
    if (open === -1) break;
    let depth = 0;
    let end = -1;
    for (let i = open; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) break;
    blocks.push(source.slice(open, end + 1));
    from = end + 1;
  }
  return blocks;
}

/** Comment bodies are prose ("… all shades 50-950 …"), not declarations — a block
 * that only MENTIONS a ramp in a comment has not set it. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

const files = svelteFilesIn(resolve(__dirname));

describe('customization @theme examples', () => {
  it('finds the route sources to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = relative(resolve(__dirname, '..', '..', '..'), file);
    const blocks = extractThemeBlocks(readFileSync(file, 'utf-8')).map(stripComments);
    const recolorsPrimary = blocks.filter((b) => b.includes('--color-primary-'));
    if (recolorsPrimary.length === 0) continue;

    it(`${rel}: every @theme that re-tints primary also re-tints the neutral chassis`, () => {
      const chassisless = recolorsPrimary.filter((b) => !b.includes('--color-neutral-'));
      expect(
        chassisless.length,
        `A @theme example recolors --color-primary-* without re-tinting --color-neutral-*.\n` +
          `Readers copy-paste these verbatim; primary-only gets them a brand accent on a cool ` +
          `blue-grey chassis. Add the neutral ramp (or drop the example and link ` +
          `/customization/themes).\n\nOffending block(s):\n${chassisless.join('\n---\n')}`
      ).toBe(0);
    });
  }
});
