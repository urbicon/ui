import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCssReference } from './css-reference.js';
import { runIcons } from './icons.js';
import { runPattern } from './pattern.js';
import { runPrinciples } from './principles.js';
import { runRecipe } from './recipe.js';

process.env.URBICON_CONTENT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '__fixtures__',
  'content'
);

let out: string[];
let err: string[];

beforeEach(() => {
  out = [];
  err = [];
  vi.spyOn(console, 'log').mockImplementation((m?: unknown) => {
    out.push(String(m));
  });
  vi.spyOn(console, 'error').mockImplementation((m?: unknown) => {
    err.push(String(m));
  });
});
afterEach(() => vi.restoreAllMocks());

const stdout = (): string => out.join('\n');
const stderr = (): string => err.join('\n');

describe('runPattern', () => {
  it('lists all patterns without a name, sorted', async () => {
    const code = await runPattern([], {});
    expect(code).toBe(0);
    expect(stdout()).toContain('2 composition pattern(s)');
    expect(stdout().indexOf('dashboard')).toBeLessThan(stdout().indexOf('settings-page'));
  });

  it('prints one pattern by name', async () => {
    const code = await runPattern(['settings-page'], {});
    expect(code).toBe(0);
    expect(stdout()).toContain('# Settings Page');
    expect(stdout()).toContain('sticky save bar');
    expect(stdout()).not.toContain('KPI tiles');
  });

  it('fails clearly for an unknown pattern, listing the available ones', async () => {
    const code = await runPattern(['bogus'], {});
    expect(code).toBe(1);
    expect(stderr()).toContain('not found');
    expect(stderr()).toContain('settings-page');
  });

  it('emits a machine-readable list with --json', async () => {
    const code = await runPattern([], { json: true });
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout()) as { name: string; title: string }[];
    expect(parsed.map((p) => p.name)).toEqual(['dashboard', 'settings-page']);
  });
});

describe('runPrinciples', () => {
  it('prints the full principles by default', async () => {
    const code = await runPrinciples([], {});
    expect(code).toBe(0);
    expect(stdout()).toContain('## Visual Hierarchy');
    expect(stdout()).toContain('## Theming');
  });

  it('slices one topic with --topic', async () => {
    const code = await runPrinciples([], { topic: 'theming' });
    expect(code).toBe(0);
    expect(stdout()).toContain('## Theming');
    expect(stdout()).not.toContain('## Visual Hierarchy');
  });

  it('rejects an unknown topic as a usage error', async () => {
    const code = await runPrinciples([], { topic: 'bogus' });
    expect(code).toBe(2);
    expect(stderr()).toContain('unknown topic "bogus"');
    expect(stderr()).toContain('visual-hierarchy');
  });

  it('slices one topic positionally, like an agent would type it', async () => {
    const code = await runPrinciples(['theming'], {});
    expect(code).toBe(0);
    expect(stdout()).toContain('## Theming');
    expect(stdout()).not.toContain('## Visual Hierarchy');
  });

  it('rejects an unknown positional topic instead of printing the whole bundle', async () => {
    // The measured failure: `urbicon principles separation` printed all 19 kB and
    // exited 0, so a made-up topic was indistinguishable from a real answer.
    const code = await runPrinciples(['separation'], {});
    expect(code).toBe(2);
    expect(stderr()).toContain('unknown topic "separation"');
    expect(stdout()).not.toContain('## Visual Hierarchy');
  });

  it('rejects the topic given twice', async () => {
    const code = await runPrinciples(['layout'], { topic: 'theming' });
    expect(code).toBe(2);
    expect(stderr()).toContain('give the topic once');
  });

  it('prints the scoring rubric with --rubric (bundle not needed)', async () => {
    const code = await runPrinciples([], { rubric: true });
    expect(code).toBe(0);
    expect(stdout()).toContain('Technical Correctness');
    expect(stdout()).toContain('urbicon validate');
  });
});

describe('runCssReference', () => {
  it('prints the overview without a section', async () => {
    const code = await runCssReference([], {});
    expect(code).toBe(0);
    expect(stdout()).toContain('CSS Design Tokens');
    expect(stdout()).toContain('light-dark()');
  });

  it('prints a named section', async () => {
    const code = await runCssReference(['surfaces'], {});
    expect(code).toBe(0);
    expect(stdout()).toContain('# Surface Tokens');
    expect(stdout()).not.toContain('# Text Tokens');
  });

  it('rejects an unknown section as a usage error', async () => {
    const code = await runCssReference(['bogus'], {});
    expect(code).toBe(2);
    expect(stderr()).toContain('unknown section');
  });
});

describe('runIcons', () => {
  it('prints the grouped full reference without a query', async () => {
    const code = await runIcons([], {});
    expect(code).toBe(0);
    expect(stdout()).toContain('2 icon(s)');
    expect(stdout()).toContain('action (1)');
    expect(stdout()).toContain('SearchIcon');
  });

  it('ranks matches for a query', async () => {
    const code = await runIcons(['date'], {});
    expect(code).toBe(0);
    expect(stdout()).toContain('1 icon(s) matching "date"');
    expect(stdout()).toContain('CalendarIcon');
    // The static usage note mentions SearchIcon as an example, so assert on the
    // result-row form (backtick-quoted icon name) instead of the component name.
    expect(stdout()).not.toContain('`search`');
  });

  it('exits 0 with a hint when nothing matches', async () => {
    const code = await runIcons(['zzzz'], {});
    expect(code).toBe(0);
    expect(stdout()).toContain('No icons match');
  });

  it('emits machine-readable entries with --json', async () => {
    const code = await runIcons(['search'], { json: true });
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout()) as { name: string }[];
    expect(parsed[0]?.name).toBe('search');
  });

  it('honours --limit without a query — it used to print all 315', async () => {
    const code = await runIcons([], { limit: '1' });
    expect(code).toBe(0);
    expect(stdout()).toContain('1 icon(s) (--limit 1; 1 more)');
  });

  it('prints the whole reference when no --limit is passed', async () => {
    await runIcons([], {});
    expect(stdout()).toContain('2 icon(s):');
  });
});

describe('runRecipe', () => {
  it('lists all recipes without an id', async () => {
    const code = await runRecipe([], {});
    expect(code).toBe(0);
    expect(stdout()).toContain('1 recipe(s)');
    expect(stdout()).toContain('login');
    expect(stdout()).toContain('pattern: form-page');
  });

  it('prints one recipe with code and CLI cross-references', async () => {
    const code = await runRecipe(['login'], {});
    expect(code).toBe(0);
    expect(stdout()).toContain('# Recipe: Login Page');
    expect(stdout()).toContain('```svelte');
    expect(stdout()).toContain('urbicon pattern form-page');
    expect(stdout()).toContain('urbicon get-component button');
  });

  it('fails clearly for an unknown recipe', async () => {
    const code = await runRecipe(['bogus'], {});
    expect(code).toBe(1);
    expect(stderr()).toContain('not found');
    expect(stderr()).toContain('login');
  });
});
