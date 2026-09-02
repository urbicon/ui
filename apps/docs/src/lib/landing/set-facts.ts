/**
 * Aggregate facts about the set itself, for the examples that would otherwise
 * invent data.
 *
 * The landing concept asks demos to be **self-referential** — what describes
 * itself cannot drift into fiction — but a Sankey of "Source A → Pot → Sink X"
 * says nothing about anything. These are the numbers such a demo can stand on.
 *
 * **Why hand-written rather than derived at run time:** the catalogues are
 * `apps/docs/static/*_catalog.json`, 153 KB for blocks alone. A route can read
 * them at build time (`+page.server.ts`, prerendered — see the landing loader),
 * but a playground is a *component*, shared by a docs page and the hero, and an
 * import from one would put the whole catalogue in the client bundle. So the
 * handful of numbers lives here as source, and `set-facts.test.ts` recomputes
 * them from those same catalogues on every test run: they cannot drift silently,
 * they just fail loudly.
 */

/** One package's share of the set, split by how far along its components are. */
export interface PackageMaturity {
  /** Short package name, as the catalogue records it. */
  pkg: 'blocks' | 'table' | 'auth';
  stable: number;
  beta: number;
  experimental: number;
}

/**
 * Components per package and maturity. Mirrors the hero's rule: anything
 * without an explicit `@stability` tag counts as stable.
 */
export const SET_MATURITY: PackageMaturity[] = [
  { pkg: 'blocks', stable: 53, beta: 19, experimental: 12 },
  { pkg: 'auth', stable: 9, beta: 5, experimental: 0 },
  { pkg: 'table', stable: 1, beta: 0, experimental: 0 }
];

/** Every component in the set, across all three packages. */
export const SET_TOTAL = SET_MATURITY.reduce(
  (sum, p) => sum + p.stable + p.beta + p.experimental,
  0
);

/** How far along one family is. `family` is the catalogue's first tag. */
export interface FamilyMaturity {
  family: string;
  /** Shipped without a `@stability` caveat. */
  settled: number;
  /** Still `beta` or `experimental`. */
  inProgress: number;
}

/**
 * Components per family, largest first — the six-family taxonomy as the
 * catalogue actually tags it, which is nine buckets rather than six.
 *
 * Carries a real statement, which is why it is worth a demo: most of the form
 * family has settled, while every component tagged `ai` is still moving.
 */
export const SET_FAMILIES: FamilyMaturity[] = [
  { family: 'form', settled: 19, inProgress: 6 },
  { family: 'display', settled: 8, inProgress: 9 },
  { family: 'feedback', settled: 10, inProgress: 1 },
  { family: 'ai', settled: 0, inProgress: 10 },
  { family: 'layout', settled: 7, inProgress: 3 },
  { family: 'navigation', settled: 6, inProgress: 2 },
  { family: 'overlay', settled: 4, inProgress: 4 },
  { family: 'action', settled: 7, inProgress: 1 },
  { family: 'data', settled: 2, inProgress: 0 }
];

/** One edge of the three-stage flow: package → family, or family → maturity. */
export interface SetFlowEdge {
  source: string;
  target: string;
  count: number;
}

/**
 * Package → family. The first half of the three-stage flow.
 *
 * Two stages (package → maturity) could not carry a `nodeAlign` demo — measured
 * in `layout.test.ts`, neither can three, because layering takes the longest
 * path and every sink already sits last. The third stage earns its place for a
 * different reason: it is where the set says something about itself. `ai` is one
 * package's ten components and all ten are still moving; `form` is the widest
 * family and most of it has settled.
 */
export const SET_PACKAGE_FAMILY: SetFlowEdge[] = [
  { source: 'blocks', target: 'form', count: 17 },
  { source: 'blocks', target: 'display', count: 16 },
  { source: 'blocks', target: 'ai', count: 10 },
  { source: 'blocks', target: 'layout', count: 10 },
  { source: 'blocks', target: 'action', count: 8 },
  { source: 'blocks', target: 'navigation', count: 8 },
  { source: 'blocks', target: 'overlay', count: 8 },
  { source: 'blocks', target: 'feedback', count: 7 },
  { source: 'auth', target: 'form', count: 8 },
  { source: 'auth', target: 'feedback', count: 4 },
  { source: 'auth', target: 'display', count: 1 },
  { source: 'auth', target: 'data', count: 1 },
  { source: 'table', target: 'data', count: 1 }
];

/** Family → maturity. The second half; the same components, split again. */
export const SET_FAMILY_MATURITY: SetFlowEdge[] = [
  { source: 'form', target: 'stable', count: 19 },
  { source: 'form', target: 'beta', count: 6 },
  { source: 'display', target: 'beta', count: 9 },
  { source: 'display', target: 'stable', count: 8 },
  { source: 'ai', target: 'experimental', count: 10 },
  { source: 'layout', target: 'stable', count: 7 },
  { source: 'layout', target: 'experimental', count: 2 },
  { source: 'layout', target: 'beta', count: 1 },
  { source: 'action', target: 'stable', count: 7 },
  { source: 'action', target: 'beta', count: 1 },
  { source: 'navigation', target: 'stable', count: 6 },
  { source: 'navigation', target: 'beta', count: 2 },
  { source: 'overlay', target: 'stable', count: 4 },
  { source: 'overlay', target: 'beta', count: 4 },
  { source: 'feedback', target: 'stable', count: 10 },
  { source: 'feedback', target: 'beta', count: 1 },
  { source: 'data', target: 'stable', count: 2 }
];

/** The set by maturity, ignoring which package a component ships in. */
export const SET_BY_MATURITY = {
  stable: SET_MATURITY.reduce((sum, p) => sum + p.stable, 0),
  beta: SET_MATURITY.reduce((sum, p) => sum + p.beta, 0),
  experimental: SET_MATURITY.reduce((sum, p) => sum + p.experimental, 0)
};
