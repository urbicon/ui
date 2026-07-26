import { describe, expect, it } from 'vitest';
import { findUnusedKeys } from '../unused';
import { scanSource, scanSources } from './scanner';

// The scanner's lazily-loaded parsers are warmed per worker in
// ../../../../vitest-setup.ts — see the note there for why.

describe('scanSource — TypeScript', () => {
  it('captures static keys across aliases, members, and destructuring', async () => {
    const code = `
      import { useTableI18n } from '@urbicon-ui/table';
      const tt = useTableI18n();          // arbitrary local alias
      const a = tt('status.active');
      const i18n = useI18n();
      i18n.t('global.key');               // member call, by method name
      const { t, exists } = useI18n();
      t('destructured.key');
      if (exists('maybe.key')) {}         // probe, not a render
    `;
    const scan = await scanSource(code, 'sample.ts');
    expect([...scan.staticKeys.keys()].sort()).toEqual([
      'destructured.key',
      'global.key',
      'status.active'
    ]);
    expect(scan.probeKeys.has('maybe.key')).toBe(true);
    expect(scan.staticKeys.has('maybe.key')).toBe(false);
  });

  it('handles ternary branches, template prefixes, and opaque calls', async () => {
    const code = `
      const tt = useTableI18n();
      const label = cond ? tt('copy.copied') : tt('copy.failed');
      const dyn = tt(\`filter.operators.\${op}\`);
      const opaque = tt(keyVariable);
    `;
    const scan = await scanSource(code, 'sample.ts');
    expect(scan.staticKeys.has('copy.copied')).toBe(true);
    expect(scan.staticKeys.has('copy.failed')).toBe(true);
    expect(scan.dynamicPrefixes.map((p) => p.prefix)).toContain('filter.operators.');
    expect(scan.opaqueSites.length).toBeGreaterThanOrEqual(1);
  });

  it('harvests every string literal for the loose-usage layer', async () => {
    const code = `const nav = [{ name: 'Overview', nameKey: 'nav.overview' }];`;
    const scan = await scanSource(code, 'nav.ts');
    // No t() call, but the literal is still pooled (data-driven keys).
    expect(scan.literalPool.has('nav.overview')).toBe(true);
    expect(scan.staticKeys.size).toBe(0);
  });
});

describe('scanSource — Svelte', () => {
  it('captures script aliases used in markup, <T key>, and template prefixes', async () => {
    const code = `<script lang="ts">
      import { useBlocksI18n } from '@urbicon-ui/blocks';
      const bt = useBlocksI18n();
      let op = 'eq';
    </script>
    <button aria-label={bt('a11y.close')}>{bt('button.save')}</button>
    <span>{bt(\`status.\${op}\`)}</span>
    <T key="dialog.close" />
    {#if cond}{bt('cond.shown')}{/if}`;
    const scan = await scanSource(code, 'Widget.svelte');
    expect([...scan.staticKeys.keys()].sort()).toEqual([
      'a11y.close',
      'button.save',
      'cond.shown',
      'dialog.close'
    ]);
    expect(scan.dynamicPrefixes.map((p) => p.prefix)).toContain('status.');
  });

  it('records accurate 1-based line numbers from the original source', async () => {
    const code = `<script>\n  const bt = useBlocksI18n();\n</script>\n<p>{bt('on.line.four')}</p>`;
    const scan = await scanSource(code, 'Lines.svelte');
    expect(scan.staticKeys.get('on.line.four')?.[0]?.line).toBe(4);
  });
});

describe('scanSources', () => {
  it('merges many files and surfaces (does not swallow) parse failures', async () => {
    const { scan, errors } = await scanSources([
      { file: 'a.ts', code: `t('a.key')` },
      { file: 'b.ts', code: `t('b.key')` },
      { file: 'broken.svelte', code: `{#each}` } // svelte parse error
    ]);
    expect(scan.staticKeys.has('a.key')).toBe(true);
    expect(scan.staticKeys.has('b.key')).toBe(true);
    expect(errors.map((e) => e.file)).toContain('broken.svelte');
  });
});

describe('scanSource — false-positive hardening (review regressions)', () => {
  it('treats an empty concat part as opaque, never a catch-all prefix', async () => {
    const scan = await scanSource(`const { t } = useI18n(); t('' + suffix);`, 'x.ts');
    expect(scan.dynamicPrefixes.map((p) => p.prefix)).not.toContain('');
    expect(scan.opaqueSites.length).toBeGreaterThanOrEqual(1);
  });

  it('extracts a prefix from a literal-left concatenation', async () => {
    const scan = await scanSource(`const { t } = useI18n(); t('menu.' + item);`, 'x.ts');
    expect(scan.dynamicPrefixes.map((p) => p.prefix)).toContain('menu.');
  });

  it('harvests quoted markup text / attribute values so they are not flagged unused', async () => {
    const scan = await scanSource(
      `<Foo labelKey="user.name" /><code>build.target</code>`,
      'P.svelte'
    );
    expect(scan.literalPool.has('user.name')).toBe(true);
    expect(scan.literalPool.has('build.target')).toBe(true);
    expect(findUnusedKeys(['user.name', 'build.target'], scan).unused).toEqual([]);
  });

  it('shields config-built template keys via the static template head', async () => {
    const scan = await scanSource('const cols = ids.map((id) => `col.${id}.label`);', 'cfg.ts');
    expect(scan.dynamicPrefixes.map((p) => p.prefix)).toContain('col.');
    expect(findUnusedKeys(['col.name.label'], scan).unused).toEqual([]);
  });
});
