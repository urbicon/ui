/**
 * `urbicon find [query]` — fuzzy component discovery over the version-pinned
 * catalog, the local, version-correct mirror of the remote `find_components`. Ranks
 * with the shared `@urbicon-ui/design-engine/search` ranker (so local and remote
 * discovery agree) and prints a compact list; `--json` for machine consumption.
 * With no query, lists the whole catalog (optionally `--tag`-filtered).
 *
 * `find` is a query, not a gate: it exits 0 even on no matches (only an unreadable
 * catalog is a failure). Pair it with `urbicon get-component <slug>` for the API.
 */

import { type ComponentCatalogEntry, matchComponents } from '@urbicon-ui/design-engine/search';
import { boolFlag, type Flags, stringFlag } from '../args.js';
import { loadCatalog } from '../content.js';
import { EXIT, printError } from '../output.js';

/** Variant summary, skipping pure boolean variants (just true/false). */
function variantSummary(entry: ComponentCatalogEntry): string {
  return entry.variants
    .filter((v) => !v.values.every((x) => x === 'true' || x === 'false'))
    .map((v) => `${v.name}: ${v.values.join('/')}`)
    .join(' · ');
}

/** First line of the catalog description, truncated — a discovery list stays scannable. */
function shortDescription(description: string): string {
  const firstLine = description.split('\n')[0]?.trim() ?? '';
  return firstLine.length > 140 ? `${firstLine.slice(0, 139)}…` : firstLine;
}

function formatEntry(entry: ComponentCatalogEntry): string {
  const lines = [`  ${entry.name}  ·  ${entry.slug}`, `    ${shortDescription(entry.description)}`];
  const variants = variantSummary(entry);
  if (variants) lines.push(`    ${variants}`);
  if (entry.relatedComponents.length > 0) {
    lines.push(`    related: ${entry.relatedComponents.join(', ')}`);
  }
  return lines.join('\n');
}

export async function runFind(positionals: string[], flags: Flags): Promise<number> {
  const query = positionals.join(' ').trim();
  const asJson = boolFlag(flags, 'json');
  const tag = stringFlag(flags, 'tag');
  const tags = tag ? [tag] : undefined;

  const limitRaw = stringFlag(flags, 'limit');
  const limit = limitRaw === undefined ? 10 : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1) {
    printError('--limit needs a positive integer, e.g. --limit 10');
    return EXIT.USAGE;
  }

  let components: ComponentCatalogEntry[];
  try {
    components = (await loadCatalog()).components;
  } catch (err) {
    printError(
      `could not read the component catalog (${(err as Error).message}). ` +
        'Reinstall @urbicon-ui/design-content, or run `docs:gen:all` in the monorepo.'
    );
    return EXIT.FAIL;
  }

  const results = query
    ? matchComponents(components, query, tags, limit)
    : components.filter((c) => !tags || c.tags.some((t) => tags.includes(t)));

  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
    return EXIT.OK;
  }

  if (results.length === 0) {
    console.log(
      query
        ? `No components match "${query}". Try broader terms, or run \`urbicon find\` with no query to list all.`
        : `No components${tag ? ` tagged "${tag}"` : ''} in the catalog.`
    );
    return EXIT.OK;
  }

  const header = query
    ? `${results.length} component(s) matching "${query}":`
    : `${results.length} component(s)${tag ? ` tagged "${tag}"` : ''}:`;
  console.log(`${header}\n`);
  for (const entry of results) {
    console.log(`${formatEntry(entry)}\n`);
  }
  console.log(
    '→ `urbicon get-component <slug>` for the full API · `get_css_reference` for tokens.'
  );
  return EXIT.OK;
}
