import { describe, expect, it } from 'vitest';
import authCatalog from '../../../static/auth/_catalog.json';
import blocksCatalog from '../../../static/blocks/_catalog.json';
import tableCatalog from '../../../static/table/_catalog.json';
import {
  SET_BY_MATURITY,
  SET_FAMILIES,
  SET_FAMILY_MATURITY,
  SET_MATURITY,
  SET_PACKAGE_FAMILY,
  SET_TOTAL
} from './set-facts';

/**
 * The guard that lets `set-facts.ts` be plain source instead of a build
 * artefact: it recomputes every number from the generated catalogues. A
 * component that ships, or one whose `@stability` tag changes, turns this red
 * — which is the whole point, since a self-referential demo that quietly
 * describes last month's set is worse than one that admits it is made up.
 *
 * Needs `bun run docs:gen:all` in a fresh worktree — `_catalog.json` is a
 * git-ignored artefact, the same prerequisite every doc page's `api.ts` has.
 */

type CatalogEntry = { stability?: string; tags?: string[] };

/** Same rule as the hero's `toStatus`: no tag means stable. */
function tally(catalog: CatalogEntry[]) {
  const counts = { stable: 0, beta: 0, experimental: 0 };
  for (const entry of catalog) {
    if (entry.stability === 'beta') counts.beta += 1;
    else if (entry.stability === 'experimental') counts.experimental += 1;
    else counts.stable += 1;
  }
  return counts;
}

const CATALOGS = {
  blocks: blocksCatalog as CatalogEntry[],
  table: tableCatalog as CatalogEntry[],
  auth: authCatalog as CatalogEntry[]
};

describe('SET_MATURITY', () => {
  it('covers every package the catalogues ship', () => {
    expect(SET_MATURITY.map((p) => p.pkg).sort()).toEqual(Object.keys(CATALOGS).sort());
  });

  for (const [pkg, catalog] of Object.entries(CATALOGS)) {
    it(`matches the ${pkg} catalogue`, () => {
      const declared = SET_MATURITY.find((p) => p.pkg === pkg);
      expect(declared, `no SET_MATURITY entry for ${pkg}`).toBeDefined();
      const { stable, beta, experimental } = tally(catalog);
      expect({
        stable: declared?.stable,
        beta: declared?.beta,
        experimental: declared?.experimental
      }).toEqual({ stable, beta, experimental });
    });
  }

  it('sums to the size of the whole set', () => {
    const shipped = Object.values(CATALOGS).reduce((sum, c) => sum + c.length, 0);
    expect(SET_TOTAL).toBe(shipped);
  });

  it('splits the same total by maturity alone', () => {
    const { stable, beta, experimental } = SET_BY_MATURITY;
    expect(stable + beta + experimental).toBe(SET_TOTAL);
  });
});

describe('SET_FAMILIES', () => {
  // Same fallback the hero's row builder uses for an untagged component.
  const byFamily = new Map<string, { settled: number; inProgress: number }>();
  for (const entry of Object.values(CATALOGS).flat()) {
    const family = entry.tags?.[0] ?? 'form';
    const bucket = byFamily.get(family) ?? { settled: 0, inProgress: 0 };
    const moving = entry.stability === 'beta' || entry.stability === 'experimental';
    bucket[moving ? 'inProgress' : 'settled'] += 1;
    byFamily.set(family, bucket);
  }

  it('lists every family the catalogues tag, and no invented one', () => {
    expect(SET_FAMILIES.map((f) => f.family).sort()).toEqual([...byFamily.keys()].sort());
  });

  it('matches the per-family counts', () => {
    for (const declared of SET_FAMILIES) {
      expect({ family: declared.family, ...byFamily.get(declared.family) }).toEqual({
        family: declared.family,
        settled: declared.settled,
        inProgress: declared.inProgress
      });
    }
  });

  it('is ordered largest first, so a chart reads without re-sorting', () => {
    const sizes = SET_FAMILIES.map((f) => f.settled + f.inProgress);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });

  it('accounts for every component exactly once', () => {
    const total = SET_FAMILIES.reduce((sum, f) => sum + f.settled + f.inProgress, 0);
    expect(total).toBe(SET_TOTAL);
  });
});

describe('the three-stage flow', () => {
  /** Every component as `[package, family, maturity]`, from the catalogues. */
  const components = Object.entries(CATALOGS).flatMap(([pkg, catalog]) =>
    catalog.map((entry) => ({
      pkg,
      family: entry.tags?.[0] ?? 'form',
      maturity:
        entry.stability === 'beta' || entry.stability === 'experimental'
          ? entry.stability
          : 'stable'
    }))
  );

  /** `source|target` → count, so an edge list compares as a plain map. */
  function edgeMap(pairs: { source: string; target: string }[]) {
    const map: Record<string, number> = {};
    for (const { source, target } of pairs) {
      map[`${source}|${target}`] = (map[`${source}|${target}`] ?? 0) + 1;
    }
    return map;
  }

  function declaredMap(edges: { source: string; target: string; count: number }[]) {
    return Object.fromEntries(edges.map((e) => [`${e.source}|${e.target}`, e.count]));
  }

  it('matches package → family against the catalogues', () => {
    expect(declaredMap(SET_PACKAGE_FAMILY)).toEqual(
      edgeMap(components.map((c) => ({ source: c.pkg, target: c.family })))
    );
  });

  it('matches family → maturity against the catalogues', () => {
    expect(declaredMap(SET_FAMILY_MATURITY)).toEqual(
      edgeMap(components.map((c) => ({ source: c.family, target: c.maturity })))
    );
  });

  it('conserves the set across both stages', () => {
    const intoFamilies = SET_PACKAGE_FAMILY.reduce((sum, e) => sum + e.count, 0);
    const outOfFamilies = SET_FAMILY_MATURITY.reduce((sum, e) => sum + e.count, 0);
    expect(intoFamilies).toBe(SET_TOTAL);
    expect(outOfFamilies).toBe(SET_TOTAL);
  });

  it('has no family that only one half of the flow knows about', () => {
    const incoming = new Set(SET_PACKAGE_FAMILY.map((e) => e.target));
    const outgoing = new Set(SET_FAMILY_MATURITY.map((e) => e.source));
    expect([...incoming].sort()).toEqual([...outgoing].sort());
  });
});
