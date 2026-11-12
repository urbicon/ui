/**
 * Building a view: **one HTML file per view**, script and CSS inside it, the
 * fonts beside it.
 *
 * A host fetches the view with `resources/read` and writes it into a sandbox
 * on an origin of its own. Anything the view loaded from elsewhere would need
 * the CSP's permission and — for a module script, a `crossorigin` stylesheet
 * and every font — a CORS answer from the app. So the script and the CSS go
 * into the HTML, and the build fails when anything still points at a file: a
 * relative `src` or `href` in the HTML, any file but a font left beside it,
 * and a `url()` in the CSS unless it is `data:`, an absolute URL, a fragment,
 * a font as the build names it, or under `base.placeholder`.
 *
 * No plugin for the single file: `codeSplitting: false` makes one chunk of the
 * view, and `inlineIntoHtml` moves it and the CSS into the HTML. A dynamic
 * import is embedded into that chunk, but it still runs through Vite's preload
 * helper, whose placeholder `__VITE_PRELOAD__` Vite replaces in **its own**
 * `generateBundle` — so `inlineIntoHtml` runs after it (`order: 'post'`) and
 * stops the build when a placeholder is left; embedded before, the view throws
 * a `ReferenceError` the first time the import runs (`build.test.ts` pins that
 * the placeholder is still there in a plain `generateBundle`).
 *
 * **The fonts stay files.** The spec's CSP has `font-src 'self'
 * <resourceDomains>`, no `data:`: a host that follows the spec blocks an
 * embedded font. They land in `<outDir>/fonts/`, the app serves them with
 * `Access-Control-Allow-Origin`, and the CSS names them under
 * `base.placeholder` — the placeholder `createViewCatalog` replaces with the
 * app's origin at `resources/read`, the origin it also adds to
 * `resourceDomains`.
 *
 * **`light-dark()` stays as written** ({@link CSS_TARGET}). Below that target
 * Lightning CSS rewrites it into variables that only a `color-scheme`
 * declared in CSS switches; the view's theme is set by script on the root
 * (`applyTheme`), and the view's colours stop following the theme
 * (`build.test.ts` pins the rewrite, the fixture's `low-css-target` control
 * the consequence in the test host).
 *
 * **Tailwind reads the view's script, not the libraries** (`tailwind`). A
 * component library's CSS brings `@source` for its whole package. The build
 * therefore runs twice: the first pass writes each view's script, unminified
 * and without the code's comments (Rolldown's module-path lines stay), into a
 * fresh temporary directory; the second excludes
 * the libraries (`@source not`) and lets Tailwind read exactly that script —
 * what Rolldown put into the view after tree-shaking, every class of every
 * component it uses, and no list beside it. Each view reads only its own
 * script: read across all of them, a view would carry every other view's
 * classes.
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  rmSync,
  type Stats,
  statSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build, type InlineConfig, type Plugin, type PluginOption } from 'vite';

/**
 * The CSS target of every view — the first versions with `light-dark()`, so
 * Lightning CSS leaves it alone.
 */
export const CSS_TARGET = ['chrome123', 'firefox120', 'safari17.5'] as const;

