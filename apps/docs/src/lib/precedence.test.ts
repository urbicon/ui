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
 * app's type-check. What is left for this side is the wording: `class` is the
 * top rung and reaches the root slot only, said once, in one place.
 */

const docsSrc = dirname(fileURLToPath(import.meta.url)).replace(/\/lib$/, '');

describe('the ladder the pages render', () => {
  it('names the class prop as the strongest rung and slotClasses as the one below', () => {
    expect(precedenceChain).toHaveLength(7);
    expect(precedenceChain[5]).toContain('slotClasses');
    expect(precedenceChain[6]).toContain('the strongest rung');
    // The old wording called step 7 a peer of step 6. It is not any more, and a
    // page that says so again is the regression this line reports.
    expect(precedenceChain.join(' ')).not.toMatch(/same stage as slotClasses|reliably beats/);
  });

  it('states the limit in the same breath as the claim', () => {
    // The sentence said `class` beats everything the provider set, was
    // corrected, came back, and is now true — but its limit moved rather than
    // disappearing: `class` reaches the root slot only. Sharing one string is
    // what keeps the claim and its limit from drifting apart again.
    expect(classCaveat).toMatch(/root slot/);
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
