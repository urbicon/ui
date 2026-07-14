import * as path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SvelteDocsParser } from '../src/parsers/SvelteDocsParser';
import {
  parseDocsConfigFromSvelte,
  StaticDocsConfigError
} from '../src/parsers/static-docs-config';

// ---------------------------------------------------------------------------
// docsConfig used to be recovered by `eval('(' + regexSlice + ')')` — build-time
// code execution over source-file contents, behind a non-greedy regex that
// truncated the object at the first `};`. It is now folded off the TypeScript
// AST. These tests pin: the accepted literal grammar, the fail-loud behaviour on
// anything not statically knowable (with position), and the two bugs the regex
// + eval pair used to have.
// ---------------------------------------------------------------------------

const FIXTURES = path.join(import.meta.dirname, 'fixtures');

beforeAll(() => {
  // The parser logs progress per component; keep the suite output clean.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

/** Wrap a docsConfig body in a minimal, realistic .svelte shell. */
const svelte = (config: string, typed = true) => `<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';

  export const docsConfig${typed ? ': SvelteDocsConfig' : ''} = ${config};
</script>

<div>markup</div>
`;

describe('parseDocsConfigFromSvelte — valid configs', () => {
  it('folds a nested config: objects, arrays, strings, numbers, booleans', () => {
    const config = parseDocsConfigFromSvelte(
      svelte(`{
        generation: {
          playground: { featured: ['size', 'intent'], enabled: true, order: 1 },
          examples: false,
          api: { showInheritance: true, order: 14 }
        },
        llm: { include: true, maxSections: 8, priority: ['overview', 'api'] },
        meta: { title: 'Drawer Component', showToc: true }
      }`),
      'docs.svelte'
    );

    expect(config).toEqual({
      generation: {
        playground: { featured: ['size', 'intent'], enabled: true, order: 1 },
        examples: false,
        api: { showInheritance: true, order: 14 }
      },
      llm: { include: true, maxSections: 8, priority: ['overview', 'api'] },
      meta: { title: 'Drawer Component', showToc: true }
    });
  });

  it('folds null, undefined, negative and float numbers, and empty collections', () => {
    const config = parseDocsConfigFromSvelte(
      svelte(`{
        a: null,
        b: undefined,
        c: -5,
        d: 1.5,
        e: [],
        f: {},
        g: [[1, 2], [{ deep: true }]]
      }`),
      'docs.svelte'
    );

    expect(config).toEqual({
      a: null,
      b: undefined,
      c: -5,
      d: 1.5,
      e: [],
      f: {},
      g: [[1, 2], [{ deep: true }]]
    });
  });

  it('accepts quoted and numeric keys, `as const`, and plain <script> blocks', () => {
    const config = parseDocsConfigFromSvelte(
      `<script>
        export const docsConfig = { 'quoted-key': 1, 0: 'zero', order: 2 as const };
      </script>`,
      'docs.svelte'
    );

    expect(config).toEqual({ 'quoted-key': 1, 0: 'zero', order: 2 });
  });

  it('returns null when the file exports no docsConfig (defaults apply, not an error)', () => {
    expect(
      parseDocsConfigFromSvelte('<script>let x = 1;</script><div/>', 'docs.svelte')
    ).toBeNull();
  });

  it('ignores a non-exported or differently-named docsConfig', () => {
    expect(
      parseDocsConfigFromSvelte('<script>const docsConfig = { a: 1 };</script>', 'docs.svelte')
    ).toBeNull();
  });
});

describe('parseDocsConfigFromSvelte — regressions of the regex+eval pair', () => {
  it('does NOT truncate at a `};` inside a string (the old non-greedy regex did)', () => {
    // The old pattern `({[\s\S]*?});` stopped at the first `};` — here, inside a
    // string literal — silently dropping every later key.
    const config = parseDocsConfigFromSvelte(
      svelte(`{
        meta: { title: 'Use it like: const cfg = {};' },
        llm: { include: false }
      }`),
      'docs.svelte'
    );

    expect(config).toEqual({
      meta: { title: 'Use it like: const cfg = {};' },
      llm: { include: false }
    });
  });

  it('does not execute code: a call expression is rejected, not evaluated', () => {
    const spy = vi.fn();
    (globalThis as Record<string, unknown>).__docsGenSideEffect = spy;

    expect(() =>
      parseDocsConfigFromSvelte(
        svelte('{ meta: { title: globalThis.__docsGenSideEffect() } }'),
        'docs.svelte'
      )
    ).toThrow(StaticDocsConfigError);

    // eval() would have called it; the AST fold never runs anything.
    expect(spy).not.toHaveBeenCalled();
    delete (globalThis as Record<string, unknown>).__docsGenSideEffect;
  });

  it('keeps a literal __proto__ key as an own property (no prototype pollution)', () => {
    const config = parseDocsConfigFromSvelte(
      svelte(`{ meta: { '__proto__': { polluted: true } } }`),
      'docs.svelte'
    ) as { meta: Record<string, unknown> };

    expect(Object.hasOwn(config.meta, '__proto__')).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('parseDocsConfigFromSvelte — fail-loud on non-static content', () => {
  // Each case is a construct eval() would happily have run (or silently
  // mis-parsed); all must now raise a positioned error instead of `{}`.
  const cases: Array<{ name: string; config: string; match: RegExp }> = [
    {
      name: 'identifier reference',
      config: '{ meta: { title: SOME_CONSTANT } }',
      match: /cannot statically evaluate Identifier/
    },
    {
      name: 'object spread',
      config: '{ ...base, llm: { include: true } }',
      match: /object spreads are not supported/
    },
    {
      name: 'array spread',
      config: '{ llm: { priority: [...defaults] } }',
      match: /spread elements are not supported/
    },
    {
      name: 'shorthand property',
      config: '{ include }',
      match: /shorthand property 'include' references a binding/
    },
    {
      name: 'template literal with substitution',
      config: '{ meta: { title: `Drawer ${version}` } }',
      match: /template literals with \$\{…\} substitutions/
    },
    {
      name: 'arrow function value',
      config: '{ meta: { format: () => 1 } }',
      match: /cannot statically evaluate ArrowFunction/
    },
    {
      name: 'computed key',
      config: '{ [dynamicKey]: 1 }',
      match: /computed \/ non-literal property keys/
    },
    {
      name: 'method',
      config: '{ format() { return 1; } }',
      match: /methods and accessors are not supported/
    },
    {
      name: 'arithmetic expression',
      config: '{ llm: { maxSections: 4 + 4 } }',
      match: /cannot statically evaluate BinaryExpression/
    },
    {
      name: 'non-object initializer',
      config: `'not-an-object'`,
      match: /docsConfig must be an object literal/
    }
  ];

  for (const { name, config, match } of cases) {
    it(`throws a positioned error for a ${name}`, () => {
      expect(() => parseDocsConfigFromSvelte(svelte(config), 'docs.svelte')).toThrow(match);
      // Never a silent `{}`.
      expect(() => parseDocsConfigFromSvelte(svelte(config), 'docs.svelte')).toThrow(
        StaticDocsConfigError
      );
    });
  }

  it('reports the position in the original .svelte file, not the script slice', () => {
    // `BAD` sits on line 6, column 20 of the whole file — the masking keeps
    // .svelte coordinates intact so the message points at what the author wrote.
    const content = `<div>markup</div>
<script lang="ts">
  export const docsConfig = {
    meta: {
      title: 'ok',
      badValue: BAD
    }
  };
</script>`;

    try {
      parseDocsConfigFromSvelte(content, '/abs/path/docs.svelte');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(StaticDocsConfigError);
      const staticError = error as StaticDocsConfigError;
      expect(staticError.file).toBe('/abs/path/docs.svelte');
      expect(staticError.line).toBe(6);
      expect(staticError.column).toBe(17);
      expect(staticError.message).toContain('/abs/path/docs.svelte:6:17');
      // The line/column really do address `BAD` in the source.
      const line = content.split('\n')[staticError.line - 1] as string;
      expect(line.slice(staticError.column - 1)).toBe('BAD');
    }
  });
});

describe('SvelteDocsParser.parseDocsFile — integration', () => {
  const parser = new SvelteDocsParser();

  it('parses a realistic docs page and merges it over the defaults', async () => {
    const result = await parser.parseDocsFile(
      'Drawer',
      path.join(FIXTURES, 'docsconfig-page.svelte')
    );

    expect(result.exists).toBe(true);
    expect(result.errors).toEqual([]);
    // Authored values win …
    expect(result.docsConfig.meta?.title).toBe('Drawer Component');
    expect(result.docsConfig.llm?.maxSections).toBe(8);
    expect(result.docsConfig.generation?.playground?.featured).toEqual([
      'placement',
      'size',
      'hideCloseButton'
    ]);
    expect(result.docsConfig.generation?.examples).toBe(false);
    // … and unspecified keys fall back to the defaults.
    expect(result.docsConfig.llm?.simplifyContent).toBe(true);
  });

  it('returns defaults without touching the disk when no docs file is given', async () => {
    const result = await parser.parseDocsFile('Button');

    expect(result.exists).toBe(false);
    expect(result.errors).toEqual([]);
    expect(result.docsConfig.llm?.include).toBe(true);
  });

  it('surfaces a non-static config as an error instead of silently using {}', async () => {
    const result = await parser.parseDocsFile(
      'Broken',
      path.join(FIXTURES, 'does-not-exist-docs.svelte')
    );

    // Unreadable file: reported, not swallowed.
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Failed to parse docs.svelte');
  });
});
