import type { ApiProp } from './index.js';

/**
 * What the two reference tables share as behaviour rather than as classes:
 * which rows the API table shows, and from how many rows on either table
 * offers a search. Internal — not exported from the package.
 */

const SOURCE_PRIORITY: Record<string, number> = { direct: 3, variant: 2, inherited: 1 };

/**
 * One row per prop name. The generated data can list a name once per source (a
 * tv() axis that is also a direct prop arrives twice), so the richer source
 * wins and borrows what it lacks from the other. Anything that counts props
 * next to the table counts this, or the count and the table disagree.
 */
export function deduplicateProps(raw: readonly ApiProp[]): ApiProp[] {
  const seen: Record<string, ApiProp> = {};

  for (const prop of raw) {
    const existing = seen[prop.name];
    if (!existing) {
      seen[prop.name] = { ...prop };
      continue;
    }

    const existingP = SOURCE_PRIORITY[existing.source?.type ?? ''] ?? 0;
    const newP = SOURCE_PRIORITY[prop.source?.type ?? ''] ?? 0;

    const [winner, donor] = newP > existingP ? [prop, existing] : [existing, prop];

    seen[prop.name] = {
      ...winner,
      values: winner.type === 'boolean' ? undefined : (winner.values ?? donor.values),
      // The flag describes the values above, so it comes from whichever side gave them.
      namedType: winner.values ? winner.namedType : donor.namedType,
      defaultValue: winner.defaultValue ?? donor.defaultValue,
      description: winner.description || donor.description
    };
  }

  return Object.values(seen);
}

/** A reference table with more rows than this gets the search-and-filter bar. */
export const SEARCH_ABOVE_ROWS = 6;
