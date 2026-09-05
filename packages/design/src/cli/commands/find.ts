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

import type { ComponentCatalog, ComponentCatalogEntry } from '@urbicon-ui/design-engine/search';
import { isBooleanAxis, matchComponents } from '@urbicon-ui/design-engine/search';
import { boolFlag, type Flags, stringFlag } from '../args.js';
import { loadCatalog } from '../content.js';
import { type InstallState, installStateFor, readConsumerDependencies } from '../installed.js';
import { EXIT, printError } from '../output.js';

/** Variant summary, skipping pure boolean variants (just true/false). */
function variantSummary(entry: ComponentCatalogEntry): string {
  return entry.variants
    .filter((v) => !isBooleanAxis(v.values))
    .map((v) => `${v.name}: ${v.values.join('/')}`)
    .join(' · ');
}

/** First line of the catalog description, truncated — a discovery list stays scannable. */
function shortDescription(description: string): string {
  const firstLine = description.split('\n')[0]?.trim() ?? '';
  return firstLine.length > 140 ? `${firstLine.slice(0, 139)}…` : firstLine;
}

/** Origin package + install state on the headline, so the import target is never ambiguous. */
function packageTag(entry: ComponentCatalogEntry, state: InstallState): string {
  return state === 'missing' ? `${entry.package}  ·  ⚠ not installed` : entry.package;
}

function formatEntry(entry: ComponentCatalogEntry, state: InstallState): string {
  const lines = [
    `  ${entry.name}  ·  ${entry.slug}  ·  ${packageTag(entry, state)}`,
    `    ${shortDescription(entry.description)}`
  ];
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

  let catalog: ComponentCatalog;
  try {
    catalog = await loadCatalog();
  } catch (err) {
    printError(
      `could not read the component catalog (${(err as Error).message}). ` +
        'Reinstall @urbicon-ui/design-content, or run `docs:gen:all` in the monorepo.'
    );
    return EXIT.FAIL;
  }
  const components = catalog.components;

  // A tag is a closed set, unlike the free-text query: a value outside it can only
  // be a mistake, and answering "no components tagged X" would read exactly like a
  // real tag that happens to be empty.
  const knownTags = catalog.tags?.length
    ? catalog.tags
    : [...new Set(components.flatMap((c) => c.tags))].sort();
  if (tag !== undefined && !knownTags.includes(tag)) {
    printError(`unknown --tag "${tag}". Available: ${knownTags.join(', ')}`);
    return EXIT.USAGE;
  }

  const listed = query
    ? matchComponents(components, query, tags, limit)
    : components.filter((c) => !tags || c.tags.some((t) => tags.includes(t)));
  // `--limit` used to apply to a query only, so `urbicon find --limit 5` silently
  // listed all 98 components. Honour it in both modes — but only when it was
  // actually passed, so the documented "no query lists all" default is unchanged.
  const truncated = !query && limitRaw !== undefined ? Math.max(0, listed.length - limit) : 0;
  const results = truncated > 0 ? listed.slice(0, limit) : listed;

  // Which origin packages are actually installed here (null → no consumer context).
  const deps = readConsumerDependencies();
  const stateOf = (entry: ComponentCatalogEntry): InstallState =>
    installStateFor(entry.package, deps);

  if (asJson) {
    // Additive `installed` annotation (true/false/null) for machine consumers.
    // `propDocs` is the ranker's text, not the entry's identity — it is what
    // `get-component` prints, and inline it multiplies every result by its prop
    // count (`find button --json`: 50 KB with it, measured).
    const annotated = results.map((entry) => {
      const state = stateOf(entry);
      const { propDocs: _searchText, ...rest } = entry;
      return { ...rest, installed: state === 'unknown' ? null : state === 'installed' };
    });
    console.log(JSON.stringify(annotated, null, 2));
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
    : `${results.length} component(s)${tag ? ` tagged "${tag}"` : ''}${
        truncated > 0 ? ` (--limit ${limit}; ${truncated} more)` : ''
      }:`;
  console.log(`${header}\n`);
  for (const entry of results) {
    console.log(`${formatEntry(entry, stateOf(entry))}\n`);
  }

  // Surface dead ends: matches whose origin package isn't a dependency here.
  const missing = [
    ...new Set(results.filter((e) => stateOf(e) === 'missing').map((e) => e.package))
  ];
  if (missing.length > 0) {
    console.log(
      `⚠ Not in your dependencies: ${missing.join(', ')} — install before importing (e.g. \`bun add ${missing[0]}\`).`
    );
  }
  console.log(
    '→ `urbicon get-component <slug>` for the full API · `urbicon css-reference` for tokens.'
  );
  return EXIT.OK;
}