export interface ViewBuildOptions {
  /** The directory holding one `<view>.html` per view — Vite's `root`. */
  root: string;
  /**
   * Where `<view>.html` and `fonts/` land, and `.mcp-app-build.json`, the
   * list of what the build wrote there. After a successful build it removes
   * what the previous list names and this build did not write again —
   * nothing else, nothing without a list, nothing after a failed build;
   * `fonts/` only when the build made it and it is empty. It writes over no
   * file the list does not name. Such a file, a symbolic link where it would
   * write or remove, a file it would write over or remove that is one of its
   * sources, and an `outDir` that is `root` stop it before it does. Vite's
   * `public/` is not copied.
   */
  outDir: string;
  /** The views to build, one HTML file each — the names of the view catalog. */
  views: readonly string[];
  /** The app's Vite plugins — Tailwind, Svelte, an alias — in the order they need. */
  plugins?: PluginOption[];
  /** The app's origin in the view — the same `placeholder` as `createViewCatalog`'s `base`. */
  base?: {
    placeholder: string;
    /** `<meta name="<meta>" content="<placeholder>">` in every view, for `readBaseMeta`. */
    meta?: string;
    /**
     * The path under the app's origin that serves `<outDir>/fonts/`, e.g.
     * `'/mcp-app/fonts/'`: a font is named `placeholder + fonts + file`.
     * Without it a view with a font does not build.
     */
    fonts?: string;
  };
  /** The two-pass Tailwind build: Tailwind reads each view's own script. */
  tailwind?: {
    /** The CSS file the views import, with `@import 'tailwindcss' source(none)`. */
    css: string;
    /** Directories whose `@source` must not count — a component library's `dist/`. */
    exclude?: readonly string[];
    /**
     * A class every view uses. The build fails when the CSS has no rule for
     * it: Tailwind then did not read the script — a glob into the void is no
     * error to Tailwind — or the class lost its token.
     */
    witness: string;
  };
}

export interface BuiltView {
  name: string;
  file: string;
  bytes: number;
  gzipBytes: number;
}

export interface ViewBuild {
  views: BuiltView[];
  fonts: { files: string[]; bytes: number };
}

const NAME = /^[a-z0-9][a-z0-9_-]*$/;
/** The first pass's script extension — one place for its file name, Tailwind's source and the count. */
const SCAN_EXTENSION = '.js';
const FONT_DIR = 'fonts';
/**
 * The prefix of a font's name in the bundle — never a path to remove: with
 * the trailing slash, `rmSync` follows a symbolic link and removes its target.
 */
const FONT_PREFIX = `${FONT_DIR}/`;
const FONT_FILE = /\.(?:woff2?|ttf|otf)$/;
/**
 * The list of what the build wrote into `outDir`, at its top — not in
 * `fonts/`, which the app serves.
 */
const MANIFEST = '.mcp-app-build.json';
const BUILT_BY = '@urbicon-ui/mcp-app/vite';

/**
 * A placeholder Vite replaces while building (`__VITE_PRELOAD__`,
 * `__VITE_ASSET__…`). Left in the finished chunk, it is an unbound name at
 * runtime.
 */
const VITE_MARKER = /__VITE_[A-Z0-9_]+__/;

/** `</script` inside an embedded script would end the element early. */
const SCRIPT_CLOSE = /<\/script/gi;
const STYLE_CLOSE = /<\/style/gi;
const SCRIPT_TAG = /<script type="module" crossorigin src="([^"]+)"><\/script>/g;
const STYLE_TAG = /<link rel="stylesheet" crossorigin href="([^"]+)">/g;
const ANY_REFERENCE = /(?:src|href)="\.\/[^"]+"/;
const RELATIVE = /^\.\//;
/** A scheme: `data:`, `https:` — a URL that names no file of the build. */
const SCHEME = /^[a-z][a-z\d+.-]*:/i;
const IDENTIFIER = /[\w-]/;

interface Paths {
  root: string;
  outDir: string;
  css?: string;
  exclude: string[];
}

function existing(path: string, what: string): string {
  if (!existsSync(path)) throw new Error(`${what} does not exist: ${path}`);
  // Vite names modules by their real path, and so does Tailwind's scanner.
  return realpathSync(path);
}

/**
 * A file or directory by device and inode, which no spelling of a path
 * changes — `undefined` where nothing is.
 */
function identity(path: string): string | undefined {
  const stat = statSync(path, { bigint: true, throwIfNoEntry: false });
  return stat ? `${stat.dev}:${stat.ino}` : undefined;
}

function pathsOf(options: ViewBuildOptions): Paths {
  const root = existing(resolve(options.root), 'root');
  const outDir = resolve(options.outDir);
  mkdirSync(outDir, { recursive: true });
  if (identity(outDir) === identity(root)) {
    throw new Error(`outDir is root (${root}): each view would be written over its own source.`);
  }
  return {
    root,
    outDir: realpathSync(outDir),
    ...(options.tailwind ? { css: existing(resolve(options.tailwind.css), 'tailwind.css') } : {}),
    exclude: (options.tailwind?.exclude ?? []).map((dir) =>
      existing(resolve(dir), 'tailwind.exclude')
    )
  };
}

