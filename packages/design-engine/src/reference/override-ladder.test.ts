import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CLASS_OVER_SLOT_CLASSES,
  OVERRIDE_CASCADE,
  OVERRIDE_LADDER,
  PROVIDER_BELOW_INSTANCE
} from './override-ladder.js';

/** The chain the cascade sentence names, in the order it states. */
const chain = /`([^`]+)`/.exec(OVERRIDE_CASCADE)?.[1]?.split(' → ') ?? [];

describe('override ladder', () => {
  it('the prop-row sentences claim nothing the cascade chain does not', () => {
    // Three sentences about one order: the two clauses are what fit a table cell,
    // the chain is what the theming section and the primer print. Each claim is
    // checked against the chain rather than trusting the three to agree.
    expect(chain.length).toBeGreaterThan(2);
    expect(CLASS_OVER_SLOT_CLASSES).toContain('`class` wins over the `slotClasses` entry');
    expect(chain.indexOf('instance class')).toBeGreaterThan(chain.indexOf('instance slotClasses'));

    expect(PROVIDER_BELOW_INSTANCE).toContain('sit below both');
    const instance = chain.indexOf('instance slotClasses');
    const belowBoth = chain.filter((rung) => /^(defaults|preset)\./.test(rung));
    expect(belowBoth.length).toBeGreaterThan(0);
    for (const rung of belowBoth) expect(chain.indexOf(rung)).toBeLessThan(instance);
  });

  it('keeps the match condition on both overrides rungs', () => {
    // A non-matching `overrides` rule contributes nothing; a chain that drops the
    // `[match]` reads as if every rule always applied.
    expect(chain.filter((rung) => rung.endsWith('.overrides[match]'))).toHaveLength(2);
  });

  it('the ladder names five rungs and closes on the cascade sentence itself', () => {
    expect(OVERRIDE_LADDER.match(/^\d\. /gm)).toHaveLength(5);
    expect(OVERRIDE_LADDER).toContain(OVERRIDE_CASCADE);
  });
});

/**
 * Two files carry the sentence by hand because nothing renders them: `.cursorrules`
 * is read raw by Cursor, and `design-system/principles.md` is read raw from the
 * repo by the MCP server's design-system loader as well as copied into the bundle.
 * In-repo only — the engine ships standalone, so the files are absent downstream.
 */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const HAND_COPIES = ['.cursorrules', 'design-system/principles.md'].map((rel) =>
  resolve(REPO_ROOT, rel)
);

describe.skipIf(!HAND_COPIES.every((file) => existsSync(file)))('hand-carried copies', () => {
  for (const file of HAND_COPIES) {
    it(`${file.slice(REPO_ROOT.length + 1)} carries the cascade sentence verbatim`, () => {
      expect(readFileSync(file, 'utf-8')).toContain(OVERRIDE_CASCADE);
    });
  }
});
