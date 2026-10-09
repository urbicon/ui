/**
 * The server build of a `.svelte` file, importable from a jsdom test.
 *
 * A test file runs in one Vite environment, and under jsdom every `.svelte`
 * import is compiled for the client — so a hydration test cannot import the
 * server build of the component it hydrates. This compiles it with
 * `svelte/compiler` instead and imports the result. `svelte/server` and
 * `svelte/internal/server` carry no `browser` export condition, so the
 * test's `render` and the compiled module share the server runtime here too.
 *
 * Imports are rewritten so the output resolves from wherever it is written:
 * relative `.svelte` imports are compiled the same way, other relative ones
 * (`./icon-transform`, `./svg/log-out.svg?raw`) become absolute paths for
 * Vite to load, `svelte/*` becomes the file node resolves it to. Anything else
 * throws. A relative `.ts` module that itself imports `.svelte` files would
 * hand the server render client builds — the icon registry does, so
 * `<Icon name>` cannot be loaded this way, only a leaf icon.
 *
 * The output goes to the package's gitignored `node_modules/.cache`: Vite's
 * module runner answers "Cannot find module" for the same files under the OS
 * temp dir.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import type { Component } from 'svelte';
import { compile } from 'svelte/compiler';

const require = createRequire(import.meta.url);
const SCRIPT_EXTENSIONS = ['', '.ts', '.js'];

export interface ServerBuild {
  load<Props extends Record<string, unknown>>(file: string): Promise<Component<Props>>;
  dispose(): void;
}

export function serverBuild(): ServerBuild {
  const cache = join(process.cwd(), 'node_modules/.cache');
  mkdirSync(cache, { recursive: true });
  const out = mkdtempSync(join(cache, 'server-build-'));
  const emitted = new Map<string, string>();

  function rewrite(specifier: string, importer: string): string {
    if (specifier === 'svelte' || specifier.startsWith('svelte/')) {
      return require.resolve(specifier);
    }
    if (!specifier.startsWith('.')) {
      throw new Error(`server-build: no rule for '${specifier}' imported by ${importer}`);
    }
    const [path, query] = specifier.split('?');
    const absolute = resolve(dirname(importer), path);
    if (absolute.endsWith('.svelte')) return emit(absolute);
    const file = SCRIPT_EXTENSIONS.map((ext) => absolute + ext).find((f) => existsSync(f));
    if (!file) throw new Error(`server-build: cannot resolve '${specifier}' from ${importer}`);
    return query ? `${file}?${query}` : file;
  }

  function emit(file: string): string {
    const known = emitted.get(file);
    if (known) return known;
    // Not `*.svelte.js`: vite-plugin-svelte would compile that again as a
    // runes module and reject the `$` import.
    const target = join(out, `${emitted.size}-${basename(file, '.svelte')}.server.js`);
    emitted.set(file, target);
    const { js } = compile(readFileSync(file, 'utf8'), {
      filename: file,
      generate: 'server',
      dev: true
    });
    const code = js.code.replace(
      /\b(from|import) '([^']+)'/g,
      (_, keyword: string, specifier: string) => `${keyword} '${rewrite(specifier, file)}'`
    );
    writeFileSync(target, code);
    return target;
  }

  return {
    async load(file) {
      return (await import(/* @vite-ignore */ emit(file))).default;
    },
    dispose() {
      rmSync(out, { recursive: true, force: true });
    }
  };
}
