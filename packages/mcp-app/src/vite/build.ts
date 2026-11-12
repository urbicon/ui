/**
 * Building a view: **one HTML file per view**, script and CSS inside it, the
 * fonts beside it.
 *
 * A host fetches the view with `resources/read` and writes it into a sandbox
 * on an origin of its own. Anything the view loaded from elsewhere would need
 * the CSP's permission and — for a module script, a `crossorigin` stylesheet
 * and every font — a CORS answer from the app. So the script and the CSS go
 * into the HTML, and the build fails when anything still points at a file.
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
 * therefore runs twice: the first pass writes each view's script, unminified,
 * to `<outDir>/scan/`; the second excludes the libraries (`@source not`) and
 * lets Tailwind read exactly that script — what Rolldown put into the view
 * after tree-shaking, every class of every component it uses, and no list
 * beside it. Each view reads only its own script: read across all of them, a
 * view would carry every other view's classes.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
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
   * Where `<view>.html` and `fonts/` land. The build removes only what it
   * writes there: those files and its `scan/` directory.
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
const SCAN_DIR = 'scan';
/** The first pass's script extension — one place for its file name, Tailwind's source and the count. */
const SCAN_EXTENSION = '.js';
const FONT_DIR = 'fonts/';
const FONT_FILE = /\.(?:woff2?|ttf|otf)$/;

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

interface Paths {
  root: string;
  outDir: string;
  scan: string;
  css?: string;
  exclude: string[];
}

function existing(path: string, what: string): string {
  if (!existsSync(path)) throw new Error(`${what} does not exist: ${path}`);
  // Vite names modules by their real path, and so does Tailwind's scanner.
  return realpathSync(path);
}

function pathsOf(options: ViewBuildOptions): Paths {
  const outDir = resolve(options.outDir);
  mkdirSync(outDir, { recursive: true });
  const real = realpathSync(outDir);
  return {
    root: existing(resolve(options.root), 'root'),
    outDir: real,
    scan: join(real, SCAN_DIR),
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

/** A class as it stands in a CSS selector — Tailwind escapes everything but `[\w-]`. */
function selectorOf(className: string): RegExp {
  const escaped = className.replace(/[^\w-]/g, (c) => `\\${c}`);
  return new RegExp(`\\.${escaped.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')}(?![\\w-])`);
}

/**
 * Script and CSS into the HTML — and **loud** when anything still points at a
 * file, a placeholder of Vite stands in the script, a font is not named under
 * the app's origin, or the CSS lacks the witness class: each of those views
 * would break only in the host.
 */
export function inlineIntoHtml(options: {
  fontUrl?: (fileName: string) => string;
  witness?: string;
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
        for (const asset of Object.values(bundle)) {
          if (asset.type !== 'asset' || !asset.fileName.endsWith('.html')) continue;
          let html = String(asset.source);
          let styled = false;
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
            delete bundle[file(ref)];
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
          for (const name of Object.keys(bundle)) {
            if (!name.startsWith(FONT_DIR)) continue;
            if (!options.fontUrl) {
              throw new Error(`${asset.fileName}: ${name} is a font, and fonts need base.fonts.`);
            }
            if (!html.includes(options.fontUrl(name))) {
              throw new Error(
                `${asset.fileName}: ${name} is not named ${options.fontUrl(name)} in the CSS.`
              );
            }
          }
          asset.source = html;
        }
        const left = Object.keys(bundle).filter(
          (name) => !name.endsWith('.html') && !(name.startsWith(FONT_DIR) && FONT_FILE.test(name))
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
 * Tailwind passes: the script unminified as a file in `<outDir>/scan/`,
 * nothing inlined — its CSS is thrown away.
 */
export function viewConfig(
  view: string,
  options: ViewBuildOptions,
  mode: 'scan' | 'view' = 'view'
): InlineConfig {
  checkOptions(options);
  if (!options.views.includes(view)) throw new Error(`${view} is not one of options.views.`);
  if (mode === 'scan' && !options.tailwind) throw new Error('A scan pass needs options.tailwind.');
  const paths = pathsOf(options);
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
    plugins: [
      ...(tailwind && paths.css
        ? [scanSources(paths.css, paths.exclude, join(paths.scan, `${view}${SCAN_EXTENSION}`))]
        : []),
      ...(options.plugins ?? []),
      ...(base?.meta ? [baseMeta(base.meta, base.placeholder)] : []),
      ...(scan ? [] : [inlineIntoHtml({ fontUrl, witness: tailwind?.witness })])
    ],
    experimental: {
      renderBuiltUrl: (fileName, { hostType }) =>
        hostType === 'css' && fontUrl && FONT_FILE.test(fileName) ? fontUrl(fileName) : undefined
    },
    build: {
      outDir: scan ? paths.scan : paths.outDir,
      // Unminified, so Tailwind reads the classes as the source writes them.
      minify: !scan,
      // One pass builds one view; the build function clears once, before all.
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
          entryFileNames: scan ? `[name]${SCAN_EXTENSION}` : 'assets/[name]-[hash].js',
          // The content in the name: the app may serve the fonts as immutable.
          assetFileNames: (asset) =>
            asset.names.some((name) => FONT_FILE.test(name))
              ? `${FONT_DIR}[name]-[hash][extname]`
              : 'assets/[name]-[hash][extname]'
        }
      }
    }
  };
}

/**
 * Builds every view: with `tailwind` the scan pass for each, then the view
 * pass for each — one Vite run per view and pass, since a chunk without code
 * splitting has exactly one entry. Returns the size of each view and of the
 * fonts, for the app to print.
 */
export async function buildViews(options: ViewBuildOptions): Promise<ViewBuild> {
  checkOptions(options);
  const paths = pathsOf(options);
  for (const view of options.views) existing(join(paths.root, `${view}.html`), `The view ${view}`);
  for (const view of options.views) rmSync(join(paths.outDir, `${view}.html`), { force: true });
  rmSync(join(paths.outDir, FONT_DIR), { recursive: true, force: true });
  rmSync(paths.scan, { recursive: true, force: true });

  if (options.tailwind) {
    for (const view of options.views) await build(viewConfig(view, options, 'scan'));
    const scanned = readdirSync(paths.scan).filter((name) => name.endsWith(SCAN_EXTENSION));
    if (scanned.length !== options.views.length) {
      throw new Error(
        `The scan pass left ${scanned.length} scripts, not ${options.views.length}: ${scanned.join(', ')}.`
      );
    }
  }
  const views: BuiltView[] = [];
  for (const view of options.views) {
    await build(viewConfig(view, options));
    const file = join(paths.outDir, `${view}.html`);
    const bytes = readFileSync(file);
    views.push({
      name: view,
      file,
      bytes: bytes.byteLength,
      gzipBytes: gzipSync(bytes).byteLength
    });
  }
  rmSync(paths.scan, { recursive: true, force: true });

  const fontDir = join(paths.outDir, FONT_DIR);
  const files = existsSync(fontDir) ? readdirSync(fontDir).sort() : [];
  const fontBytes = files.reduce(
    (sum, name) => sum + readFileSync(join(fontDir, name)).byteLength,
    0
  );
  return { views, fonts: { files, bytes: fontBytes } };
}
