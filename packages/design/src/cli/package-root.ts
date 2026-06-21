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
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
