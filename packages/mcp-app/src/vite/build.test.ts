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
import { dirname, join, relative } from 'node:path';
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

const LIST = '.mcp-app-build.json';
const listIn = (outDir: string): { views: Record<string, string[]>; directories: string[] } =>
  JSON.parse(readFileSync(join(outDir, LIST), 'utf8'));

/** A root of its own with the view `solo`: `solo.html`, `solo.ts`, `solo.css` holding `css`, and `files`. */
function soloRoot(
  css: string,
  files: Record<string, string> = {},
  root = tempDir('mcp-app-vite-root-')
): string {
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, 'solo.html'),
    '<!doctype html><html><head></head><body><script type="module" src="./solo.ts"></script></body></html>'
  );
  writeFileSync(
    join(root, 'solo.ts'),
    "import './solo.css';\ndocument.body.dataset.view = 'solo';"
  );
  writeFileSync(join(root, 'solo.css'), css);
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), text);
  }
  return root;
}

const fontFace = (url: string): string =>
  `@font-face{font-family:F;src:url('${url}') format('woff2')}\nbody{font-family:F}`;
const SOLO_BASE = { placeholder: PLACEHOLDER, fonts: '/fonts/' };

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
      expect(readdirSync(o.outDir).sort()).toEqual([LIST, 'card.html', 'fonts']);
      expect(listIn(o.outDir)).toEqual({
        builtBy: '@urbicon-ui/mcp-app/vite',
        views: { card: expect.arrayContaining(['card.html']) },
        directories: ['fonts']
      });
      expect(listIn(o.outDir).views.card?.sort()).toEqual(
        ['card.html', ...built.fonts.files.map((font) => `fonts/${font}`)].sort()
      );
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
      for (const font of built.fonts.files) expect(font).toMatch(/-[0-9a-f]{8}\.woff2?$/);
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
    'keeps every file it did not write — fonts of any name, scan/ — copies no public/, and its scan directory goes',
    async () => {
      const o = options();
      // TMPDIR of its own: `os.tmpdir()` reads it on each call, and a parallel run shares no other.
      const tmp = tempDir('mcp-app-vite-tmp-');
      mkdirSync(join(o.outDir, 'fonts'));
      mkdirSync(join(o.outDir, 'scan'));
      const foreign = [
        'Montserrat-SemiBold.ttf',
        'Inter-Variable.woff2',
        'brand-12345678.woff2',
        'old-AbCd_1-2.woff2',
        'LICENSE.txt'
      ];
      for (const name of foreign) writeFileSync(join(o.outDir, 'fonts', name), 'the app’s own');
      writeFileSync(join(o.outDir, 'scan', 'notes.js'), 'the app’s own');
      const during: string[] = [];
      const peek: Plugin = {
        name: 'test:peek-tmpdir',
        buildStart() {
          during.push(...readdirSync(tmp));
        }
      };
      const before = process.env.TMPDIR;
      process.env.TMPDIR = tmp;
      let built: Awaited<ReturnType<typeof buildViews>>;
      try {
        built = await buildViews({ ...o, plugins: [tailwindcss(), peek] });
      } finally {
        if (before === undefined) delete process.env.TMPDIR;
        else process.env.TMPDIR = before;
      }

      expect(built.fonts.files.length).toBeGreaterThan(0);
      expect(readdirSync(join(o.outDir, 'fonts')).sort()).toEqual(
        [...built.fonts.files, ...foreign].sort()
      );
      expect(readdirSync(join(o.outDir, 'scan'))).toEqual(['notes.js']);
      // `__fixtures__/public/stray.txt` stays where it is.
      expect(existsSync(join(o.outDir, 'stray.txt'))).toBe(false);
      expect(readdirSync(o.outDir).sort()).toEqual([LIST, 'card.html', 'fonts', 'scan']);
      // fonts/ was there before: not the build's, so not on its list.
      expect(listIn(o.outDir).directories).toEqual([]);
      // The scan pass's directory stood in TMPDIR while the build ran, and is gone.
      expect(during.some((name) => name.startsWith('mcp-app-scan-'))).toBe(true);
      expect(readdirSync(tmp)).toEqual([]);
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
    'removes a font of its own that the build no longer writes, and fonts/ once it made it and it is empty',
    async () => {
      const root = soloRoot(fontFace('./a.woff2'), { 'a.woff2': 'first' });
      const outDir = tempDir();
      const build = () => buildViews({ root, outDir, views: ['solo'], base: SOLO_BASE });
      const first = await build();
      expect(first.fonts.files).toEqual([expect.stringMatching(/^a-[0-9a-f]{8}\.woff2$/)]);
      expect(listIn(outDir).directories).toEqual(['fonts']);

      writeFileSync(join(root, 'a.woff2'), 'second');
      const second = await build();
      expect(second.fonts.files).toHaveLength(1);
      expect(second.fonts.files).not.toEqual(first.fonts.files);
      expect(readdirSync(join(outDir, 'fonts'))).toEqual(second.fonts.files);
      expect(listIn(outDir).views.solo?.sort()).toEqual([
        `fonts/${second.fonts.files[0]}`,
        'solo.html'
      ]);

      writeFileSync(join(root, 'solo.css'), 'body{color:red}');
      const third = await build();
      expect(third.fonts.files).toEqual([]);
      expect(readdirSync(outDir).sort()).toEqual([LIST, 'solo.html']);
      expect(listIn(outDir)).toMatchObject({ views: { solo: ['solo.html'] }, directories: [] });
    },
    BUILD_TIMEOUT
  );

  it(
    'leaves a fonts/ it did not make, empty or not, and the files in it',
    async () => {
      const root = soloRoot(fontFace('./a.woff2'), { 'a.woff2': 'a font' });
      const outDir = tempDir();
      mkdirSync(join(outDir, 'fonts'));
      await buildViews({ root, outDir, views: ['solo'], base: SOLO_BASE });
      writeFileSync(join(root, 'solo.css'), 'body{color:red}');
      await buildViews({ root, outDir, views: ['solo'], base: SOLO_BASE });
      expect(readdirSync(join(outDir, 'fonts'))).toEqual([]);
    },
    BUILD_TIMEOUT
  );

  it('without a list it removes nothing, and writes over no view it did not write', async () => {
    const root = soloRoot('body{color:red}');
    const outDir = tempDir();
    writeFileSync(join(outDir, 'solo.html'), 'the app’s own page');
    await expect(buildViews({ root, outDir, views: ['solo'] })).rejects.toThrow(
      /solo\.html is not on \.mcp-app-build\.json/
    );
    expect(readFileSync(join(outDir, 'solo.html'), 'utf8')).toBe('the app’s own page');
    expect(readdirSync(outDir)).toEqual(['solo.html']);
  });

  it(
    'a failed build removes nothing, and what it wrote stays on the list for the next one',
    async () => {
      const root = soloRoot(fontFace('./a.woff2'), {
        'a.woff2': 'first',
        'broken.html':
          '<!doctype html><html><head></head><body><script type="module" src="./broken.ts"></script></body></html>',
        'broken.ts': "import './broken.css';",
        'broken.css': fontFace('./missing.woff2')
      });
      const outDir = tempDir();
      const build = (views: string[]) => buildViews({ root, outDir, views, base: SOLO_BASE });
      const [first] = (await build(['solo'])).fonts.files;

      writeFileSync(join(root, 'a.woff2'), 'second');
      await expect(build(['solo', 'broken'])).rejects.toThrow(
        /the CSS still points at a file, url\(\.\/missing\.woff2\)/
      );
      const both = readdirSync(join(outDir, 'fonts')).sort();
      expect(both).toHaveLength(2);
      expect(both).toContain(first);
      expect(listIn(outDir).views.solo?.sort()).toEqual(
        ['solo.html', ...both.map((font) => `fonts/${font}`)].sort()
      );

      const third = await build(['solo']);
      expect(readdirSync(join(outDir, 'fonts'))).toEqual(third.fonts.files);
      expect(third.fonts.files).not.toContain(first);
    },
    BUILD_TIMEOUT
  );

  it(
    'keeps a source font that lies in outDir/fonts/, and names its copy under the placeholder',
    async () => {
      const dir = tempDir('mcp-app-vite-site-');
      const outDir = join(dir, 'static');
      mkdirSync(join(outDir, 'fonts'), { recursive: true });
      const source = join(outDir, 'fonts', 'Brand-SemiBold.woff2');
      writeFileSync(source, 'the site’s font, and the view’s');
      const root = soloRoot(
        fontFace('../static/fonts/Brand-SemiBold.woff2'),
        {},
        join(dir, 'views')
      );
      for (const pass of [1, 2]) {
        const built = await buildViews({ root, outDir, views: ['solo'], base: SOLO_BASE });
        expect(readFileSync(source, 'utf8'), `build ${pass}`).toBe(
          'the site’s font, and the view’s'
        );
        const [copy] = built.fonts.files;
        expect(copy).toMatch(/^Brand-SemiBold-[0-9a-f]{8}\.woff2$/);
        expect(readFileSync(join(outDir, 'solo.html'), 'utf8')).toContain(
          `url(${PLACEHOLDER}/fonts/${copy})`
        );
        expect(readdirSync(join(outDir, 'fonts')).sort()).toEqual(
          ['Brand-SemiBold.woff2', copy].sort()
        );
      }
    },
    BUILD_TIMEOUT
  );

  it(
    'stops before removing anything when what it would remove is now one of its sources',
    async () => {
      const root = soloRoot(fontFace('./a.woff2'), { 'a.woff2': 'a font' });
      const outDir = tempDir();
      const build = () => buildViews({ root, outDir, views: ['solo'], base: SOLO_BASE });
      const [written] = (await build()).fonts.files;
      const font = join(outDir, 'fonts', written!);
      // The CSS now names the earlier build's font itself.
      writeFileSync(join(root, 'solo.css'), fontFace(`./${relative(root, font)}`));
      await expect(build()).rejects.toThrow(/is a source of the build/);
      expect(readFileSync(font, 'utf8')).toBe('a font');
    },
    BUILD_TIMEOUT
  );

  it('refuses a list it did not write, and a symbolic link where the list is or that it names', async () => {
    const root = soloRoot('body{color:red}');
    const cases: [string, (outDir: string) => void, RegExp][] = [
      [
        'another tool’s',
        (d) => writeFileSync(join(d, LIST), '{"files":["solo.html"]}'),
        /is not the list buildViews writes/
      ],
      ['no JSON', (d) => writeFileSync(join(d, LIST), 'solo.html'), /is no JSON/],
      [
        'a path out of outDir',
        (d) =>
          writeFileSync(
            join(d, LIST),
            JSON.stringify({
              builtBy: '@urbicon-ui/mcp-app/vite',
              views: { solo: ['../kept.txt'] },
              directories: []
            })
          ),
        /is not the list buildViews writes/
      ],
      [
        'a link',
        (d) => symlinkSync(join(dirname(d), 'kept.txt'), join(d, LIST)),
        /is a symbolic link/
      ],
      [
        'a link it names',
        (d) => {
          mkdirSync(join(d, 'fonts'));
          symlinkSync(join(dirname(d), 'kept.txt'), join(d, 'fonts', 'old-0123abcd.woff2'));
          writeFileSync(
            join(d, LIST),
            JSON.stringify({
              builtBy: '@urbicon-ui/mcp-app/vite',
              views: { solo: ['solo.html', 'fonts/old-0123abcd.woff2'] },
              directories: ['fonts']
            })
          );
        },
        /old-0123abcd\.woff2 is a symbolic link/
      ]
    ];
    for (const [what, arrange, refusal] of cases) {
      const outDir = join(tempDir(), 'out');
      mkdirSync(outDir);
      writeFileSync(join(dirname(outDir), 'kept.txt'), 'kept');
      arrange(outDir);
      const before = readdirSync(outDir, { recursive: true }).sort();
      await expect(buildViews({ root, outDir, views: ['solo'] }), what).rejects.toThrow(refusal);
      expect(readdirSync(outDir, { recursive: true }).sort(), what).toEqual(before);
      expect(readFileSync(join(dirname(outDir), 'kept.txt'), 'utf8'), what).toBe('kept');
    }
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

  it('counts what it inlined itself: a bundle may keep a deleted key in view (Rolldown up to 1.2.8)', () => {
    const keeps = new Proxy(bundleOf({}), { deleteProperty: () => true });
    run(plugin({ witness: 'bg-surface' }), keeps);
    // The proxy did keep them — the case the count is for.
    expect(Object.keys(keeps)).toEqual(['v.html', 'assets/v.js', 'assets/v.css']);
    const html = String((keeps['v.html'] as { source: string }).source);
    expect(html).toContain('<script type="module">run();</script>');
    expect(html).toContain('<style>.bg-surface{color:red}</style>');
  });

  it('stops on a url() of the CSS that names a file', () => {
    for (const url of [
      './missing.woff2',
      '../fonts/a.woff2',
      '/abs.png',
      'x.png',
      '"./q.png"',
      "'./q.png'"
    ]) {
      expect(
        () => run(plugin(), bundleOf({ css: `.bg-surface{background:URL( ${url} )}` })),
        url
      ).toThrow(/the CSS still points at a file/);
    }
    expect(() => run(plugin(), bundleOf({ css: 'a{background:url(__B__/img/z.png)}' }))).toThrow(
      /url\(__B__\/img\/z\.png\)/
    );
  });

  it('lets data:, absolute URLs, fragments, the placeholder and a url( inside a string pass', () => {
    const css = [
      'a{background:url(data:image/png;base64,AA)}',
      'b{background:url(https://cdn.test/x.png)}',
      'c{clip-path:url(#clip)}',
      'd{background:url("//cdn.test/y.png")}',
      'e{background:url(__B__/img/z.png)}',
      'f{content:"url(./not-a-reference)"}',
      '/*! url(./a-comment) */'
    ].join('');
    expect(() => run(plugin({ placeholder: '__B__' }), bundleOf({ css }))).not.toThrow();
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
