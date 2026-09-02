// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { exportedComponents } from './__fixtures__/cascade-registry';

/**
 * `ComponentSlotMap` is keyed by the identifier the barrel exports a component
 * under, while the cascade looks an entry up by the string literal that
 * component hands `resolveSlotClasses` / `setWrapperCascade`. Everything else
 * about the map is derived from the components; this pairing is the one thing
 * that could drift, and it drifts silently: a component whose two names differ
 * falls to `SlotOf`'s permissive branch, so its provider entries keep compiling
 * with any key at all and nothing says the check was lost.
 */
describe('a component resolves under the name it is exported as', () => {
  it('for every component that names one', async () => {
    const named = (await exportedComponents()).filter((c) => c.providerName !== null);
    const mismatched = named
      .filter((c) => c.providerName !== c.exportName)
      .map((c) => `${c.exportName} resolves as '${c.providerName}'`);

    expect(mismatched).toEqual([]);
    // A sweep that found nothing to check would also report no mismatch.
    expect(named.length).toBeGreaterThan(80);
  });
});
