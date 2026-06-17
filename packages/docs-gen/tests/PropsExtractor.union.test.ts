import * as path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { PropsExtractor } from '../src/extractors/typescript/PropsExtractor';

const FIXTURES = path.join(import.meta.dirname, 'fixtures');

let extractor: PropsExtractor;

beforeAll(() => {
  extractor = new PropsExtractor();
});

async function extract(fixture: string, componentName: string) {
  const result = await extractor.extract({
    filePath: path.join(FIXTURES, fixture),
    componentName
  });
  expect(result.success).toBe(true);
  return result.data ?? [];
}

describe('PropsExtractor — discriminated union', () => {
  it('extracts props from a basic 2-arm union and merges them onto the outer alias', async () => {
    const props = await extract('basic-union.ts', 'Basic');
    const byName = Object.fromEntries(props.map((p) => [p.name, p]));

    // All five domain props plus inherited shared fields should be present.
    for (const name of ['variant', 'counter', 'removable', 'intent', 'border']) {
      expect(byName[name], `missing prop ${name}`).toBeDefined();
    }

    // Source re-attribution: every direct prop should point at the outer alias,
    // not at the sub-interfaces (BadgeDotProps / BadgeStandardProps).
    for (const name of ['variant', 'counter', 'removable']) {
      expect(byName[name].source).toEqual({ type: 'direct', name: 'BasicProps' });
    }
  });

  it('detects the discriminator and rebuilds its type as the union of all literals', async () => {
    const props = await extract('basic-union.ts', 'Basic');
    const variant = props.find((p) => p.name === 'variant');
    expect(variant).toBeDefined();
    expect(variant!.values).toEqual(expect.arrayContaining(['dot', 'filled', 'outlined', 'soft']));
    expect(variant!.type).toBe("'dot' | 'filled' | 'outlined' | 'soft'");
    // The discriminator itself never carries conditionalOn — it's always present.
    expect(variant!.conditionalOn).toBeUndefined();
  });

  it('marks discriminator as optional when any arm declares it optional', async () => {
    // BasicStandardProps.variant is optional → public-API view is optional.
    const props = await extract('basic-union.ts', 'Basic');
    const variant = props.find((p) => p.name === 'variant');
    expect(variant!.required).toBe(false);
  });

  it('prefers the discriminator occurrence that carries a @default JSDoc value', async () => {
    // BasicDotProps.variant: 'dot' (required, no default)
    // BasicStandardProps.variant?: ... (@default 'filled')
    // The merged entry should pick the standard arm's defaultValue.
    const props = await extract('basic-union.ts', 'Basic');
    const variant = props.find((p) => p.name === 'variant');
    expect(variant!.defaultValue).toBe("'filled'");
  });

  it('records conditionalOn for props that exist only in some arms', async () => {
    const props = await extract('basic-union.ts', 'Basic');
    const counter = props.find((p) => p.name === 'counter');
    expect(counter).toBeDefined();
    expect(counter!.conditionalOn).toEqual({
      propName: 'variant',
      values: expect.arrayContaining(['filled', 'outlined', 'soft'])
    });
    expect(counter!.conditionalOn!.values).not.toContain('dot');
  });

  it('treats ?: never as absent in that arm (real-typed wins for type/description)', async () => {
    // BasicDotProps.counter?: never; BasicStandardProps.counter?: boolean.
    // Expected: counter is reported as type 'boolean', not 'never'.
    const props = await extract('basic-union.ts', 'Basic');
    const counter = props.find((p) => p.name === 'counter');
    expect(counter!.type).toBe('boolean');
    expect(counter!.description).toBe('Numeric counter shape.');
  });

  it('accepts multi-literal discriminators with non-overlapping value-sets', async () => {
    const props = await extract('multi-literal-discriminator.ts', 'MultiLiteral');
    const variant = props.find((p) => p.name === 'variant');
    expect(variant).toBeDefined();
    expect(variant!.values).toEqual(expect.arrayContaining(['dot', 'filled', 'outlined', 'soft']));
  });

  it('rejects overlapping value-sets — no discriminator is detected', async () => {
    // Both arms declare `mode?: 'edit' | 'view'` — value-sets overlap.
    const props = await extract('no-discriminator.ts', 'NoDiscriminator');
    const alpha = props.find((p) => p.name === 'alpha');
    const beta = props.find((p) => p.name === 'beta');
    // Without a discriminator, conditionalOn cannot be populated meaningfully.
    expect(alpha?.conditionalOn).toBeUndefined();
    expect(beta?.conditionalOn).toBeUndefined();
  });

  it('emits conditionalOn for fullWidth in the Tab-style horizontal/vertical pattern', async () => {
    const props = await extract('horizontal-vertical.ts', 'HV');
    const fullWidth = props.find((p) => p.name === 'fullWidth');
    expect(fullWidth).toBeDefined();
    expect(fullWidth!.conditionalOn).toEqual({
      propName: 'orientation',
      values: ['horizontal']
    });
    expect(fullWidth!.type).toBe('boolean');
  });
});

describe('PropsExtractor — Omit<XVariants, ...> pattern', () => {
  it('emits __OMIT_VARIANT__ markers for each literal key in Omit<XVariants, ...>', async () => {
    // OmitFixtureProps extends Omit<OmitFixtureVariants, 'secretInternal'>.
    // We expect one marker prop named __OMIT_VARIANT__secretInternal so
    // APIDataGenerator can strip the secretInternal variant from the
    // public API surface.
    const props = await extract('omit-variants.ts', 'OmitFixture');
    const marker = props.find((p) => p.name === '__OMIT_VARIANT__secretInternal');
    expect(marker).toBeDefined();
    expect(marker!.type).toBe('omit-marker');
    expect(marker!.source.name).toContain('Omit');
  });

  it('still emits the variant-inheritance placeholder alongside the markers', async () => {
    const props = await extract('omit-variants.ts', 'OmitFixture');
    const placeholder = props.find((p) => p.name === '...OmitFixtureVariants');
    expect(placeholder).toBeDefined();
    expect(placeholder!.source.type).toBe('variant');
  });
});
