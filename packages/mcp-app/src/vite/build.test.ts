import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';
import { buildViews, inlineIntoHtml, type ViewBuildOptions, viewConfig } from './build.ts';

const FIXTURE = new URL('./__fixtures__/', import.meta.url).pathname;
const PLACEHOLDER = '__CARD_BASE__';
const BUILD_TIMEOUT = 60_000;

const outDirs: string[] = [];
afterAll(() => {
  for (const dir of outDirs) rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix = 'mcp-app-vite-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  outDirs.push(dir);
  return dir;
}

function options(overrides: Partial<ViewBuildOptions> = {}): ViewBuildOptions {
  const outDir = tempDir();
  return {
    root: FIXTURE,
    outDir,
    views: ['card'],
    plugins: [tailwindcss()],
    base: { placeholder: PLACEHOLDER, meta: 'card:base', fonts: '/fonts/' },
    tailwind: { css: `${FIXTURE}app.css`, exclude: [`${FIXTURE}lib`], witness: 'bg-surface' },
    ...overrides
  };
}

const styleOf = (html: string): string => html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';

/** Records whether a chunk carries Vite's preload placeholder in a `generateBundle` without an order. */
function preloadProbe(seen: { marker: boolean }): Plugin {
  return {
    name: 'test:preload-probe',
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk' && chunk.code.includes('__VITE_PRELOAD__')) seen.marker = true;
      }
    }
  };
}

