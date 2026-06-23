#!/usr/bin/env bun
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
/**
 * Post-`svelte-package` pass — make the emitted ESM fully specified.
 *
 * `svelte-package` copies the source's import/export specifiers verbatim (only
 * rewriting the `$lib` alias to a relative path). With `moduleResolution:
 * "bundler"` the source omits extensions, so the build emits bare specifiers
 * like `export { I18nProvider } from './components'` (a *directory*) and
 * `from './types'` (no extension). Node's strict ESM resolver — which Vite uses
 * for SSR of externalised packages — rejects both:
 *
 *   Error [ERR_UNSUPPORTED_DIR_IMPORT]: Directory import '.../dist/components'
 *   → every SvelteKit route 500s unless the consumer adds `ssr.noExternal`.
 *
 * This pass rewrites every *relative* specifier in the built output to a
 * fully-specified one by resolving it against the files actually emitted:
 *
 *   ./types            → ./types.js            (extensionless module)
 *   ./context.svelte   → ./context.svelte.js   (a `.svelte.js` runes module)
 *   ./components       → ./components/index.js  (directory → its index)
 *   ./T.svelte         → ./T.svelte            (a real component file — untouched)
 *
 * It runs over both `.js` (runtime) and `.d.ts` (so `node16`/`nodenext`
 * type-resolution consumers stay valid), is idempotent, and only touches
 * specifiers it can resolve to an emitted file — external and already-specified
 * imports are left alone. `.svelte` component files are intentionally skipped:
 * they are compiled by the consumer's `vite-plugin-svelte`, not loaded by Node.
 *
 * Usage: `bun <repo>/scripts/complete-esm-specifiers.ts [distDir=dist]`
 * (invoked from each package's `build` script with cwd = the package root).
 */
import { Glob } from 'bun';

const distDir = resolve(process.cwd(), process.argv[2] ?? 'dist');
if (!existsSync(distDir)) {
  console.error(`[complete-esm-specifiers] dist dir not found: ${distDir}`);
  process.exit(1);
}

const isFile = (p: string): boolean => existsSync(p) && statSync(p).isFile();

/** Resolve a relative specifier to a fully-specified one, or return it unchanged. */
function complete(spec: string, fromDir: string): string {
  const abs = resolve(fromDir, spec);
  if (isFile(abs)) return spec; // already a real file: ./T.svelte, ./x.js, ./x.css
  if (isFile(`${abs}.js`)) return `${spec}.js`; // ./types → .js, ./context.svelte → .svelte.js
  // Directory → its index. Strip a trailing slash first so `./` → `./index.js`, not `.//index.js`.
  if (isFile(join(abs, 'index.js'))) return `${spec.replace(/\/$/, '')}/index.js`;
  return spec; // external or unresolved — leave alone
}

// The specifier string in: `… from '…'`, side-effect `import '…'`, dynamic `import('…')`.
// Group 1 captures the whole lead (`from `, `import `, `import(`) so it round-trips verbatim.
const SPECIFIER = /\b((?:from|import)\s*\(?\s*)(['"])(\.\.?(?:\/[^'"]*)?)\2/g;

let filesChanged = 0;
let specifiersRewritten = 0;

for (const rel of new Glob('**/*.{js,ts}').scanSync({ cwd: distDir })) {
  // Test files are excluded from the published tarball via package.json `files`.
  if (/\.(test|spec)\./.test(rel)) continue;
  const file = join(distDir, rel);
  const fromDir = dirname(file);
  const src = readFileSync(file, 'utf8');
  let changed = false;
  const out = src.replace(SPECIFIER, (full, lead, quote, spec) => {
    const completed = complete(spec, fromDir);
    if (completed === spec) return full;
    changed = true;
    specifiersRewritten++;
    return `${lead}${quote}${completed}${quote}`;
  });
  if (changed) {
    writeFileSync(file, out);
    filesChanged++;
  }
}

console.log(
  `[complete-esm-specifiers] ${distDir}: rewrote ${specifiersRewritten} specifier(s) in ${filesChanged} file(s)`
);
