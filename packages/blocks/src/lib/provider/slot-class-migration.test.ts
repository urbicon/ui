import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Consistency gate for the slot-class cascade. Every component must resolve its
// per-slot classes through `resolveSlotClasses` (full cascade incl. conditional
// `overrides` + Tailwind-bucket conflict resolution), NOT the legacy additive
// `mergeSlotClasses`. This test fails loudly if a component regresses or a new
// one is scaffolded on the old helper — see docs/internal/CUSTOMIZATION-CONSOLIDATION.md.

const LIB_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // …/src/lib

function svelteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...svelteFiles(full));
    else if (entry.endsWith('.svelte')) out.push(full);
  }
  return out;
}

describe('slot-class resolver consistency', () => {
  it('no component .svelte references the legacy mergeSlotClasses', () => {
    const offenders = svelteFiles(LIB_DIR)
      .filter((f) => /\bmergeSlotClasses\b/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(LIB_DIR, f));

    expect(
      offenders,
      `These component(s) still use mergeSlotClasses — migrate to resolveSlotClasses ` +
        `(blocksConfig, 'Name', preset, variantProps, slotClassesProp):\n  ${offenders.join('\n  ')}`
    ).toEqual([]);
  });
});
