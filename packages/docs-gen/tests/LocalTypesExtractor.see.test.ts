import * as path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { LocalTypesExtractor } from '../src/extractors/typescript/LocalTypesExtractor';
import { getProgramBundle } from '../src/extractors/typescript/ProgramCache';
import type { TypeDefinition } from '../src/types';

const FIXTURES = path.join(import.meta.dirname, 'fixtures');
const PKG = path.join(FIXTURES, 'cross-file-pkg');
const CONFIG = path.join(PKG, 'tsconfig.json');
const FOO = path.join(PKG, 'src', 'Foo', 'index.ts');

/**
 * `@see` on a *type* declaration used to be dropped: the W6 split gave props
 * `seeAlso` (navigable) and `seeAlsoRefs` (prose), but the type extractor only
 * read the description, so `BarChartDatum`'s `@see CartesianDatum` reached
 * `bar-chart/api.ts` with the tag gone.
 *
 * The splitting rule now lives once on `TypeScriptBaseExtractor`, so props and
 * types cannot drift apart — which is what these assertions pin, alongside the
 * two extraction paths a type can arrive through (declared in the file itself;
 * pulled in via a type-only import through the shared ts.Program).
 */

let local: Record<string, TypeDefinition>;

beforeAll(async () => {
  const extractor = new LocalTypesExtractor();
  const result = await extractor.extract({
    filePath: path.join(FIXTURES, 'see-types.ts'),
    componentName: 'SeeTypes',
    packageName: '@fixture/see'
  });
  expect(result.success).toBe(true);
  local = Object.fromEntries((result.data ?? []).map((t) => [t.name, t]));
});

describe('LocalTypesExtractor — @see on a declaration in the file itself', () => {
  it('keeps a bare sibling-type name as prose on an interface', () => {
    expect(local.BarChartDatum?.seeAlsoRefs).toEqual(['CartesianDatum']);
    expect(local.BarChartDatum?.seeAlso).toBeUndefined();
  });

  it('keeps an absolute URL as a link target on a type alias', () => {
    expect(local.ChartScale?.seeAlso).toBe('https://example.com/spec');
    expect(local.ChartScale?.seeAlsoRefs).toBeUndefined();
  });

  it('splits both roles when a declaration carries navigable and prose refs', () => {
    expect(local.ChartConfig?.seeAlso).toBe('/blocks/components/bar-chart#api');
    expect(local.ChartConfig?.seeAlsoRefs).toEqual(['CartesianDatum', 'ChartScale']);
  });

  it('leaves both fields unset when there is no @see — not an empty array', () => {
    // An empty `seeAlsoRefs` would render an orphan "See" label with nothing
    // after it, so absence has to stay absence through the JSON round trip.
    expect(local.PlainDatum?.seeAlso).toBeUndefined();
    expect(local.PlainDatum?.seeAlsoRefs).toBeUndefined();
  });
});

describe('LocalTypesExtractor — @see on a type pulled in by a type-only import', () => {
  it('survives the program-backed path too', async () => {
    // `toTypeDefinition` is a separate construction site from the two
    // in-file ones above; without its own call the imported half of the
    // catalog would silently keep dropping the tag.
    getProgramBundle(CONFIG);
    const extractor = new LocalTypesExtractor({ configPath: CONFIG });
    const result = await extractor.extract({
      filePath: FOO,
      componentName: 'Foo',
      packageName: '@fixture/pkg'
    });
    const byName = Object.fromEntries((result.data ?? []).map((t) => [t.name, t]));

    expect(byName.WidgetTour?.scope).toBe('imported');
    expect(byName.WidgetTour?.seeAlso).toBe('https://example.com/widget-tour');
    expect(byName.WidgetTour?.seeAlsoRefs).toEqual(['WidgetStep']);
  });
});
