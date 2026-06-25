/**
 * Unused-key reconciler (B3) — decide which *defined* keys no source references.
 *
 * A key counts as used if ANY usage layer reaches it, biased hard toward "used"
 * so a live key is never flagged for deletion: exact static call, dynamic-prefix
 * coverage, the loose literal-pool harvest (any string literal equal to a key),
 * an explicit dynamic-key allowlist, or a runtime-observed key. What survives all
 * layers is reported — `confirmed` when no opaque `t(variable)` site could be
 * hiding it, else `suspect`. Separately, static render keys absent from the
 * defined set surface as `used-but-undefined` (a typo / stale rename that renders
 * its raw key at runtime).
 */

import { makeGlobMatcher } from './glob';
import type { KeyUsageSite, UsageScan } from './scan/types';

export interface UnusedKeyFinding {
  key: string;
  /** `confirmed`: no usage signal and no opaque sites. `suspect`: opaque `t(var)` sites exist. */
  tier: 'confirmed' | 'suspect';
}

export interface UsedButUndefinedFinding {
  key: string;
  sites: KeyUsageSite[];
}

export interface DynamicPrefixCoverage {
  prefix: string;
  /** Defined keys this prefix shields from the unused list (no other usage signal). */
  shieldedKeys: number;
}

export interface UnusedReport {
  /** Defined keys reached by no usage layer. */
  unused: UnusedKeyFinding[];
  /** Static render keys (`t('x')`) with no matching defined key. */
  usedButUndefined: UsedButUndefinedFinding[];
  /** Per-prefix blast radius, so a human sees what each dynamic family hides. */
  dynamicPrefixCoverage: DynamicPrefixCoverage[];
  /** Count of unresolved `t(variable)` sites — why `suspect` exists. */
  opaqueSiteCount: number;
}

export interface FindUnusedOptions {
  /** Key globs (`errors.*`) built dynamically — always treated as used. */
  dynamicKeys?: string[];
  /** Key globs excluded from the report entirely (intentionally retained, e.g. `legacy.*`). */
  ignoreKeys?: string[];
  /** Keys observed at runtime (e.g. from `createMissingKeyCollector`) — treated as used. */
  runtimeUsedKeys?: Iterable<string>;
}

export function findUnusedKeys(
  definedKeys: Iterable<string>,
  scan: UsageScan,
  options: FindUnusedOptions = {}
): UnusedReport {
  const defined = new Set(definedKeys);
  const isIgnored = makeGlobMatcher(options.ignoreKeys);
  const isAllowlisted = makeGlobMatcher(options.dynamicKeys);
  const runtimeUsed = new Set(options.runtimeUsedKeys ?? []);
  const prefixes = [...new Set(scan.dynamicPrefixes.map((entry) => entry.prefix))];
  const hasOpaqueSites = scan.opaqueSites.length > 0;

  const matchesPrefix = (key: string): boolean => prefixes.some((prefix) => key.startsWith(prefix));
  const isUsed = (key: string): boolean =>
    scan.staticKeys.has(key) || // layer 1 — exact static render call
    scan.probeKeys.has(key) || //  exists() probe
    matchesPrefix(key) || //        layer 2 — dynamic-prefix coverage
    scan.literalPool.has(key) || // layer 3 — loose literal harvest
    isAllowlisted(key) || //        layer 4 — explicit dynamic allowlist
    runtimeUsed.has(key); //        layer 5 — runtime-observed

  const unused: UnusedKeyFinding[] = [];
  for (const key of defined) {
    if (isIgnored(key) || isUsed(key)) continue;
    unused.push({ key, tier: hasOpaqueSites ? 'suspect' : 'confirmed' });
  }
  unused.sort((a, b) => a.key.localeCompare(b.key));

  const usedButUndefined: UsedButUndefinedFinding[] = [];
  for (const [key, sites] of scan.staticKeys) {
    if (isIgnored(key) || isAllowlisted(key) || defined.has(key)) continue;
    usedButUndefined.push({ key, sites });
  }
  usedButUndefined.sort((a, b) => a.key.localeCompare(b.key));

  const dynamicPrefixCoverage: DynamicPrefixCoverage[] = prefixes
    .map((prefix) => ({
      prefix,
      shieldedKeys: [...defined].filter(
        (key) =>
          key.startsWith(prefix) &&
          !scan.staticKeys.has(key) &&
          !scan.literalPool.has(key) &&
          !isIgnored(key)
      ).length
    }))
    .sort((a, b) => a.prefix.localeCompare(b.prefix));

  return {
    unused,
    usedButUndefined,
    dynamicPrefixCoverage,
    opaqueSiteCount: scan.opaqueSites.length
  };
}
