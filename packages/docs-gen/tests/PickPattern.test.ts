import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { InheritanceExtractor } from '../src/extractors/typescript/InheritanceExtractor';
import { PropsExtractor } from '../src/extractors/typescript/PropsExtractor';

/**
 * `interface XProps extends Pick<Base, 'a' | 'b'>`.
 *
 * `Omit` had a handler; `Pick` matched no branch at all and fell through to the
 * unknown-inheritance placeholder, so the whole clause reached the catalogue as
 * one prop literally named `...Pick` and its members never appeared. That name
 * is not cosmetic damage: `deriveControls` is fail-loud, so naming any of the
 * lost members in a playground's `pick` list threw at SSR and took the whole
 * doc page down with a 500 (CopyButton, 2026-07-28).
 */

const PKG = path.join(import.meta.dirname, 'fixtures', 'cross-file-pkg');
const CONFIG = path.join(PKG, 'tsconfig.json');
const PICKY = path.join(PKG, 'src', 'Picky', 'index.ts');
const LOCAL = path.join(import.meta.dirname, 'fixtures', 'pick-local.ts');

async function props(
  componentName: string,
  opts: { filePath?: string; configPath?: string; variantKeys?: string[] } = {}
) {
  const extractor = new PropsExtractor(opts.configPath ? { configPath: opts.configPath } : {});
  const result = await extractor.extract({
    filePath: opts.filePath ?? PICKY,
    componentName,
    ...(opts.variantKeys ? { variantKeys: opts.variantKeys } : {})
  });
  expect(result.success).toBe(true);
  return result.data ?? [];
}

async function inheritance(componentName: string) {
  const extractor = new InheritanceExtractor({ configPath: CONFIG });
  const result = await extractor.extract({ filePath: PICKY, componentName });
  expect(result.success).toBe(true);
  return result.data ?? [];
}

describe('PropsExtractor — Pick<ImportedProps, keys> (program-backed)', () => {
  it('expands the picked members instead of emitting one prop named "...Pick"', async () => {
    const extracted = await props('Picky', { configPath: CONFIG });
    const names = extracted.map((p) => p.name);

    expect(names).toContain('label');
    expect(names).toContain('size');
    // The defect itself, named exactly as it appeared in the catalogue.
    expect(names).not.toContain('...Pick');
    // …and no spread placeholder of any spelling stood in for the members.
    expect(names.filter((n) => n.startsWith('...'))).toEqual([]);
  });

  it('keeps the picked members’ own documentation, type and @default', async () => {
    const byName = Object.fromEntries(
      (await props('Picky', { configPath: CONFIG })).map((p) => [p.name, p])
    );

    expect(byName.label?.type).toBe('string');
    expect(byName.label?.description).toContain('Label text');
    expect(byName.label?.required).toBe(false);
    expect(byName.size?.type).toBe("'sm' | 'md' | 'lg'");
    expect(byName.size?.values).toEqual(['sm', 'md', 'lg']);
    expect(byName.size?.defaultValue).toBe("'md'");
    expect(byName.size?.source).toEqual({
      type: 'inherited',
      name: "Pick<BarProps, 'label' | 'size'>"
    });
  });

  it('picks only what was named — unpicked members of the base stay out', async () => {
    // Presence and absence together: an "absent" assertion alone would also
    // hold for the broken behaviour, where no member of the base appeared.
    const names = (await props('Picky', { configPath: CONFIG })).map((p) => p.name).sort();
    expect(names).toEqual(['label', 'own', 'size']); // not `hidden`, not `error`
  });

  it('resolves members that reach the base through a tv() variant alias', async () => {
    // The CopyButton case: `variant`/`intent`/`tier` are not members of
    // ButtonProps at all, they arrive through `VariantProps<typeof
    // buttonVariants>`. A purely syntactic reading of the base interface finds
    // `disabled` and silently loses the rest.
    const byName = Object.fromEntries(
      (await props('ThroughVariantsDeclared', { configPath: CONFIG })).map((p) => [p.name, p])
    );

    expect(Object.keys(byName).sort()).toEqual(['density', 'disabled', 'own', 'tone']);

    // `tone` maps onto a PropertySignature typed with the *config object*
    // (`{ calm: unknown; loud: unknown }`). Reading that declaration's type —
    // rather than asking the checker — is the tempting simplification that
    // would put a config object in the API table.
    expect(byName.tone?.type).toBe("'calm' | 'loud'");
    expect(byName.tone?.values).toEqual(['calm', 'loud']);

    // `density` maps onto a PropertyAssignment: nothing documents it, so the
    // row is the redeclaration's.
    expect(byName.density?.values).toEqual(['compact', 'cosy']);
    expect(byName.density?.description).toBe('Row spacing of the gadget.');
    expect(byName.density?.defaultValue).toBe("'cosy'");
    expect(byName.density?.source).toEqual({
      type: 'direct',
      name: 'ThroughVariantsDeclaredProps'
    });

    // A hand-declared member keeps everything it declares.
    expect(byName.disabled?.type).toBe('boolean');
    expect(byName.disabled?.description).toContain('disabled');
    expect(byName.disabled?.defaultValue).toBe('false');
    expect(byName.disabled?.values).toBeUndefined(); // a boolean is not a two-value dropdown
  });

  it('refuses a picked tv() axis that nothing documents', async () => {
    const extractor = new PropsExtractor({ configPath: CONFIG });
    const result = await extractor.extract({ filePath: PICKY, componentName: 'ThroughVariants' });
    expect(result.success).toBe(false);
    // `tone` has a property signature to read; only `density` is refused.
    expect(result.errors[0]?.message).toMatch(
      /^ThroughVariantsProps: no declaration documents 'density' \(Pick<GadgetProps, [^)]*\)\. Redeclare/
    );
  });

  it("defers a picked key to the component's own tv() axis when it has one", async () => {
    // CopyButton picks ButtonProps' `size` *and* declares a `size` axis of its
    // own. Nothing dedupes props by name downstream, so the pass-through has to
    // stand aside — the component's own axis owns the values and the default.
    const names = (
      await props('ThroughVariants', { configPath: CONFIG, variantKeys: ['density'] })
    ).map((p) => p.name);

    expect(names).not.toContain('density');
    expect(names).toContain('tone');
    expect(names).toContain('disabled');
  });
});