function checkOptions(options: ViewBuildOptions): void {
  const seen = new Set<string>();
  for (const view of options.views) {
    if (!NAME.test(view)) {
      throw new Error(
        `A view name must be one lowercase URI segment, not ${JSON.stringify(view)}.`
      );
    }
    if (seen.has(view)) throw new Error(`The view ${view} is listed twice.`);
    seen.add(view);
  }
  const base = options.base;
  if (base) {
    if (base.placeholder === '') throw new Error('base.placeholder must not be empty.');
    // The build reads that form as a placeholder Vite forgot to replace.
    if (VITE_MARKER.test(base.placeholder)) {
      throw new Error(`base.placeholder must not look like Vite's own (${base.placeholder}).`);
    }
  }
  if (options.tailwind && options.tailwind.witness === '') {
    throw new Error('tailwind.witness must name a class.');
  }
}

/**
 * The argument of each `url(…)` in a CSS text, unquoted. Strings and comments
 * are skipped — a `url(` in `content: "…"` names nothing — and every step
 * moves forward, so the time stays linear in the length.
 */
function cssUrls(css: string): string[] {
  const urls: string[] = [];
  const afterString = (at: number): number => {
    let i = at + 1;
    while (i < css.length && css[i] !== css[at]) i += css[i] === '\\' ? 2 : 1;
    return i + 1;
  };
  let i = 0;
  while (i < css.length) {
    const c = css[i];
    // An escape outside a string is one character: Tailwind writes `content-['*']`
    // as `.content-\[\'\*\'\]`, and a quote read there would open a string.
    if (c === '\\') {
      i += 2;
    } else if (c === '"' || c === "'") {
      i = afterString(i);
    } else if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 2;
    } else if (css.slice(i, i + 4).toLowerCase() === 'url(' && !IDENTIFIER.test(css[i - 1] ?? '')) {
      let start = i + 4;
      while (css[start] === ' ' || css[start] === '\t' || css[start] === '\n') start += 1;
      if (css[start] === '"' || css[start] === "'") {
        i = afterString(start);
        urls.push(css.slice(start + 1, i - 1));
      } else {
        const close = css.indexOf(')', start);
        i = close === -1 ? css.length : close + 1;
        urls.push(css.slice(start, close === -1 ? css.length : close).trim());
      }
    } else {
      i += 1;
    }
  }
  return urls;
}

/**
 * A `url()` that names a file: in the host's sandbox it resolves against the
 * sandbox's origin, where nothing of the app is. Not one: `data:`, an
 * absolute URL, `//host`, a fragment (`url(#clip)`, the document itself) and
 * a URL under the placeholder, which `createViewCatalog` replaces.
 */
function pointsAtFile(url: string, placeholder: string | undefined): boolean {
  if (SCHEME.test(url) || url.startsWith('//') || url.startsWith('#')) return false;
  return placeholder === undefined || !url.startsWith(placeholder);
}

/** A class as it stands in a CSS selector — Tailwind escapes everything but `[\w-]`. */
function selectorOf(className: string): RegExp {
  const escaped = className.replace(/[^\w-]/g, (c) => `\\${c}`);
  return new RegExp(`\\.${escaped.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')}(?![\\w-])`);
}

/**
 * Script and CSS into the HTML — and **loud** when anything still points at a
 * file (a relative `src` or `href`, a `url()` of the CSS that names a file,
 * any file but a font left in the bundle), a placeholder of Vite stands in the
 * script, a font is not named under the app's origin, or the CSS lacks the
 * witness class: each of those views would break only in the host. A
 * `url()` may name a font as `fontUrl` names it, and any file under
 * `placeholder` — `base.placeholder`, which the catalog replaces.
 */
