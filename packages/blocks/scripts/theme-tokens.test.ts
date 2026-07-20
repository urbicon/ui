import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkClassToken, collectThemeVars, utilityOf } from './theme-tokens';

/**
 * Unit tests for the variants-lint theme-existence guard
 * (scripts/theme-tokens.ts).
 *
 * The valid/dead class fixtures below are NOT invented: each one was
 * ground-truthed against the real Tailwind 4 compiler (@tailwindcss/node
 * `compile().build([...])` over theme.css + foundation/semantic/table-theme/
 * docs-theme, 2026-07-20). If Tailwind's resolution rules change on an
 * upgrade, re-run that experiment before touching the expectations.
 */

// ─── @theme parsing ──────────────────────────────────────────────────────────

describe('collectThemeVars', () => {
  it('collects declarations from multiple @theme blocks, including compat variants', () => {
    const vars = collectThemeVars(`
      @theme {
        --text-2xs: 0.6875rem;
        --radius-commit: 9999px;
      }
      @theme default inline reference {
        --radius: 0.25rem;
      }
    `);
    expect(vars).toEqual(new Set(['--text-2xs', '--radius-commit', '--radius']));
  });

  it('ignores declarations outside @theme (:root) and inside nested blocks (@keyframes)', () => {
    const vars = collectThemeVars(`
      :root {
        --blocks-shadow-sm: 0 1px 2px rgb(0 0 0 / 0.05);
      }
      @theme {
        --text-xs: 0.75rem;
        @keyframes spin {
          to {
            --fake-inside-keyframes: 1;
            transform: rotate(360deg);
          }
        }
        --tracking-wide: 0.025em;
      }
    `);
    expect(vars).toEqual(new Set(['--text-xs', '--tracking-wide']));
  });

  it('does not read vars out of comments or values', () => {
    const vars = collectThemeVars(`
      @theme {
        /* NO paired --text-xs--line-height: see foundation.css */
        --leading-tight: 1.25;
        --default-font-family: --theme(--font-sans, initial);
      }
    `);
    expect(vars).toEqual(new Set(['--leading-tight', '--default-font-family']));
  });

  it('parses the real theme sources the lint runs on (canaries per file)', () => {
    const repo = resolve(__dirname, '../../..');
    const require = createRequire(import.meta.url);
    const read = (p: string) => readFileSync(p, 'utf-8');
    const tailwind = collectThemeVars(read(require.resolve('tailwindcss/theme.css')));
    // default theme + the deprecated compat block (nested @keyframes must not break parsing)
    expect(tailwind).toContain('--text-xs');
    expect(tailwind).toContain('--radius');
    expect(tailwind).toContain('--color-white');
    expect(tailwind).not.toContain('--text-2xs');
    expect(tailwind.size).toBeGreaterThan(300);

    const foundation = collectThemeVars(
      read(resolve(repo, 'packages/blocks/src/lib/style/foundation.css'))
    );
    expect(foundation).toContain('--text-2xs');
    expect(foundation).toContain('--radius-commit');

    const semantic = collectThemeVars(
      read(resolve(repo, 'packages/blocks/src/lib/style/semantic.css'))
    );
    expect(semantic).toContain('--color-text-primary');
  });
});

// ─── class-token stripping ───────────────────────────────────────────────────

describe('utilityOf', () => {
  it.each([
    ['text-sm', 'text-sm'],
    ['hover:text-sm', 'text-sm'],
    ['sm:group-hover:rounded-lg', 'rounded-lg'],
    ['data-[state=open]:text-2xs', 'text-2xs'],
    ['[&>svg]:shadow-sm', 'shadow-sm'],
    ['!text-sm', 'text-sm'],
    ['text-sm!', 'text-sm'],
    ['-tracking-tight', 'tracking-tight'],
    ['[font:inherit]', '[font:inherit]'] // colon inside brackets is no variant separator
  ])('%s → %s', (raw, expected) => {
    expect(utilityOf(raw)).toBe(expected);
  });
});

// ─── existence check ─────────────────────────────────────────────────────────

describe('checkClassToken', () => {
  // Minimal stand-in for the merged tailwind + repo truth.
  const vars = new Set([
    '--text-xs',
    '--text-sm',
    '--text-2xs',
    '--radius-sm',
    '--radius-commit',
    '--shadow-sm',
    '--blur-sm',
    '--tracking-wide',
    '--leading-tight',
    '--ease-out',
    '--color-primary',
    '--color-text-primary',
    '--color-black'
  ]);

  it.each([
    // theme-backed keys
    'text-2xs',
    'text-sm',
    'rounded-sm',
    'rounded-commit',
    'rounded-t-commit', // corner infix
    'rounded-ss-sm', // logical corner infix
    'shadow-sm',
    'blur-sm',
    'tracking-wide',
    'leading-tight',
    'ease-out',
    // statics / bare compat forms (all compiler-verified)
    'text-center',
    'text-ellipsis',
    'rounded',
    'rounded-t',
    'rounded-none',
    'rounded-full',
    'shadow',
    'shadow-none',
    'blur',
    'blur-none',
    'leading-none',
    'leading-4', // spacing-scale number
    'ease-linear',
    'ease-initial',
    // colour-capable namespaces resolve via --color-*
    'text-primary',
    'text-text-primary',
    'text-inherit',
    'text-current',
    'shadow-black/5',
    // modifiers and prefixes
    'text-primary/70',
    'text-sm/6',
    'hover:text-sm',
    '!text-sm',
    '-tracking-wide',
    // out of scope: arbitrary values, custom-property shorthand, arbitrary
    // properties, unguarded namespaces
    'text-[13px]',
    'ease-(--blocks-ease-confident)',
    'shadow-[var(--blocks-shadow-sm)]',
    '[font:inherit]',
    'font-meta',
    'animate-progress-striped',
    'bg-anything',
    'p-4'
  ])('passes %s', (cls) => {
    expect(checkClassToken(cls, vars)).toBeNull();
  });

  it.each([
    ['text-mini', ['--text-mini', '--color-mini']],
    ['text-3xs', ['--text-3xs', '--color-3xs']], // not in the stand-in set
    ['rounded-huge', ['--radius-huge']],
    ['rounded-t-huge', ['--radius-huge']],
    ['shadow-hover', ['--shadow-hover', '--color-hover']],
    ['blur-hard', ['--blur-hard']],
    ['tracking-tightest', ['--tracking-tightest']],
    ['leading-cozy', ['--leading-cozy']],
    ['ease-bouncy', ['--ease-bouncy']],
    ['hover:text-mini', ['--text-mini', '--color-mini']] // prefix stripped, still checked
  ])('flags %s (looked for %j)', (cls, lookedFor) => {
    expect(checkClassToken(cls, vars)?.lookedFor).toEqual(lookedFor);
  });

  it('reports the stripped utility alongside the raw class', () => {
    const finding = checkClassToken('sm:hover:text-mini', vars);
    expect(finding?.utility).toBe('text-mini');
  });

  it('is the guard the Calendar bug needed: text-2xs without the token is flagged', () => {
    const withoutSubXs = new Set([...vars].filter((v) => v !== '--text-2xs'));
    expect(checkClassToken('text-2xs', withoutSubXs)?.lookedFor).toEqual([
      '--text-2xs',
      '--color-2xs'
    ]);
  });
});
