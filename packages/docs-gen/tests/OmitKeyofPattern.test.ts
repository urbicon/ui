import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PropsExtractor } from '../src/extractors/typescript/PropsExtractor';

/**
 * `Omit<B, K>` / `Pick<B, K>` where `K` does not spell its members at the use
 * site — `keyof U`, a union alias, an `Exclude<…>`.
 *
 * Scanning the written key argument for quoted names finds nothing in any of
 * those, so the omitted members stayed in the generated output: `api.ts`,
 * `llms-full.txt` and both component catalogues advertised `dayState`,
 * `selected`, `weekend` and `outside` as Planner props — one of them with a
 * worked `<Planner dayState="default">` example — while `svelte-check` rejects
 * that markup. The `Pick` direction fails the other way: nothing picked means
 * every axis suppressed.
 */

const PKG = path.join(import.meta.dirname, 'fixtures', 'cross-file-pkg');
const CONFIG = path.join(PKG, 'tsconfig.json');
const OMITTY = path.join(PKG, 'src', 'Omitty', 'index.ts');

/** Every axis of the fixture's tv() config, as VariantsExtractor reports them. */
const GRID_AXES = ['view', 'variant', 'size', 'dayState', 'selected', 'weekend', 'outside'];
const CELL_AXES = ['dayState', 'selected', 'weekend', 'outside'];

async function props(componentName: string, variantKeys: string[] = GRID_AXES) {
  const extractor = new PropsExtractor({ configPath: CONFIG });
  const result = await extractor.extract({ filePath: OMITTY, componentName, variantKeys });
  expect(result.success).toBe(true);
  return result.data ?? [];
}

/** The axes a clause suppressed, read back off the `__OMIT_VARIANT__` markers. */
async function suppressedAxes(componentName: string): Promise<string[]> {
  return (await props(componentName))
    .filter((p) => p.name.startsWith('__OMIT_VARIANT__'))
    .map((p) => p.name.slice('__OMIT_VARIANT__'.length))
    .sort();
}

describe('PropsExtractor — Omit<XVariants, K> where K names no key literally', () => {
  it('suppresses the axes behind a `keyof`, beside a literal key (the Planner shape)', async () => {
    // OmitKeyofProps extends Omit<GridVariants, 'view' | keyof GridCellState>.
    expect(await suppressedAxes('OmitKeyof')).toEqual([...CELL_AXES, 'view'].sort());
  });

  it('suppresses the axes behind a bare `keyof`, with no literal to scan for', async () => {
    expect(await suppressedAxes('OmitKeyofOnly')).toEqual([...CELL_AXES].sort());
  });

  it('suppresses the axes behind a union alias — no `keyof` token either', async () => {
    expect(await suppressedAxes('OmitAlias')).toEqual([...CELL_AXES].sort());
  });

  it('suppresses the axes behind an `Exclude`, where the set is computed', async () => {
    // Omit<GridVariants, Exclude<keyof GridVariants, 'variant' | 'size'>>
    expect(await suppressedAxes('OmitExclude')).toEqual(
      GRID_AXES.filter((k) => k !== 'variant' && k !== 'size').sort()
    );
  });

  it('keeps the variant placeholder beside the markers', async () => {
    const placeholder = (await props('OmitKeyof')).find((p) => p.name === '...GridVariants');
    expect(placeholder?.source.type).toBe('variant');
  });
});

describe('PropsExtractor — Pick<XVariants, keyof U>', () => {
  it('suppresses everything the `keyof` did not select, and nothing it did', async () => {
    // PickKeyofProps extends Pick<GridVariants, keyof GridPublicAxes>, where
    // GridPublicAxes is `Pick<GridVariants, 'variant' | 'size'>`. Reading no
    // key out of the clause suppresses *every* axis here — the same gap, with
    // the sign flipped.
    expect(await suppressedAxes('PickKeyof')).toEqual(
      GRID_AXES.filter((k) => k !== 'variant' && k !== 'size').sort()
    );
  });
});

describe('PropsExtractor — Omit<Interface, keyof U>', () => {
  it('drops the members named by the `keyof` and keeps the rest', async () => {
    // Presence and absence together: an absence-only assertion would also hold
    // for a clause that resolved to nothing at all.
    const names = (await props('OmitInterfaceKeyof', [])).map((p) => p.name).sort();
    expect(names).toEqual(['label', 'own', 'size']); // not `hidden`, not `secret`
  });
});
