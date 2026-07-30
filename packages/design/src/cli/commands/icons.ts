/**
 * `urbicon icons [query]` — icon discovery over the version-pinned bundle, the
 * local, version-correct mirror of the remote `find_icons`. With a query, ranks via
 * the shared `@urbicon-ui/design-engine/search` matcher; with none, prints the full
 * reference grouped by category. Like `find`, a query is not a gate: no matches
 * still exits 0 (only an unreadable bundle is a failure).
 */

import { ICON_CATEGORY_ORDER, type IconEntry, matchIcons } from '@urbicon-ui/design-engine/search';
import { boolFlag, type Flags, stringFlag } from '../args.js';
import { loadIconEntries } from '../content.js';
import { EXIT, printError } from '../output.js';

const USAGE_NOTE = `Usage: import { SearchIcon } from '@urbicon-ui/blocks'; → <SearchIcon size={24} />
Props: size (default 24), strokeWidth (default 2), class, rotate, flip, animation
Dynamic (via IconProvider): <Icon name="search" />`;

function formatIcon(icon: IconEntry): string {
  return `  ${icon.componentName}  ·  \`${icon.name}\`  ·  ${icon.categories.join(', ')}`;
}

export async function runIcons(positionals: string[], flags: Flags): Promise<number> {
  const query = positionals.join(' ').trim();
  const asJson = boolFlag(flags, 'json');

  const limitRaw = stringFlag(flags, 'limit');
  const limit = limitRaw === undefined ? 20 : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1) {
    printError('--limit needs a positive integer, e.g. --limit 20');
    return EXIT.USAGE;
  }

  let icons: IconEntry[];
  try {
    icons = await loadIconEntries();
  } catch (err) {
    printError(`could not read the icon metadata (${(err as Error).message}).`);
    return EXIT.FAIL;
  }

  // `--limit` used to apply to a query only, so `urbicon icons --limit 5` printed
  // all 315 icons (13.6 kB) as if no flag had been passed. Honour it in both
  // modes — but only when actually passed, so "no query prints the full
  // reference" still holds by default.
  const truncated = !query && limitRaw !== undefined ? Math.max(0, icons.length - limit) : 0;
  const listed = truncated > 0 ? icons.slice(0, limit) : icons;
  const results = query ? matchIcons(icons, query, limit) : listed;

  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
    return EXIT.OK;
  }

  if (query) {
    if (results.length === 0) {
      console.log(
        `No icons match "${query}". Try broader terms, or run \`urbicon icons\` with no query for the full reference.`
      );
      return EXIT.OK;
    }
    console.log(`${results.length} icon(s) matching "${query}":\n`);
    for (const icon of results) console.log(formatIcon(icon));
    console.log(`\n${USAGE_NOTE}`);
    return EXIT.OK;
  }

  // Full reference, grouped by category (same grouping as the remote `find_icons`).
  const byCategory = new Map<string, IconEntry[]>();
  for (const icon of listed) {
    for (const cat of icon.categories) {
      const bucket = byCategory.get(cat);
      if (bucket) bucket.push(icon);
      else byCategory.set(cat, [icon]);
    }
  }

  console.log(
    `${listed.length} icon(s)${truncated > 0 ? ` (--limit ${limit}; ${truncated} more)` : ''}:\n`
  );
  for (const cat of ICON_CATEGORY_ORDER) {
    const catIcons = byCategory.get(cat);
    if (!catIcons || catIcons.length === 0) continue;
    const sorted = [...catIcons].sort((a, b) => a.componentName.localeCompare(b.componentName));
    console.log(`${cat} (${sorted.length})`);
    for (const icon of sorted) console.log(formatIcon(icon));
    console.log('');
  }
  console.log(USAGE_NOTE);
  return EXIT.OK;
}
