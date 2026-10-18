import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PropsExtractor } from '../src/extractors/typescript/PropsExtractor';

/**
 * `interface XProps extends Omit<Derived, K>` where `Derived` extends a base.
 *
 * Everything `Derived` inherits is a member of the clause, and the props list
 * carries it: `LocaleSwitcherProps extends Omit<SelectSingleProps<string>, …>`
 * takes `variant`, `size`, `disabled` and `placeholder` from `SelectBaseProps`,
 * one level below the interface the clause names. A member's type is the one
 * the clause gives it — the written spelling only where the clause leaves it
 * unchanged.
 */

const PKG = path.join(import.meta.dirname, 'fixtures', 'cross-file-pkg');
const CONFIG = path.join(PKG, 'tsconfig.json');
const CHAINY = path.join(PKG, 'src', 'Chainy', 'index.ts');

async function props(componentName: string, variantKeys: string[] = []) {
  const extractor = new PropsExtractor({ configPath: CONFIG });
  const result = await extractor.extract({ filePath: CHAINY, componentName, variantKeys });
  expect(result.success).toBe(true);
  return result.data ?? [];
}

async function byName(componentName: string, variantKeys: string[] = []) {
  return Object.fromEntries((await props(componentName, variantKeys)).map((p) => [p.name, p]));
}

describe('PropsExtractor — Omit<Derived, K> where Derived extends Base (program-backed)', () => {
  it("lists the base's members beside the target's own, minus the omitted key", async () => {
    // Presence and absence in one assertion: `value` (omitted) and `state` (an
    // axis the base itself omits) are out, and nothing is listed twice.
    const names = (await props('Chainy')).map((p) => p.name).sort();
    expect(names).toEqual([
      'density',
      'disabled',
      'fallback',
      'indicator',
      'label',
      'mint',
      'onOpen',
      'onPick',
      'own',
      'placeholder',
      'tone'
    ]);
  });

  it('keeps the DOM-attribute bag out — no member declared outside the package', async () => {
    const names = (await props('Chainy')).map((p) => p.name);
    expect(names).not.toContain('ariaLabel');
    expect(names).not.toContain('role');
    expect(names.filter((n) => n.startsWith('aria'))).toEqual([]);
  });

  it("keeps each base member's own JSDoc and @default, labelled with the Omit clause", async () => {
    const { disabled, placeholder, indicator } = await byName('Chainy');
    // One line, no comment: the clause as the printer spells it, not as written.
    const source = { type: 'inherited', name: "Omit<FrameSingleProps<string>, 'value'>" };

    expect(disabled?.type).toBe('boolean');
    expect(disabled?.description).toBe('Whether the frame is disabled.');
    expect(disabled?.defaultValue).toBe('false');
    expect(disabled?.required).toBe(false);
    expect(disabled?.source).toEqual(source);

    expect(placeholder?.description).toBe('Text shown while nothing is chosen.');
    expect(placeholder?.source).toEqual(source);

    // The target's own member keeps its written spelling and values.
    expect(indicator?.type).toBe("'check' | 'none'");
    expect(indicator?.values).toEqual(['check', 'none']);
    expect(indicator?.source).toEqual(source);
  });

  it('keeps the written spelling of a member whose type the clause leaves alone', async () => {
    // Through `FrameSingleProps<string>` and the Omit, both types are the declared
    // ones. The alias keeps its name beside its values; the checker would spell
    // the literals out.
    const { density, onOpen } = await byName('Chainy');
    expect(density?.type).toBe('FrameDensity');
    expect(density?.values).toEqual(['compact', 'cosy']);
    expect(onOpen?.type).toBe('(open: boolean) => void');
    expect(onOpen?.description).toBe('Fires when the option list opens or closes.');
  });

  it('takes the type the clause gives a member where it differs from the written one', async () => {
    // An instantiated generic: written `T | null`, given `string | null`.
    const { fallback, onPick } = await byName('Chainy');
    expect(fallback?.type).toBe('string | null');
    expect(fallback?.description).toBe('Value shown while nothing is chosen.');
    // A callback over `T`, spelled without the parentheses the checker puts
    // around a function type inside `… | undefined`.
    expect(onPick?.type).toBe('(value: string) => void');
    expect(onPick?.description).toBe('Fires with the value a reader picks.');

    // A type-changing mapped base: written `number`, given `Box<number | undefined>`.
    const { width } = await byName('BoxChain');
    expect(width?.type).toBe('Box<number | undefined>');
    expect(width?.description).toBe('Width in pixels.');
  });

  it('gives a tv() axis reached through the chain its values, not its config', async () => {
    const { tone } = await byName('Chainy');
    expect(tone?.type).toBe("'calm' | 'loud'");
    expect(tone?.values).toEqual(['calm', 'loud']);
    expect(tone?.description).toBe('Inherited from FrameSingleProps<string>.');
  });

  it("lets the interface's own declaration stand in for an inherited one of the same name", async () => {
    // `mint` comes from the chain's base, `label` from the Omit target; both are
    // redeclared on ChainyProps, and the type keeps only that declaration.
    const extracted = await props('Chainy');
    for (const name of ['mint', 'label']) {
      const copies = extracted.filter((p) => p.name === name);
      expect(copies).toHaveLength(1);
      expect(copies[0]?.source).toEqual({ type: 'direct', name: 'ChainyProps' });
    }
  });

  it("defers an inherited axis to the component's own tv() axis of that name", async () => {
    const names = (await props('Chainy', ['tone'])).map((p) => p.name);
    expect(names).not.toContain('tone');
  });
});

describe('PropsExtractor — Pick<Derived, K> where Derived extends Base (program-backed)', () => {
  it('reaches a picked member that lives on the base', async () => {
    const { placeholder, indicator, own } = await byName('PickChain');
    expect(placeholder?.description).toBe('Text shown while nothing is chosen.');
    expect(placeholder?.source).toEqual({
      type: 'inherited',
      name: "Pick<FrameSingleProps<string>, 'placeholder' | 'indicator'>"
    });
    expect(indicator?.values).toEqual(['check', 'none']);
    expect(own?.source).toEqual({ type: 'direct', name: 'PickChainProps' });
    expect(Object.keys(await byName('PickChain')).sort()).toEqual([
      'indicator',
      'own',
      'placeholder'
    ]);
  });
});
