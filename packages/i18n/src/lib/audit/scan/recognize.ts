/**
 * AST-agnostic recognition heuristics + small source helpers shared by both
 * walkers. The crux of B1 (which calls are translation calls) lives here so the
 * TypeScript and Svelte walkers stay thin.
 */

import type { ExtractedKey, KeyUsageSite, UsageScan } from './types';

// A factory hook whose result is (or yields) a translate function: the global
// `useI18n` / `useTranslate`, plus the per-package re-exports consumers make
// (`useBlocksI18n`, `useTableI18n`, `useFooTranslate`). Matching by this naming
// convention is what lets the scanner discover arbitrarily-named local aliases.
const FACTORY_RE = /^use([A-Z]\w*)?(I18n|Translate)$/;
export function isFactoryName(name: string): boolean {
  return FACTORY_RE.test(name);
}

const RENDER_METHODS = new Set(['t', 'plural', 'translate']);
const PROBE_METHODS = new Set(['exists']);
export function isRenderMethod(name: string): boolean {
  return RENDER_METHODS.has(name);
}
export function isProbeMethod(name: string): boolean {
  return PROBE_METHODS.has(name);
}
export function isKeyMethod(name: string): boolean {
  return RENDER_METHODS.has(name) || PROBE_METHODS.has(name);
}

/** Bare identifiers that are always translation render-calls, even without a binding. */
const DEFAULT_RENDER_IDENTIFIERS = ['t', '$t'];

/** File-local identifiers bound to a translate function, split render vs probe. */
export interface Bindings {
  render: Set<string>;
  probe: Set<string>;
}
export function createBindings(extra: string[] = []): Bindings {
  return { render: new Set([...DEFAULT_RENDER_IDENTIFIERS, ...extra]), probe: new Set() };
}

export function createScan(): UsageScan {
  return {
    staticKeys: new Map(),
    probeKeys: new Set(),
    dynamicPrefixes: [],
    opaqueSites: [],
    literalPool: new Set()
  };
}

/** Route one call's extracted keys into the scan; an empty extraction is an opaque site. */
export function recordKeyCall(
  scan: UsageScan,
  extractions: ExtractedKey[],
  site: KeyUsageSite,
  isProbe: boolean
): void {
  if (extractions.length === 0) {
    scan.opaqueSites.push(site);
    return;
  }
  for (const extracted of extractions) {
    if (extracted.kind === 'static') {
      if (isProbe) {
        scan.probeKeys.add(extracted.value);
      } else {
        const sites = scan.staticKeys.get(extracted.value);
        if (sites) sites.push(site);
        else scan.staticKeys.set(extracted.value, [site]);
      }
    } else if (extracted.kind === 'prefix') {
      scan.dynamicPrefixes.push({ prefix: extracted.prefix, site });
    } else {
      scan.opaqueSites.push(site);
    }
  }
}

/** Combine per-file scans into one. */
export function mergeScans(scans: UsageScan[]): UsageScan {
  const merged = createScan();
  for (const scan of scans) {
    for (const [key, sites] of scan.staticKeys) {
      const existing = merged.staticKeys.get(key);
      if (existing) existing.push(...sites);
      else merged.staticKeys.set(key, [...sites]);
    }
    for (const key of scan.probeKeys) merged.probeKeys.add(key);
    merged.dynamicPrefixes.push(...scan.dynamicPrefixes);
    merged.opaqueSites.push(...scan.opaqueSites);
    for (const literal of scan.literalPool) merged.literalPool.add(literal);
  }
  return merged;
}

/** A fast 1-based line lookup from a character offset, precomputed once per file. */
export function makeLineAt(code: string): (offset: number) => number {
  const starts = [0];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '\n') starts.push(i + 1);
  }
  return (offset: number) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

/** The trimmed text of a 1-based line, for report context. */
export function makeContextAt(code: string): (line: number) => string {
  const lines = code.split('\n');
  return (line: number) => (lines[line - 1] ?? '').trim();
}
