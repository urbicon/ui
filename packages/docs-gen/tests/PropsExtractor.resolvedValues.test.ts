import * as path from 'node:path';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { PropsExtractor } from '../src/extractors/typescript/PropsExtractor';
import type { PropInfo } from '../src/types';

/**
 * A prop's `values` are the literals its type stands for as the checker sees
 * it, not only the ones written at the declaration. `intent?: ComponentIntent`
 * (`(typeof INTENTS)[number]`) and `variant?: ButtonVariants['variant']` (an
 * axis of `VariantProps<typeof buttonVariants>`) list no literal where they are
 * used, so the API table showed an opaque name and every playground knob for
 * them needed a hand-written option list.
 */

const PKG = path.join(import.meta.dirname, 'fixtures', 'cross-file-pkg');
const CONFIG = path.join(PKG, 'tsconfig.json');
const RESOLVY = path.join(PKG, 'src', 'Resolvy', 'index.ts');
const SHARED = path.join(PKG, 'src', 'shared', 'resolvy.ts');

/**
 * Makes the checker create the fixture's literals in reverse source order
 * before extraction, the way an earlier component in the same run would.
 * Unions are reported in creation order, so a result that merely passes the
 * checker's order through comes back reversed.
 */
function createLiteralsInReverse(extractor: PropsExtractor): void {
  const shared = extractor.getProgram().getSourceFile(SHARED);
  const reversed = shared?.statements.find(
    (s): s is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(s) && s.name.text === 'ReversedLiterals'
  );
  if (!reversed) throw new Error('fixture: ReversedLiterals not found');
  extractor.getChecker().getTypeFromTypeNode(reversed.type);
}

async function propsOf(
  componentName: string,
  opts: { configPath?: string } = { configPath: CONFIG }
): Promise<Record<string, PropInfo>> {
  const extractor = new PropsExtractor(opts.configPath ? { configPath: opts.configPath } : {});
  if (opts.configPath) createLiteralsInReverse(extractor);
  const result = await extractor.extract({ filePath: RESOLVY, componentName });
  expect(result.success).toBe(true);
  return Object.fromEntries((result.data ?? []).map((p) => [p.name, p]));
}

describe('PropsExtractor — values the written type does not list (program-backed)', () => {
  it('resolves a computed union over a const tuple, in tuple order', async () => {
    const { tone } = await propsOf('Resolvy');
    expect(tone?.values).toEqual(['calm', 'loud', 'quiet']);
    // The displayed type stays the name the source uses.
    expect(tone?.type).toBe('Tone');
  });

  it('resolves a tv() axis read by key, in config order', async () => {
    const { scale } = await propsOf('Resolvy');
    expect(scale?.values).toEqual(['sm', 'md', 'lg']);
    expect(scale?.type).toBe("ScaleVariants['scale']");
  });

  it('resolves a member of another interface read by key, in written order', async () => {
    const { layout } = await propsOf('Resolvy');
    expect(layout?.values).toEqual(['stacked', 'inline']);
  });

  it('expands a template literal over unions, in written order', async () => {
    const { spot } = await propsOf('Resolvy');
    expect(spot?.values).toEqual([
      'top',
      'bottom',
      'top-start',
      'top-end',
      'bottom-start',
      'bottom-end'
    ]);
  });

  it('sees through NonNullable', async () => {
    const { strictScale } = await propsOf('Resolvy');
    expect(strictScale?.values).toEqual(['sm', 'md', 'lg']);
  });

  it('sorts the values when the source fixes no order', async () => {
    // A conditional type. The checker creates `b`, `c`, `a` as written and
    // reports them in that order; only the sort turns it into this one.
    const { letter } = await propsOf('Resolvy');
    expect(letter?.values).toEqual(['a', 'b', 'c']);
  });

  it('leaves a boolean a flag and a non-literal type without values', async () => {
    const { flag, label } = await propsOf('Resolvy');
    // `boolean` is `true | false` to the checker; a dropdown would be wrong.
    expect(flag?.values).toBeUndefined();
    expect(label?.values).toBeUndefined();
  });

  it('keeps the literals a mixed written union lists', async () => {
    // The checker would drop the whole union (`number` is not a literal); the
    // written `'auto'` is still the one value a reader can pick by name.
    const { height } = await propsOf('Resolvy');
    expect(height?.values).toEqual(['auto']);
  });

  it('orders a picked tv() axis by its config, not by the checker', async () => {
    const extracted = await propsOf('PickScale');
    expect(extracted.scale?.values).toEqual(['sm', 'md', 'lg']);
    expect(extracted.scale?.type).toBe("'sm' | 'md' | 'lg'");
    expect(extracted.layout?.values).toEqual(['stacked', 'inline']);
  });
});

describe('PropsExtractor — values the written type does not list (single-file mode)', () => {
  it('records no values without a program to ask', async () => {
    // The documented boundary: without a checker only written literals count.
    const props = await propsOf('Resolvy', {});
    expect(props.tone?.values).toBeUndefined();
    expect(props.scale?.values).toBeUndefined();
    expect(props.height?.values).toEqual(['auto']);
  });
});
