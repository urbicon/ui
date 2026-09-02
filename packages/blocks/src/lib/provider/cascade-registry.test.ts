// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { numberInputVariants } from '$lib/components/NumberInput/numberinput.variants';
import { exportedComponents, namedConsumers } from './__fixtures__/cascade-registry';

/**
 * The wrapper → inner-component edge, which nothing downstream can check.
 *
 * The cascade sweeps read a wrapper's slot vocabulary through this edge, and a
 * wrong edge only ever *widens* that vocabulary: the extra slots land nowhere,
 * the routes still find the ones that do, and every sweep stays green. Two
 * measurements, both silent, both taking `NumberInput` from 10 slots to 22 —
 * one attribute value (`aria-roledescription="Select a number"`) and one
 * ordinary markup comment above the stepper snippet.
 *
 * So the edge is read off the Svelte compiler's own parse rather than off the
 * text. Comments, text nodes, attribute values, attribute names and regex
 * literals are excluded by construction, because the parser knows what they
 * are — where a strip only ever excludes the vector last found. `<!-- -->` is
 * the mandatory comment form in Svelte markup and `NumberInput.svelte` already
 * carries one, so "not code" here is a much larger set than JavaScript's.
 *
 * Losing an edge needs no guard: it shrinks a vocabulary, and route A of
 * `provider-cascade.svelte.test.ts` reports that loudly (measured — renaming
 * ConfirmDialog's default import to `Dlg` reddens four routes).
 */

/** The three components whose body consumes a wrapper cascade. */
const CONSUMERS = ['Input', 'Select', 'Dialog'];

const source = (script: string, markup = '<span></span>') =>
  `<script lang="ts">\n${script}\n</script>\n\n${markup}\n`;

const IMPORT_INPUT = "import { Input } from '$lib/primitives/Input';";

describe('a wrapper names the component it wraps', () => {
  it('in a named import, aliased or not', () => {
    expect(namedConsumers(source(IMPORT_INPUT, '<Input />'), CONSUMERS)).toEqual(['Input']);
    // The alias is what the markup uses; the export name is still the key the
    // tv() facts are held under, and the import clause still carries it.
    expect(
      namedConsumers(
        source("import { Input as BaseInput } from '$lib/primitives/Input';", '<BaseInput />'),
        CONSUMERS
      )
    ).toEqual(['Input']);
  });

  it('in a default import and in the tag that renders it', () => {
    expect(
      namedConsumers(
        source("import Dialog from '../Dialog/Dialog.svelte';", '<Dialog />'),
        CONSUMERS
      )
    ).toEqual(['Dialog']);
  });
});

describe('and takes no name out of anything that is not code', () => {
  it.each([
    [
      'a markup comment',
      source(IMPORT_INPUT, '<!-- The arrows step the value, not a Select. -->\n<Input />')
    ],
    ['markup text', source(IMPORT_INPUT, '<Input />\n<span>Select a number</span>')],
    ['a regex literal', source(`${IMPORT_INPUT}\nconst re = /Select/;`, '<Input />')],
    [
      'an attribute value',
      source(IMPORT_INPUT, '<Input aria-roledescription="Select a number" />')
    ],
    ['an attribute name', source(IMPORT_INPUT, '<Input data-Select-hint="1" />')],
    [
      '{#each} body text',
      source(
        `${IMPORT_INPUT}\nconst items: string[] = [];`,
        '{#each items as item}Select{/each}\n<Input />'
      )
    ]
  ])('%s', (_what, code) => {
    expect(namedConsumers(code, CONSUMERS)).toEqual(['Input']);
  });

  it('an import path', () => {
    expect(namedConsumers(source("import { helper } from './Dialog/helpers';"), CONSUMERS)).toEqual(
      []
    );
  });

  it('a JS comment', () => {
    expect(
      namedConsumers(source(`// forwards to the Select below\nconst x = 1;`), CONSUMERS)
    ).toEqual([]);
  });
});

describe('end to end, on the real component sources', () => {
  it('gives each wrapper the vocabulary of what it wraps, and nothing else', async () => {
    const components = await exportedComponents();
    const find = (name: string) => components.find((entry) => entry.exportName === name);
    /** Slots a wrapper composes from a tv() config of its own, so legitimately extra. */
    const own: Record<string, string[]> = {
      NumberInput: Object.keys(numberInputVariants.config.slots ?? {})
    };

    for (const [wrapper, inner] of [
      ['NumberInput', 'Input'],
      ['CurrencyInput', 'Input'],
      ['LocaleSwitcher', 'Select'],
      ['ConfirmDialog', 'Dialog']
    ]) {
      const outer = find(wrapper);
      const wrapped = find(inner);
      expect(outer, `${wrapper} is not in the registry`).toBeDefined();
      expect(wrapped, `${inner} is not in the registry`).toBeDefined();

      const allowed = new Set([...(wrapped?.slots ?? []), ...(own[wrapper] ?? [])]);
      expect(
        (outer?.slots ?? []).filter((slot) => !allowed.has(slot)).sort(),
        `${wrapper} carries slots that belong to neither ${inner} nor its own tv() config — ` +
          'a widened vocabulary, which every sweep that reads it will accept in silence'
      ).toEqual([]);
    }
  });
});
