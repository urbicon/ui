import { describe, expect, it } from 'vitest';
import { namedConsumers } from './__fixtures__/cascade-registry';

/**
 * The wrapper → inner-component edge, which nothing else can check.
 *
 * The cascade sweeps read a wrapper's slot vocabulary through this edge, and a
 * wrong edge only ever *widens* that vocabulary: the extra slots land nowhere,
 * the routes still find the ones that do, and every sweep stays green. Measured
 * on the shape a reviewer found — one plausible attribute on the `<Input>`
 * inside `NumberInput`,
 *
 *     aria-roledescription="Select a number"
 *
 * took NumberInput from 10 slots to 22, silently. So the derivation gets its
 * own positive control rather than resting on the sweeps that consume it.
 *
 * The edge has to hang on code, not on prose or paths. Losing an edge is the
 * safe direction and does not need a guard here: a wrapper whose vocabulary
 * shrinks fails route A of `provider-cascade.svelte.test.ts` loudly
 * (`slots landed, none of them on the root element`).
 */

/** The three components whose body consumes a wrapper cascade. */
const CONSUMERS = ['Input', 'Select', 'Dialog'];

describe('a wrapper names the component it wraps', () => {
  it('in a named import, aliased or not', () => {
    expect(namedConsumers("import { Input } from '$lib/primitives/Input';", CONSUMERS)).toEqual([
      'Input'
    ]);
    // The alias is what the file goes on to use; the export name is still the
    // key the tv() facts are held under, and it is still here, in code.
    expect(
      namedConsumers("import { Input as BaseInput } from '$lib/primitives/Input';", CONSUMERS)
    ).toEqual(['Input']);
  });

  it('in a default import and in the markup that renders it', () => {
    expect(
      namedConsumers(
        "import Dialog from '../Dialog/Dialog.svelte';\n<Dialog {...rest} />",
        CONSUMERS
      )
    ).toEqual(['Dialog']);
  });

  it('and takes no name out of a string literal', () => {
    expect(
      namedConsumers('<Input aria-roledescription="Select a number" />', CONSUMERS),
      'a component name inside an attribute value was read as an edge'
    ).toEqual(['Input']);
  });

  it('and takes none out of an import path', () => {
    expect(
      namedConsumers("import { helper } from './Dialog/helpers';", CONSUMERS),
      'a component name inside an import path was read as an edge'
    ).toEqual([]);
  });

  it('and takes none out of a template literal, while keeping its expressions', () => {
    expect(
      namedConsumers('const label = `pick a Select from the list`;', CONSUMERS),
      'a component name inside template text was read as an edge'
    ).toEqual([]);
    expect(
      namedConsumers('const cls = `${Dialog} row`;', CONSUMERS),
      'an interpolated expression is code and must still be read'
    ).toEqual(['Dialog']);
  });

  it('and takes none out of prose', () => {
    expect(
      namedConsumers('// forwards to the Select below\nconst x = 1;', CONSUMERS),
      'a component name inside a comment was read as an edge'
    ).toEqual([]);
  });
});