describe('buildViews', () => {
  it(
    'writes one HTML per view with script and CSS inside, and the fonts as files under the placeholder',
    async () => {
      const seen = { marker: false };
      const o = options({ plugins: [tailwindcss(), preloadProbe(seen)] });
      const built = await buildViews(o);
      const html = readFileSync(join(o.outDir, 'card.html'), 'utf8');
      const css = styleOf(html);

      expect(built.views.map((v) => v.name)).toEqual(['card']);
      expect(readdirSync(o.outDir).sort()).toEqual(['card.html', 'fonts']);
      expect(html).toMatch(/<script type="module">/);
      expect(html).not.toMatch(/(?:src|href)="\.\//);
      expect(html).toContain('loaded-lazily');
      expect(html).toContain(`<meta name="card:base" content="${PLACEHOLDER}">`);

      // The dynamic import ran through the preload helper, and the placeholder
      // stood in the chunk in a plain generateBundle — gone after inlining.
      expect(seen.marker).toBe(true);
      expect(html).not.toMatch(/__VITE_[A-Z0-9_]+__/);

      // The tiny one too, which Vite would otherwise inline as data:.
      expect(built.fonts.files.some((name) => name.startsWith('tiny-'))).toBe(true);
      expect(built.fonts.files.some((name) => name.startsWith('jetbrains-mono-'))).toBe(true);
      for (const font of built.fonts.files) {
        expect(html).toContain(`url(${PLACEHOLDER}/fonts/${font})`);
      }
      expect(html).not.toContain('data:font');

      expect(css).toContain('light-dark(');
      expect(css).toMatch(/\.bg-surface\b/);
      // The library's class: its directory is excluded, the view never uses it.
      expect(css).not.toContain('text-pink-700');
    },
    BUILD_TIMEOUT
  );

  it(
    'positive control: without the exclusion the library brings its own classes back',
    async () => {
      const o = options();
      const built = await buildViews({
        ...o,
        tailwind: { css: `${FIXTURE}app.css`, witness: 'bg-surface' }
      });
      expect(styleOf(readFileSync(built.views[0]!.file, 'utf8'))).toContain('text-pink-700');
    },
    BUILD_TIMEOUT
  );

  it(
    'positive control: below CSS_TARGET, light-dark() is rewritten into variables',
    async () => {
      const lowerTarget: Plugin = {
        name: 'test:lower-css-target',
        config(config) {
          if (config.build) config.build.cssTarget = ['chrome111', 'firefox114', 'safari16.4'];
        }
      };
      const built = await buildViews(options({ plugins: [tailwindcss(), lowerTarget] }));
      const css = styleOf(readFileSync(built.views[0]!.file, 'utf8'));
      expect(css).not.toContain('light-dark(');
      expect(css).toContain('--lightningcss-light');
    },
    BUILD_TIMEOUT
  );

  it(
    'stops when the CSS has no rule for the witness class',
    async () => {
      const o = options();
      await expect(
        buildViews({ ...o, tailwind: { ...o.tailwind!, witness: 'bg-not-used-anywhere' } })
      ).rejects.toThrow(/no rule for \.bg-not-used-anywhere/);
    },
    BUILD_TIMEOUT
  );

  it(
    'removes in outDir only what it writes: fonts in its own name, nothing in scan/, no public/',
    async () => {
      const o = options();
      const scansBefore = readdirSync(tmpdir()).filter((name) => name.startsWith('mcp-app-scan-'));
      mkdirSync(join(o.outDir, 'fonts'));
      mkdirSync(join(o.outDir, 'scan'));
      // The first in the form the build names a font: an earlier build's.
      for (const name of ['old-AbCd_1-2.woff2', 'brand.woff2', 'LICENSE.txt']) {
        writeFileSync(join(o.outDir, 'fonts', name), 'not a font');
      }
      writeFileSync(join(o.outDir, 'scan', 'notes.js'), 'the app’s own');
      const built = await buildViews(o);
      const fonts = readdirSync(join(o.outDir, 'fonts')).sort();

      expect(fonts).not.toContain('old-AbCd_1-2.woff2');
      expect(fonts).toEqual([...built.fonts.files, 'LICENSE.txt', 'brand.woff2'].sort());
      expect(built.fonts.files.length).toBeGreaterThan(0);
      expect(readdirSync(join(o.outDir, 'scan'))).toEqual(['notes.js']);
      // `__fixtures__/public/stray.txt` stays where it is.
      expect(existsSync(join(o.outDir, 'stray.txt'))).toBe(false);
      expect(readdirSync(o.outDir).sort()).toEqual(['card.html', 'fonts', 'scan']);
      // The scan pass's own directory is gone again.
      expect(readdirSync(tmpdir()).filter((name) => name.startsWith('mcp-app-scan-'))).toEqual(
        scansBefore
      );
    },
    BUILD_TIMEOUT
  );

  it('stops before removing anything when fonts/ is a symbolic link, and keeps what it points at', async () => {
    const o = options();
    const target = tempDir('mcp-app-vite-target-');
    writeFileSync(join(target, 'kept-AbCd_1-2.woff2'), 'not a font');
    symlinkSync(target, join(o.outDir, 'fonts'));
    writeFileSync(join(o.outDir, 'card.html'), 'an earlier build');
    await expect(buildViews(o)).rejects.toThrow(/fonts is a symbolic link/);
    expect(readdirSync(target)).toEqual(['kept-AbCd_1-2.woff2']);
    expect(readFileSync(join(o.outDir, 'card.html'), 'utf8')).toBe('an earlier build');
  });

  it('stops when a view’s HTML in outDir is a symbolic link', async () => {
    const o = options();
    // Not to the fixture: a build that wrote through the link would overwrite it.
    const elsewhere = join(tempDir(), 'card.html');
    writeFileSync(elsewhere, 'not the build’s');
    symlinkSync(elsewhere, join(o.outDir, 'card.html'));
    await expect(buildViews(o)).rejects.toThrow(/card\.html is a symbolic link/);
    expect(readFileSync(elsewhere, 'utf8')).toBe('not the build’s');
  });

  it('stops when outDir is root, under its own name or another, and keeps the sources', async () => {
    const root = tempDir('mcp-app-vite-root-');
    writeFileSync(
      join(root, 'solo.html'),
      '<!doctype html><html><body><script type="module" src="./solo.ts"></script></body></html>'
    );
    writeFileSync(join(root, 'solo.ts'), "document.body.dataset.view = 'solo';");
    const alias = join(tempDir(), 'alias');
    symlinkSync(root, alias);
    for (const outDir of [root, alias]) {
      await expect(buildViews({ root, outDir, views: ['solo'] })).rejects.toThrow(/outDir is root/);
    }
    expect(readFileSync(join(root, 'solo.html'), 'utf8')).toContain('./solo.ts');
  });

  it(
    'stops when a view has a font and no base.fonts',
    async () => {
      await expect(buildViews(options({ base: { placeholder: PLACEHOLDER } }))).rejects.toThrow(
        /fonts need base\.fonts/
      );
    },
    BUILD_TIMEOUT
  );
});

describe('the options', () => {
  it('refuse a placeholder in the form of Vite’s own', () => {
    expect(() => viewConfig('card', options({ base: { placeholder: '__VITE_BASE__' } }))).toThrow(
      /must not look like Vite's own/
    );
  });

  it('refuse a view name that is not one lowercase segment, and a name listed twice', () => {
    expect(() => viewConfig('../card', options({ views: ['../card'] }))).toThrow(/URI segment/);
    expect(() => viewConfig('card', options({ views: ['card', 'card'] }))).toThrow(/twice/);
  });

  it('refuse a pass of a Tailwind build without scanDir', () => {
    expect(() => viewConfig('card', options())).toThrow(/both passes need scanDir/);
  });

  it('refuse a view without its HTML file', async () => {
    await expect(buildViews(options({ views: ['missing'] }))).rejects.toThrow(
      /The view missing does not exist/
    );
  });
});

/* --- inlineIntoHtml on a bundle built by hand ---------------------------------- */

type Bundle = Record<string, unknown>;

const page = (body = ''): string =>
  `<html><head><script type="module" crossorigin src="./assets/v.js"></script><link rel="stylesheet" crossorigin href="./assets/v.css"></head><body>${body}</body></html>`;

function bundleOf(entries: { js?: string; css?: string; html?: string; extra?: Bundle }): Bundle {
  return {
    'v.html': { type: 'asset', fileName: 'v.html', source: entries.html ?? page() },
    'assets/v.js': { type: 'chunk', fileName: 'assets/v.js', code: entries.js ?? 'run();' },
    'assets/v.css': {
      type: 'asset',
      fileName: 'assets/v.css',
      source: entries.css ?? '.bg-surface{color:red}'
    },
    ...entries.extra
  };
}

function run(plugin: Plugin, bundle: Bundle): Bundle {
  const hook = plugin.generateBundle as { handler: (o: unknown, b: Bundle) => void };
  hook.handler({}, bundle);
  return bundle;
}

describe('inlineIntoHtml', () => {
  const plugin = (o: Parameters<typeof inlineIntoHtml>[0] = {}) => inlineIntoHtml(o);

  it('runs after every generateBundle without an order', () => {
    expect((plugin().generateBundle as { order: string }).order).toBe('post');
  });

  it('moves script and CSS into the HTML and escapes a closing tag inside them', () => {
    const bundle = run(
      plugin({ witness: 'bg-surface' }),
      bundleOf({ js: 'x("</script>")', css: '.bg-surface{content:"</style>"}' })
    );
    expect(Object.keys(bundle)).toEqual(['v.html']);
    const html = String((bundle['v.html'] as { source: string }).source);
    expect(html).toContain('<script type="module">x("<\\/script>")</script>');
    expect(html).toContain('<style>.bg-surface{content:"<\\/style>"}</style>');
  });

  it('stops on a placeholder of Vite left in the script', () => {
    expect(() => run(plugin(), bundleOf({ js: '__vitePreload(f, __VITE_PRELOAD__)' }))).toThrow(
      /__VITE_PRELOAD__ is still in the script/
    );
  });

  it('stops when the HTML still points at a file', () => {
    expect(() => run(plugin(), bundleOf({ html: page('<img src="./assets/logo.png">') }))).toThrow(
      /still points at a file/
    );
  });

  it('stops on an asset it did not inline', () => {
    const extra = { 'assets/logo.png': { type: 'asset', fileName: 'assets/logo.png', source: '' } };
    expect(() => run(plugin(), bundleOf({ extra }))).toThrow(/Not inlined: assets\/logo\.png/);
  });

  it('stops on a font without fontUrl, and on one the CSS does not name', () => {
    const extra = { 'fonts/a-1.woff2': { type: 'asset', fileName: 'fonts/a-1.woff2', source: '' } };
    expect(() => run(plugin(), bundleOf({ extra }))).toThrow(/fonts need base\.fonts/);
    const fontUrl = (name: string) => `__B__/f/${name.slice('fonts/'.length)}`;
    expect(() => run(plugin({ fontUrl }), bundleOf({ extra }))).toThrow(
      /is not named __B__\/f\/a-1\.woff2/
    );
    expect(() =>
      run(plugin({ fontUrl }), bundleOf({ extra, css: '@font-face{src:url(__B__/f/a-1.woff2)}' }))
    ).not.toThrow();
  });

  it('stops when the witness has no rule, or the view no CSS at all', () => {
    expect(() =>
      run(plugin({ witness: 'bg-surface' }), bundleOf({ css: '.bg-surface-raised{}' }))
    ).toThrow(/no rule for \.bg-surface/);
    const bare = {
      'v.html': { type: 'asset', fileName: 'v.html', source: '<html><body></body></html>' }
    };
    expect(() => run(plugin({ witness: 'bg-surface' }), bare)).toThrow(/no CSS at all/);
  });

  it('finds a witness with characters Tailwind escapes', () => {
    expect(() =>
      run(plugin({ witness: 'bg-surface/50' }), bundleOf({ css: '.bg-surface\\/50{}' }))
    ).not.toThrow();
  });
});
