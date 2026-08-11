import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { classCaveat, precedenceChain } from './customization-data';

/**
 * The override-precedence prose on /customization and
 * /customization/blocks-provider, held to what the engine actually does.
 *
 * The measurement lives with the engine —
 * `packages/blocks/src/lib/provider/override-precedence.test.ts` runs the real
 * cascade end to end — because that is a property of blocks, not of the docs,
 * and importing it here would drag another package's `$lib` aliases into this
 * app's type-check. What is left for this side is the wording: `class` beats
 * the library defaults and nothing else, said once, in one place.
 */

const docsSrc = dirname(fileURLToPath(import.meta.url)).replace(/\/lib$/, '');

describe('the ladder the pages render', () => {
  it('names step 1 as the one a class prop beats, and step 7 as its peer', () => {
    expect(precedenceChain).toHaveLength(7);
    expect(precedenceChain[0]).toContain('the only stage a class prop reliably beats');
    expect(precedenceChain[5]).toContain('slotClasses');
    expect(precedenceChain[6]).toContain('same stage as slotClasses');
  });

  it('states the limit in the same breath as the claim', () => {
    // The sentence said `class` beats everything the provider set, was
    // corrected, and came back — the second time in a table 110 lines above the
    // paragraph that corrected it. Sharing one string is what makes that shape
    // impossible; this holds the string itself to carrying its own limit.
    expect(classCaveat).toMatch(/only those/);
    expect(classCaveat).toMatch(/slotClasses/);
  });

  it('is the string the decision table renders', () => {
    const hub = readFileSync(resolve(docsSrc, 'routes/customization/+page.svelte'), 'utf8');
    expect(hub).toContain('${classCaveat}');
    expect(hub, 'a retyped copy would drift from the measurement in blocks').not.toContain(
      "Beats the library's own defaults and everything"
    );
  });
});