export function inlineIntoHtml(options: {
  fontUrl?: (fileName: string) => string;
  witness?: string;
  placeholder?: string;
}): Plugin {
  const witness = options.witness === undefined ? undefined : selectorOf(options.witness);
  return {
    name: 'mcp-app:inline-into-html',
    apply: 'build',
    enforce: 'post',
    // After every `generateBundle` without an order of its own, so after
    // Vite's `vite:build-import-analysis` too. `enforce: 'post'` alone is not
    // enough: Vite places its own build plugins behind the users' `post` ones.
    generateBundle: {
      order: 'post',
      handler(_options, bundle): void {
        const file = (ref: string): string => ref.replace(RELATIVE, '');
        // Rolldown up to 1.2.8 keeps a deleted entry in `Object.keys`, `in` and
        // a lookup within the same hook (fixed in 1.2.9, rolldown#10815), though
        // it no longer writes it — so what is inlined is counted here.
        const inlined = new Set<string>();
        for (const asset of Object.values(bundle)) {
          if (asset.type !== 'asset' || !asset.fileName.endsWith('.html')) continue;
          let html = String(asset.source);
          let styled = false;
          const styles: string[] = [];
          html = html.replace(SCRIPT_TAG, (_tag, ref: string) => {
            const chunk = bundle[file(ref)];
            if (chunk?.type !== 'chunk') throw new Error(`${asset.fileName}: no chunk for ${ref}.`);
            const marker = chunk.code.match(VITE_MARKER);
            if (marker) {
              throw new Error(
                `${asset.fileName}: ${marker[0]} is still in the script — embedded before Vite's generateBundle?`
              );
            }
            delete bundle[file(ref)];
            inlined.add(file(ref));
            return `<script type="module">${chunk.code.replace(SCRIPT_CLOSE, '<\\/script')}</script>`;
          });
          html = html.replace(STYLE_TAG, (_tag, ref: string) => {
            const css = bundle[file(ref)];
            if (css?.type !== 'asset') throw new Error(`${asset.fileName}: no CSS for ${ref}.`);
            const source = String(css.source);
            if (witness && !witness.test(source)) {
              throw new Error(
                `${asset.fileName}: the CSS has no rule for .${options.witness} (tailwind.witness) — ` +
                  'either Tailwind did not read the view’s script, or the class no longer yields a rule (is its token missing?).'
              );
            }
            styled = true;
            styles.push(source);
            delete bundle[file(ref)];
            inlined.add(file(ref));
            return `<style>${source.replace(STYLE_CLOSE, '<\\/style')}</style>`;
          });
          if (witness && !styled) {
            throw new Error(
              `${asset.fileName}: no CSS at all, so no rule for .${options.witness}.`
            );
          }
          if (ANY_REFERENCE.test(html)) {
            throw new Error(`${asset.fileName} still points at a file after inlining.`);
          }
          // Every font that stays must be named under the app's origin in the
          // CSS — a relative one would stand in the sandbox without its file.
          const fontUrls = new Set<string>();
          for (const name of Object.keys(bundle)) {
            if (!name.startsWith(FONT_PREFIX)) continue;
            if (!options.fontUrl) {
              throw new Error(`${asset.fileName}: ${name} is a font, and fonts need base.fonts.`);
            }
            const url = options.fontUrl(name);
            if (!html.includes(url)) {
              throw new Error(`${asset.fileName}: ${name} is not named ${url} in the CSS.`);
            }
            fontUrls.add(url);
          }
          for (const url of styles.flatMap(cssUrls)) {
            if (!fontUrls.has(url) && pointsAtFile(url, options.placeholder)) {
              throw new Error(
                `${asset.fileName}: the CSS still points at a file, url(${url}) — in the host’s sandbox ` +
                  'that names nothing of the app. Embed it, or name it under base.placeholder.'
              );
            }
          }
          asset.source = html;
        }
        const left = Object.keys(bundle).filter(
          (name) =>
            !inlined.has(name) &&
            !name.endsWith('.html') &&
            !(name.startsWith(FONT_PREFIX) && FONT_FILE.test(name))
        );
        if (left.length > 0) throw new Error(`Not inlined: ${left.join(', ')}.`);
      }
    }
  };
}

