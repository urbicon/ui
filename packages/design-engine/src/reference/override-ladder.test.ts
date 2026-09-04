import { describe, expect, it } from 'vitest';
import { CLASS_OVER_SLOT_CLASSES, OVERRIDE_CASCADE, OVERRIDE_LADDER } from './override-ladder.js';

/** The chain the cascade sentence names, in the order it states. */
const chain = /`([^`]+)`/.exec(OVERRIDE_CASCADE)?.[1]?.split(' → ') ?? [];

describe('override ladder', () => {
  it('the prop-row clause claims nothing the cascade chain does not', () => {
    // Two sentences about one order: the clause is what fits a table cell, the
    // chain is what the theming section and the primer print. This checks each
    // claim of the clause against the chain rather than trusting the two to agree.
    expect(chain.length).toBeGreaterThan(2);
    expect(CLASS_OVER_SLOT_CLASSES).toContain('`class` wins over `slotClasses`');
    expect(chain.indexOf('instance class')).toBeGreaterThan(chain.indexOf('instance slotClasses'));

    expect(CLASS_OVER_SLOT_CLASSES).toContain('presets and provider defaults sit below both');
    const instance = chain.indexOf('instance slotClasses');
    const belowBoth = chain.filter((rung) => /^(defaults|preset)\./.test(rung));
    expect(belowBoth.length).toBeGreaterThan(0);
    for (const rung of belowBoth) expect(chain.indexOf(rung)).toBeLessThan(instance);
  });

  it('the ladder names five rungs and closes on the cascade sentence itself', () => {
    expect(OVERRIDE_LADDER.match(/^\d\. /gm)).toHaveLength(5);
    expect(OVERRIDE_LADDER).toContain(OVERRIDE_CASCADE);
  });
});
