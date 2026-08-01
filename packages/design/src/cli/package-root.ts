/**
 * Locate the `@urbicon-ui/design` package root from inside the running CLI — the
 * dir holding its `package.json`. Works both from the TypeScript source
 * (`src/cli/`, dev) and the published single-file bundle (`dist/cli.js`), since
 * `import.meta.url` points at this module either way and we walk up to the marker.
 *
 * Used to resolve package-relative assets the CLI ships — its own version and the
 * `skill/` directory — without a build-time path constant.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Read a packaged template (`templates/<name>`), or throw a clear error. */
export async function readTemplate(name: string): Promise<string> {
  const root = await findPackageRoot();
  if (!root) throw new Error('could not locate the @urbicon-ui/design package root');
  return readFile(join(root, 'templates', name), 'utf-8');
}

/**
 * The package's own version from its package.json, `'unknown'` when unresolvable
 * (a broken install). Callers treat `'unknown'` as "can't tell" — `init` skips the
 * block stamp, `context` skips the staleness check — rather than guessing.
 */
export async function readPackageVersion(): Promise<string> {
  const root = await findPackageRoot();
  if (!root) return 'unknown';
  try {
    const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf-8')) as {
      version?: string;
    };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Walk up to the `@urbicon-ui/design` package root, or null when not found. */
export async function findPackageRoot(): Promise<string | null> {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    try {
      const pkg = JSON.parse(await readFile(resolve(dir, 'package.json'), 'utf-8')) as {
        name?: string;
      };
      if (pkg.name === '@urbicon-ui/design') return dir;
    } catch {
      // not this directory — keep walking up
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