/**
 * The sources Tailwind reads, appended to `tailwind.css` before Tailwind sees
 * it. Both kinds of path are derived — the libraries from the options, the
 * script from the first pass — and none stands as text in the CSS file, where
 * a wrong one would show only in the host.
 *
 * **Loud when it does not apply:** a build where this step missed the file
 * would ship a view without the app's classes. Whether the source finds
 * anything is asked of the finished CSS (`tailwind.witness`).
 */
function scanSources(css: string, exclude: readonly string[], script: string): Plugin {
  let applied = false;
  return {
    name: 'mcp-app:scan-sources',
    enforce: 'pre',
    transform(code, id): string | undefined {
      if (id.split('?')[0] !== css) return undefined;
      applied = true;
      const lines = [
        ...exclude.map((dir) => `@source not ${JSON.stringify(dir)};`),
        `@source ${JSON.stringify(script)};`
      ];
      return `${code}\n${lines.join('\n')}\n`;
    },
    buildEnd(error): void {
      if (!error && !applied) {
        this.error(
          `${css} never passed through mcp-app:scan-sources — Tailwind would read no source.`
        );
      }
    }
  };
}

/** `<meta name content=placeholder>` in every view, so no HTML file has to carry it. */
function baseMeta(name: string, placeholder: string): Plugin {
  return {
    name: 'mcp-app:base-meta',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { name, content: placeholder }, injectTo: 'head' }
    ]
  };
}

/**
 * The Vite config of one pass for one view. `scan` is the first of the two
 * Tailwind passes: the script unminified and without the code's comments as
 * `<scanDir>/<view>.js`, nothing inlined — its CSS is thrown away; the view
 * pass has Tailwind read that script. With `options.tailwind` both passes
 * need `scanDir`, an existing directory of the loop's own: `buildViews` makes
 * a fresh temporary one and removes it afterwards.
 */
export function viewConfig(
  view: string,
  options: ViewBuildOptions,
  mode: 'scan' | 'view' = 'view',
  scanDir?: string
): InlineConfig {
  checkOptions(options);
  if (!options.views.includes(view)) throw new Error(`${view} is not one of options.views.`);
  if (mode === 'scan' && !options.tailwind) throw new Error('A scan pass needs options.tailwind.');
  if (options.tailwind && scanDir === undefined) {
    throw new Error('With options.tailwind, both passes need scanDir.');
  }
  const paths = pathsOf(options);
  const scanPath = scanDir === undefined ? undefined : existing(resolve(scanDir), 'scanDir');
  const scan = mode === 'scan';
  const base = options.base;
  const fontsPath = base?.fonts;
  const fontUrl =
    base && fontsPath !== undefined
      ? (fileName: string): string => `${base.placeholder}${fontsPath}${basename(fileName)}`
      : undefined;
  const tailwind = options.tailwind;
  return {
    configFile: false,
    root: paths.root,
    base: './',
    logLevel: 'warn',
    // Vite would copy `<root>/public/` into outDir, files the build neither writes nor removes.
    publicDir: false,
    plugins: [
      ...(tailwind && paths.css && scanPath
        ? [scanSources(paths.css, paths.exclude, join(scanPath, `${view}${SCAN_EXTENSION}`))]
        : []),
      ...(options.plugins ?? []),
      ...(base?.meta ? [baseMeta(base.meta, base.placeholder)] : []),
      ...(scan
        ? []
        : [inlineIntoHtml({ fontUrl, witness: tailwind?.witness, placeholder: base?.placeholder })])
    ],
    experimental: {
      renderBuiltUrl: (fileName, { hostType }) =>
        hostType === 'css' && fontUrl && FONT_FILE.test(fileName) ? fontUrl(fileName) : undefined
    },
    build: {
      outDir: scan && scanPath ? scanPath : paths.outDir,
      // Unminified, so Tailwind reads the classes as the source writes them.
      minify: !scan,
      // One pass builds one view; `buildViews` removes the earlier outputs once, before all.
      emptyOutDir: false,
      cssCodeSplit: false,
      cssTarget: [...CSS_TARGET],
      modulePreload: false,
      // Vite inlines a small asset as `data:`; never a font — the spec's CSP would not load it.
      assetsInlineLimit: (file) => (FONT_FILE.test(file) ? false : undefined),
      reportCompressedSize: false,
      rolldownOptions: {
        input: { [view]: join(paths.root, `${view}.html`) },
        output: {
          codeSplitting: false,
          // Unminified, Vite keeps JSDoc, legal and annotation comments, and
          // Tailwind takes each word of them that names a utility: a comment
          // edit in a bundled library would change the CSS and the view's URI.
          ...(scan ? { comments: false } : {}),
          entryFileNames: scan ? `[name]${SCAN_EXTENSION}` : 'assets/[name]-[hash].js',
          hashCharacters: 'hex',
          // The content in the name: the app may serve the fonts as immutable.
          assetFileNames: (asset) =>
            asset.names.some((name) => FONT_FILE.test(name))
              ? `${FONT_PREFIX}[name]-[hash:8][extname]`
              : 'assets/[name]-[hash][extname]'
        }
      }
    }
  };
}

