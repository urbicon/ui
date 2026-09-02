// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { exportedComponents, PROVIDER_NAME, stripComments } from './__fixtures__/cascade-registry';

/**
 * `ComponentSlotMap` is keyed by the identifier the barrel exports a component
 * under, while the cascade looks an entry up by the string literal that
 * component hands `resolveSlotClasses` / `setWrapperCascade`. Everything else
 * about the map is derived from the components; this pairing is the one thing
 * that could drift, and it drifts silently: a component whose two names differ
 * falls to `SlotOf`'s permissive branch, so its provider entries keep compiling
 * with any key at all and nothing says the check was lost.
 *
 * Both halves are conditions rather than counts. A threshold would have let a
 * component drop out of the sweep entirely — which is the *other* way this
 * drifts, and the one a name-shaped check cannot see: `PROVIDER_NAME` wants a
 * literal in the call, so hoisting the name into a `const` yields no name at
 * all, and a count-based sweep just measures one component fewer.
 *
 * **What the population itself hangs on: the two call names appearing verbatim
 * in the file.** An aliased import escapes that, and so does the likelier
 * shape — a per-package helper that takes the name as a parameter, which is
 * exactly what `@urbicon-ui/auth` does in `client/utils/slot-class.ts`. Were
 * blocks to adopt that indirection, its components would leave this sweep
 * without failing it. Making that unrepresentable needs the population to come
 * from a run rather than a read — observing which components actually reach
 * the resolver while the cascade sweep mounts them — which is a larger
 * instrument than the drift it would close.
 */
describe('a component resolves under the name it is exported as', () => {
  const files = Object.entries(
    import.meta.glob<string>('../{components,primitives}/**/*.svelte', {
      query: '?raw',
      import: 'default',
      eager: true
    })
  );

  it('every component that resolves a cascade states its name as a literal', () => {
    const nameless = files
      .filter(([, source]) => {
        const code = stripComments(source);
        return (
          /\bresolveSlotClasses\s*\(|\bsetWrapperCascade\s*\(/.test(code) &&
          !PROVIDER_NAME.test(code)
        );
      })
      .map(([path]) => path.replace(/^\.\.\//, ''));

    expect(nameless).toEqual([]);
  });

  it('and that name is the one the barrel exports it under', async () => {
    const named = (await exportedComponents()).filter((c) => c.providerName !== null);
    const mismatched = named
      .filter((c) => c.providerName !== c.exportName)
      .map((c) => `${c.exportName} resolves as '${c.providerName}'`);

    expect(mismatched).toEqual([]);
    // Every file that resolves a cascade reached the sweep: the assertion above
    // is vacuous for a component the glob above found and this one dropped.
    const callers = files.filter(([, s]) => PROVIDER_NAME.test(stripComments(s))).length;
    expect(named.length).toBe(callers);
  });
});