describe('PropsExtractor — Pick<XVariants, keys> (program-backed)', () => {
  it('inverts the picked set into omit markers, mirroring Omit<XVariants, …>', async () => {
    // Picking from a *Variants alias is a statement about which axes are
    // public. `Omit` marks the named keys; `Pick` marks everything else.
    const extracted = await props('PickVariants', {
      configPath: CONFIG,
      variantKeys: ['tone', 'density']
    });
    const names = extracted.map((p) => p.name);

    expect(names).toContain('...ToneVariants');
    expect(names).toContain('__OMIT_VARIANT__density');
    expect(names).not.toContain('__OMIT_VARIANT__tone');
    expect(names).not.toContain('...Pick');

    const placeholder = extracted.find((p) => p.name === '...ToneVariants');
    expect(placeholder?.source.type).toBe('variant');
    const marker = extracted.find((p) => p.name === '__OMIT_VARIANT__density');
    expect(marker?.type).toBe('omit-marker');
  });
});

describe('PropsExtractor — Pick in single-file mode (no program)', () => {
  it('intersects a local base interface with the picked keys', async () => {
    const extracted = await props('PickLocal', { filePath: LOCAL });
    const names = extracted.map((p) => p.name);

    expect(names).toContain('label');
    expect(names).toContain('size');
    expect(names).not.toContain('hidden');
    expect(names).not.toContain('...Pick');

    const size = extracted.find((p) => p.name === 'size');
    expect(size?.values).toEqual(['sm', 'md', 'lg']);
    expect(size?.source).toEqual({
      type: 'inherited',
      name: "Pick<PickLocalBaseProps, 'label' | 'size'>"
    });
  });

  it('names an unresolved utility-type placeholder after its base, never after the utility', async () => {
    const names = (await props('PartialFixture', { filePath: LOCAL })).map((p) => p.name);
    expect(names).not.toContain('...Partial');
    expect(names).toContain('...PickLocalBaseProps');
  });
});

describe('InheritanceExtractor — Pick pattern', () => {
  it('records the clause under its full type, and no members — they are the props rows', async () => {
    for (const [component, clause] of [
      ['Picky', "Pick<BarProps, 'label' | 'size'>"],
      ['ThroughVariants', "Pick<GadgetProps, 'tone' | 'density' | 'disabled'>"],
      ['PickVariants', "Pick<ToneVariants, 'tone'>"]
    ] as const) {
      const entry = (await inheritance(component)).find((i) => i.typeName.startsWith('Pick<'));
      expect(entry).toEqual({ typeName: clause, source: 'pick-pattern' });
    }
  });
});