/** `lstat` — the entry itself, a link not followed — or `undefined` where nothing is. */
function entry(path: string): Stats | undefined {
  return lstatSync(path, { throwIfNoEntry: false });
}

interface Manifest {
  builtBy: typeof BUILT_BY;
  /** Per view, the files the build wrote for it, relative to `outDir`. */
  views: Record<string, string[]>;
  /** The directories of `outDir` the build made — removed once they are empty. */
  directories: string[];
}

/** A path the build writes: `<view>.html`, or a font directly in `fonts/` — no way out of `outDir`. */
function ownPath(name: string): boolean {
  if (name.endsWith('.html')) return NAME.test(name.slice(0, -'.html'.length));
  const file = name.slice(FONT_PREFIX.length);
  return (
    name.startsWith(FONT_PREFIX) &&
    !file.includes('/') &&
    !file.includes('\\') &&
    FONT_FILE.test(file)
  );
}

function isManifest(value: unknown): value is Manifest {
  if (typeof value !== 'object' || value === null) return false;
  const { builtBy, views, directories } = value as Partial<Record<keyof Manifest, unknown>>;
  return (
    builtBy === BUILT_BY &&
    Array.isArray(directories) &&
    directories.every((dir) => dir === FONT_DIR) &&
    typeof views === 'object' &&
    views !== null &&
    !Array.isArray(views) &&
    Object.entries(views).every(
      ([view, files]) =>
        NAME.test(view) &&
        Array.isArray(files) &&
        files.every((file) => typeof file === 'string' && ownPath(file))
    )
  );
}

/** The previous build's list — `undefined` without one; loud when the file is not such a list. */
function readManifest(outDir: string): Manifest | undefined {
  const path = join(outDir, MANIFEST);
  const stat = entry(path);
  if (!stat) return undefined;
  const refuse = (why: string, cause?: unknown): Error =>
    new Error(
      `${path} ${why}: no other list says what the build may write over or remove. ` +
        'Remove it, and the next build starts a new list, removing nothing.',
      { cause }
    );
  if (!stat.isFile()) throw refuse(stat.isSymbolicLink() ? 'is a symbolic link' : 'is no file');
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw refuse('is no JSON', error);
  }
  if (!isManifest(parsed)) throw refuse('is not the list buildViews writes');
  return parsed;
}

