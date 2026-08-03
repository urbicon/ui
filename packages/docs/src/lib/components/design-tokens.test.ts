import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Radii in this package come from the semantic tier, never from Tailwind's raw
 * scale.
 *
 * The tier is the whole point of the token: `--radius-contain` moves Card,
 * Alert, Dialog and every other container together when a project retunes it,
 * and a `rounded-2xl` sitting in one config quietly opts that element out.
 *
 * This is not hypothetical. `NoteList.root` shipped `rounded-2xl` — 1rem
 * against the container token's 0.125rem, a factor of eight — as the only raw
 * radius among 23, on the card that closes 60 documentation pages. The docs
 * site teaches the rule on /customization/tier-system while breaking it here,
 * and nothing caught it: `urbicon validate` scored the file 0/0/0, and the
 * per-component variant tests only compare slot names.
 */

const COMPONENTS = join(import.meta.dirname);

function variantFiles(): string[] {
  const out: string[] = [];
  for (const dir of readdirSync(COMPONENTS, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const f of readdirSync(join(COMPONENTS, dir.name))) {
      if (f.endsWith('.variants.ts')) out.push(join(COMPONENTS, dir.name, f));
    }
  }
  return out;
}

/** `rounded-none` is an explicit "no radius", not a step off the scale. */
const SEMANTIC = /^rounded-(contain|modify|commit|bridge|none|full)$/;

describe('radii come from the semantic tier', () => {
  const files = variantFiles();

  it('finds the variant configs at all', () => {
    // A guard that silently scanned nothing would pass forever.
    expect(files.length).toBeGreaterThanOrEqual(9);
  });

  for (const file of files) {
    const name = file.slice(COMPONENTS.length + 1);
    it(`${name} uses no raw Tailwind radius`, () => {
      const src = readFileSync(file, 'utf8')
        // comments may name a raw step while explaining why it is gone
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ');
      const raw = [
        ...src.matchAll(/\brounded(?:-[a-z]+)?(?:-(?:xs|sm|md|lg|xl|\dxl|full|none))?\b/g)
      ]
        .map((m) => m[0])
        .filter((cls) => !SEMANTIC.test(cls));
      expect(
        raw,
        `${name} uses ${raw.join(', ')} — the tier tokens are rounded-contain (containers), ` +
          `rounded-modify (tap surfaces), rounded-commit (actions). See docs/ARCHITECTURE.md.`
      ).toEqual([]);
    });
  }
});
