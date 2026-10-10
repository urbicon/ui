import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BLOCKS_ROUTES = fileURLToPath(new URL('../../apps/docs/src/routes/blocks/', import.meta.url));

function subdirectories(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * Every component page under `/blocks/<group>/<slug>`, read from the route tree
 * instead of a hand-kept list — a list beside the routes stops covering the
 * pages added after it.
 *
 * A page is a directory holding a `+page.svelte`. A directory without one is a
 * redirect (`+page.ts` only) or a sub-component's generated `api.ts` and
 * documents nothing.
 *
 * Throws instead of returning a short list: a group that yields no page means
 * the derivation broke (a moved route tree, a renamed page file), and an empty
 * list would make every caller a silent pass. A route group `(x)` or param
 * directory `[x]` contributes no literal URL segment, so it is rejected rather
 * than turned into a URL that 404s — the same contract as `registry:lint`.
 */
export function blocksDocRoutes(): string[] {
  const groups = subdirectories(BLOCKS_ROUTES);
  if (groups.length === 0) {
    throw new Error(`blocksDocRoutes: no group directories under ${BLOCKS_ROUTES}.`);
  }

  const routes: string[] = [];
  for (const group of groups) {
    const groupDir = join(BLOCKS_ROUTES, group);
    const slugs = subdirectories(groupDir);
    for (const name of [group, ...slugs]) {
      if (name.startsWith('(') || name.startsWith('[')) {
        throw new Error(
          `blocksDocRoutes: ${name} under ${BLOCKS_ROUTES} is a route group or param directory, ` +
            `which maps to no literal URL. Teach blocksDocRoutes how to resolve it.`
        );
      }
    }
    const pages = slugs.filter((slug) => existsSync(join(groupDir, slug, '+page.svelte')));
    if (pages.length === 0) {
      throw new Error(
        `blocksDocRoutes: ${groupDir} holds no <slug>/+page.svelte. Either the derivation is ` +
          `broken or this is not a group directory — fix one or the other, do not return [].`
      );
    }
    routes.push(...pages.map((slug) => `/blocks/${group}/${slug}`));
  }
  return routes;
}