/** Written strictly: the next build reads it back with `isManifest`, and refuses what fails it. */
function writeManifest(outDir: string, manifest: Manifest): void {
  if (!isManifest(manifest as unknown)) {
    throw new Error(`The build wrote a file it cannot list: ${JSON.stringify(manifest.views)}.`);
  }
  const path = join(outDir, MANIFEST);
  const stat = entry(path);
  if (stat && !stat.isFile())
    throw new Error(`${path} is no file; the build keeps its list there.`);
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

/** `<outDir>/fonts/` — a directory or nothing; whether it is there. */
function fontDirectory(outDir: string): boolean {
  const dir = join(outDir, FONT_DIR);
  const stat = entry(dir);
  if (stat?.isSymbolicLink()) {
    throw new Error(
      `${dir} is a symbolic link; the build writes its fonts only into a directory of outDir.`
    );
  }
  if (stat && !stat.isDirectory()) throw new Error(`${dir} is no directory.`);
  return stat !== undefined;
}

/**
 * `name` in `outDir` as the build may write over it or remove it: nothing
 * there (`false`), or a file none of its sources is (`true`). A symbolic link
 * stops the build — Vite would write through it, and what lies behind it is
 * not the build's.
 */
function ownFile(outDir: string, name: string, sources: ReadonlySet<string>): boolean {
  const path = join(outDir, name);
  const stat = entry(path);
  if (!stat) return false;
  if (stat.isSymbolicLink()) {
    throw new Error(
      `${path} is a symbolic link; the build writes and removes no file through one.`
    );
  }
  if (!stat.isFile())
    throw new Error(`${path} is no file; the build writes and removes only files.`);
  const id = identity(path);
  if (id !== undefined && sources.has(id)) {
    throw new Error(`${path} is a source of the build; it would be written over or removed.`);
  }
  return true;
}

interface Ledger {
  outDir: string;
  /** The files of the previous build's list. */
  listed: ReadonlySet<string>;
  /** The files this build wrote so far. */
  written: Set<string>;
  /** Device and inode of every file the build read. */
  sources: Set<string>;
}

/** Where the build is about to write `name`: nothing yet, a file on the list, or one it wrote itself. */
function checkTarget(ledger: Ledger, name: string): void {
  if (!ownFile(ledger.outDir, name, ledger.sources)) return;
  const path = join(ledger.outDir, name);
  // Vite writes over a file in place, so every other hard link of it changes too
  // (a backup made with `rsync --link-dest` or `cp -al`). A font's name carries
  // its content, so only the HTML can change under the same name.
  if (name.endsWith('.html') && (entry(path)?.nlink ?? 1) > 1) {
    throw new Error(
      `${path} has another hard link; writing over it would change that file too. ` +
        'Replace it with a copy of its own, or build into another outDir.'
    );
  }
  if (ledger.listed.has(name) || ledger.written.has(name)) return;
  throw new Error(
    `${path} is not on ${MANIFEST}: the build writes over no file it did not write. ` +
      "Remove that build's output once (its <view>.html files and fonts/), or build into another outDir."
  );
}

function addSource(ledger: Ledger, path: string): void {
  const id = identity(path);
  if (id !== undefined) ledger.sources.add(id);
}

/**
 * The view pass's bookkeeping. Before Vite writes, each file it will write is
 * checked as a target, and what the pass read joins the sources; after the
 * write, the files go to `wrote`. A view pass writes the HTML and the fonts:
 * `inlineIntoHtml` takes the script and the CSS and stops on anything else.
 */
function ledgerOf(ledger: Ledger, root: string, wrote: (files: string[]) => void): Plugin {
  let files: string[] = [];
  return {
    name: 'mcp-app:ledger',
    apply: 'build',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      handler(_options, bundle): void {
        for (const id of this.getModuleIds()) {
          const path = id.split('?')[0] ?? id;
          if (isAbsolute(path)) addSource(ledger, path);
        }
        files = Object.keys(bundle).filter(
          (name) => name.endsWith('.html') || name.startsWith(FONT_PREFIX)
        );
        for (const name of files) {
          const output = bundle[name];
          if (output?.type !== 'asset') continue;
          for (const original of output.originalFileNames)
            addSource(ledger, resolve(root, original));
        }
        for (const name of files) checkTarget(ledger, name);
      }
    },
    writeBundle(): void {
      wrote(files);
    }
  };
}

/**
 * Builds every view: with `tailwind` the scan pass for each, then the view
 * pass for each — one Vite run per view and pass, since a chunk without code
 * splitting has exactly one entry. Then it removes what the previous build's
 * list names and this one did not write, and writes its own list
 * (`ViewBuildOptions.outDir`). Returns the size of each view and of the
 * fonts, for the app to print.
 */
