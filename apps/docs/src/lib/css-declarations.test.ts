import { describe, expect, it } from 'vitest';
import { baseDeclarations, parseDeclarations, references } from './css-declarations';

/**
 * The parser contract from the module header, one test per clause. Both
 * consumers — the Token Reference tables and the theme previews — read the
 * shipped stylesheets through this, so a clause failing here is a wrong value
 * printed in the docs or a wrong colour rendered in a preview.
 */

describe('value scanning', () => {
  it('keeps nested parentheses instead of truncating at the inner one', () => {
    const [primary, mixed] = parseDeclarations(`:root {
      --a: oklch(from var(--color-primary-600) calc(l + 0.08) c h);
      --b: color-mix(in oklab, #fff 20%, #000);
    }`);
    expect(primary.value).toBe('oklch(from var(--color-primary-600) calc(l + 0.08) c h)');
    expect(mixed.value).toBe('color-mix(in oklab, #fff 20%, #000)');
  });

  it('keeps a multi-layer value whole across its line breaks', () => {
    const [shadow] = parseDeclarations(`:root {
      --blocks-shadow-sm:
        0 1px 3px 0 light-dark(oklch(0 0 0 / 0.1), oklch(0 0 0 / 0.3)),
        0 1px 2px -1px light-dark(oklch(0 0 0 / 0.1), oklch(0 0 0 / 0.3));
    }`);
    expect(shadow.value).toBe(
      '0 1px 3px 0 light-dark(oklch(0 0 0 / 0.1), oklch(0 0 0 / 0.3)), ' +
        '0 1px 2px -1px light-dark(oklch(0 0 0 / 0.1), oklch(0 0 0 / 0.3))'
    );
  });

  it('accepts the last declaration of a block without its semicolon', () => {
    const parsed = parseDeclarations(':root { --a: red; --b: blue }');
    expect(parsed.map((d) => [d.name, d.value])).toEqual([
      ['--a', 'red'],
      ['--b', 'blue']
    ]);
  });

  it('discards a declaration that runs to EOF instead of eating the rest of the file', () => {
    // A truncated stylesheet: without the guard, `--b` takes everything after
    // it — comments, selectors, the lot — as its value.
    const parsed = parseDeclarations(':root { --a: red; --b: blue');
    expect(parsed.map((d) => d.name)).toEqual(['--a']);
  });

  it('ignores token names that only appear in comments', () => {
    const parsed = parseDeclarations(`@theme {
      /* … all shades --color-primary-200 to --color-primary-800 … */
      --color-primary-500: oklch(0.58 0.15 280);
    }`);
    expect(parsed.map((d) => d.name)).toEqual(['--color-primary-500']);
  });

  it('does not read a var() reference as a declaration of that name', () => {
    const parsed = parseDeclarations(':root { --a: var(--b); }');
    expect(parsed.map((d) => d.name)).toEqual(['--a']);
  });
});

describe('brace context', () => {
  const css = `@theme {
      --base: 1;
    }
    :root {
      --root: 2;
    }
    @media (pointer: coarse) {
      :root {
        --touch: 3;
      }
    }`;

  it('reports depth 1 for @theme and top-level :root, deeper for at-rules', () => {
    expect(parseDeclarations(css).map((d) => [d.name, d.depth])).toEqual([
      ['--base', 1],
      ['--root', 1],
      ['--touch', 2]
    ]);
  });
});

describe('baseDeclarations', () => {
  it('keeps only the base values, so an at-rule token is never a default', () => {
    const css = `:root { --a: 1; }
      @media (pointer: coarse) { :root { --touch: 44px; } }`;
    expect(baseDeclarations([css]).map((d) => d.name)).toEqual(['--a']);
  });

  it('is first-wins, so an at-rule re-declaration cannot shadow the base value', () => {
    const css = `:root { --a: 1; }
      @media print { :root { --a: 2; } }
      :root { --a: 3; }`;
    expect(baseDeclarations([css]).map((d) => d.value)).toEqual(['1']);
  });

  it('numbers declarations across sources in document order', () => {
    const declarations = baseDeclarations([':root { --a: 1; }', ':root { --b: 2; }']);
    expect(declarations.map((d) => [d.name, d.index])).toEqual([
      ['--a', 0],
      ['--b', 1]
    ]);
  });
});

describe('references', () => {
  it('finds every var() a value reads, whitespace and nesting included', () => {
    expect(references('light-dark( var( --a ), var(--b))')).toEqual(['--a', '--b']);
  });

  it('finds none in a literal', () => {
    expect(references('oklch(0.55 0.016 240)')).toEqual([]);
  });
});
