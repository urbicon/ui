/**
 * The selector of a component's own `@media print` rule, as the Svelte
 * compiler writes it — shared by the two components that hide themselves in
 * print (Spinner, Skeleton).
 *
 * Both are `role="status"` elements, so the rule inside each is written
 * `[role='status']` and MUST NOT be wrapped in `:global()`: that compiles to a
 * bare attribute selector and takes every polite live region in the document —
 * a status Alert, a `Badge purpose="status"`, the other one of these two.
 *
 * Svelte derives the scope class from the component's path **relative to
 * `process.cwd()`**: `Spinner.svelte` compiles to `.svelte-1mebawt` from
 * `packages/blocks` and to `.svelte-4txqe8` from the repo root
 * (`bun --filter='@urbicon-ui/blocks' run test:run` runs from the former,
 * which is also vite's `root`, so the class here is the class the bundler put
 * on the mounted element). Nothing about that agreement is silent: should the
 * runner's cwd ever stop matching the bundler's root, the caller's positive
 * assertion — the mounted root matches this selector — is what fails.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile } from 'svelte/compiler';

export function printSelector(dir: string, file: string): string {
  const path = resolve(dir, file);
  const css = compile(readFileSync(path, 'utf8'), { filename: path }).css?.code ?? '';
  const rule = /@media\s+print\s*\{\s*([^{]+)\{/.exec(css);
  if (!rule) throw new Error(`${file} ships no @media print rule — this suite has no subject`);
  return rule[1].trim();
}