export async function buildViews(options: ViewBuildOptions): Promise<ViewBuild> {
  checkOptions(options);
  const paths = pathsOf(options);
  const { outDir } = paths;
  const previous = readManifest(outDir);
  const ledger: Ledger = {
    outDir,
    listed: new Set(previous ? Object.values(previous.views).flat() : []),
    written: new Set(),
    sources: new Set()
  };
  for (const view of options.views) {
    addSource(ledger, existing(join(paths.root, `${view}.html`), `The view ${view}`));
  }
  if (paths.css) addSource(ledger, paths.css);

  // Everything the build knows it will touch is checked before it writes anything.
  const hadFonts = fontDirectory(outDir);
  for (const name of ledger.listed) ownFile(outDir, name, ledger.sources);
  for (const view of options.views) checkTarget(ledger, `${view}.html`);

  const wrote = new Map<string, string[]>();
  // There now, and made by this build or, says the list, by an earlier one.
  const madeFonts = (): boolean =>
    fontDirectory(outDir) && (!hadFonts || previous?.directories.includes(FONT_DIR) === true);
  const scanDir = options.tailwind
    ? realpathSync(mkdtempSync(join(tmpdir(), 'mcp-app-scan-')))
    : undefined;
  const views: BuiltView[] = [];
  try {
    if (scanDir) {
      for (const view of options.views) await build(viewConfig(view, options, 'scan', scanDir));
      const scanned = readdirSync(scanDir).filter((name) => name.endsWith(SCAN_EXTENSION));
      if (scanned.length !== options.views.length) {
        throw new Error(
          `The scan pass left ${scanned.length} scripts, not ${options.views.length}: ${scanned.join(', ')}.`
        );
      }
    }
    for (const view of options.views) {
      const config = viewConfig(view, options, 'view', scanDir);
      config.plugins = [
        ...(config.plugins ?? []),
        ledgerOf(ledger, paths.root, (files) => {
          wrote.set(view, files);
          for (const name of files) ledger.written.add(name);
        })
      ];
      await build(config);
      const file = join(outDir, `${view}.html`);
      const bytes = readFileSync(file);
      views.push({
        name: view,
        file,
        bytes: bytes.byteLength,
        gzipBytes: gzipSync(bytes).byteLength
      });
    }

    // Checked, all of it, before the first is removed.
    fontDirectory(outDir);
    const stale = [...ledger.listed].filter(
      (name) => !ledger.written.has(name) && ownFile(outDir, name, ledger.sources)
    );
    for (const name of stale) rmSync(join(outDir, name));
    let directories = madeFonts() ? [FONT_DIR] : [];
    const fontDir = join(outDir, FONT_DIR);
    if (directories.length > 0 && readdirSync(fontDir).length === 0) {
      rmdirSync(fontDir);
      directories = [];
    }
    writeManifest(outDir, { builtBy: BUILT_BY, views: Object.fromEntries(wrote), directories });
  } catch (error) {
    // What a failed build wrote stays on the list, for the next one to write over or remove.
    if (ledger.written.size > 0) {
      const listedViews = { ...previous?.views };
      for (const [view, files] of wrote) {
        listedViews[view] = [...new Set([...(listedViews[view] ?? []), ...files])];
      }
      try {
        writeManifest(outDir, {
          builtBy: BUILT_BY,
          views: listedViews,
          directories: madeFonts() ? [FONT_DIR] : []
        });
      } catch (failed) {
        throw new AggregateError([error, failed], 'The build failed, and so did writing its list.');
      }
    }
    throw error;
  } finally {
    if (scanDir) rmSync(scanDir, { recursive: true, force: true });
  }

  const fontNames = [...ledger.written]
    .filter((name) => name.startsWith(FONT_PREFIX))
    .map((name) => name.slice(FONT_PREFIX.length))
    .sort();
  const fontBytes = fontNames.reduce(
    (sum, name) => sum + statSync(join(outDir, FONT_DIR, name)).size,
    0
  );
  return { views, fonts: { files: fontNames, bytes: fontBytes } };
}
