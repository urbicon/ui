import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PropsExtractor } from '../src/extractors/typescript/PropsExtractor';

/**
 * Every shape an `Omit` base can take, program-backed. A clause the extractor
 * cannot resolve must not vanish: it either yields its members or fails the
 * extraction, and a member nothing documents fails it too.
 */

const PKG = path.join(import.meta.dirname, 'fixtures', 'omit-shapes-pkg');
const CONFIG = path.join(PKG, 'tsconfig.json');
const SHAPES = path.join(PKG, 'src', 'Shapes', 'index.ts');

async function extract(componentName: string, variantKeys: string[] = []) {
  const extractor = new PropsExtractor({ configPath: CONFIG });
  return extractor.extract({ filePath: SHAPES, componentName, variantKeys });
}

async function rows(componentName: string, variantKeys: string[] = []) {
  const result = await extract(componentName, variantKeys);
  expect(result.errors).toEqual([]);
  return (result.data ?? []).map(
    (p) => `${p.name}: ${p.type}${p.defaultValue ? ` = ${p.defaultValue}` : ''}`
  );
}

async function failure(componentName: string, variantKeys: string[] = []) {
  const result = await extract(componentName, variantKeys);
  expect(result.success).toBe(false);
  return result.errors.map((e) => e.message).join('\n');
}

describe('PropsExtractor — Omit over every base shape (program-backed)', () => {
  it('an interface that extends another', async () => {
    expect(await rows('OmitTwoLevel')).toEqual([
      'b: number',
      'own: string',
      "size: 'sm' | 'md' | 'lg' = 'md'",
      "tone: 'calm' | 'loud'"
    ]);
  });

  it('another Omit', async () => {
    expect(await rows('NestedOmit')).toEqual([
      'own: string',
      "size: 'sm' | 'md' | 'lg' = 'md'",
      "tone: 'calm' | 'loud'"
    ]);
  });

  it('an intersection', async () => {
    expect(await rows('IntersectionOmit')).toEqual([
      'b: number',
      'd: string',
      'own: string',
      "size: 'sm' | 'md' | 'lg' = 'md'",
      "tone: 'calm' | 'loud'"
    ]);
  });

  it('an object type alias', async () => {
    expect(await rows('AliasOmit')).toEqual(['f: number', 'own: string']);
  });

  it('keys named by keyof another interface', async () => {
    expect(await rows('OmitKeyof')).toEqual([
      'b: number',
      'own: string',
      "size: 'sm' | 'md' | 'lg' = 'md'"
    ]);
  });

  it('an interface that omits from an in-package attribute bag of its own', async () => {
    expect(await rows('OmitDom')).toEqual([
      "a: string = 'x'",
      'b: number',
      'c: boolean',
      'id: string',
      'own: string',
      "size: 'sm' | 'md' | 'lg' = 'md'",
      "tone: 'calm' | 'loud'"
    ]);
  });

  it('an instantiated generic', async () => {
    expect(await rows('GenericOmit')).toEqual(['items: string[]', 'own: string', 'value: string']);
  });

  it('a generic the props type leaves open', async () => {
    expect(await rows('OpenGeneric')).toEqual(['items: T[]', 'own: T', 'value: T']);
  });

  it('a mapped type over an interface', async () => {
    expect(await rows('PartialOmit')).toEqual([
      'b: number',
      'own: string',
      "size: 'sm' | 'md' | 'lg' = 'md'",
      "tone: 'calm' | 'loud'"
    ]);
  });

  it('Pick across two levels, beside them', async () => {
    expect(await rows('PickTwoLevel')).toEqual([
      "a: string = 'x'",
      'own: string',
      "size: 'sm' | 'md' | 'lg' = 'md'"
    ]);
  });
});

describe('PropsExtractor — a name two clauses bring', () => {
  it('is one row, read from the first clause — the declaration the type keeps', async () => {
    expect(await rows('TwoClauses')).toEqual([
      'd: string',
      'own: string',
      "size: 'sm' | 'md' | 'lg' = 'md'",
      "tone: 'calm' | 'loud'"
    ]);
    // Order decides: with the Pick first, OtherProps' `size` (no default) is it.
    expect(await rows('TwoClausesReversed')).toEqual([
      'd: string',
      'own: string',
      "size: 'sm' | 'md' | 'lg'",
      "tone: 'calm' | 'loud'"
    ]);
  });
});

describe('PropsExtractor — a clause that contributes nothing fails the extraction', () => {
  it('an Omit whose members are all declared outside the package', async () => {
    expect(await failure('ForeignOmit')).toMatch(
      /Omit<Partial<ARIAMixin>, 'role'>: every member it resolves to is declared outside the package/
    );
  });

  it('an Omit that resolves to no member', async () => {
    expect(await failure('NothingOmit')).toMatch(
      /Omit<Record<never, string>, 'x'>: it resolves to no members/
    );
  });

  it('a Pick that resolves to no member', async () => {
    expect(await failure('NothingPick')).toMatch(
      /Pick<Record<never, string>, never>: it resolves to no members/
    );
  });
});

describe('PropsExtractor — a tv() axis inherited through a props interface', () => {
  it('fails the extraction until the interface redeclares it', async () => {
    const message = await failure('BareAxis');
    expect(message).toContain(
      "BareAxisProps: no declaration documents 'density' (Omit<WidgetProps, 'label'>)"
    );
    expect(message).toContain('Redeclare each on BareAxisProps');
    expect(await failure('BarePickAxis')).toContain(
      "BarePickAxisProps: no declaration documents 'density' (Pick<WidgetProps, 'density' | 'label'>)"
    );
  });

  it('takes the redeclaration — its JSDoc, its @default, the values in config order', async () => {
    const result = await extract('DeclaredAxis');
    expect(result.errors).toEqual([]);
    const density = (result.data ?? []).find((p) => p.name === 'density');
    expect(density?.source).toEqual({ type: 'direct', name: 'DeclaredAxisProps' });
    expect(density?.description).toBe('Row spacing, forwarded to the widget.');
    expect(density?.defaultValue).toBe("'roomy'");
    expect(density?.values).toEqual(['roomy', 'compact']);
  });

  it("stands aside for the component's own axis of that name", async () => {
    // The variants pass documents it, from the component's own config.
    const names = (await rows('BareAxis', ['density'])).map((r) => r.split(':')[0]);
    expect(names).toEqual(['own']);
  });
});
