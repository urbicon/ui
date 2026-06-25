import { describe, expect, it } from 'vitest';
import type { KeyUsageSite, UsageScan } from './scan/types';
import { findUnusedKeys } from './unused';

const site: KeyUsageSite = { file: 'a.ts', line: 1, context: '' };

/** Build a UsageScan literal for reconciler-only tests (no real scanning). */
function scanOf(partial: Partial<UsageScan>): UsageScan {
  return {
    staticKeys: new Map(),
    probeKeys: new Set(),
    dynamicPrefixes: [],
    opaqueSites: [],
    literalPool: new Set(),
    ...partial
  };
}

const DEFINED = ['used.key', 'probed.key', 'data.key', 'errors.timeout', 'orphan.key'];

const BASE_SCAN = scanOf({
  staticKeys: new Map([
    ['used.key', [site]],
    ['typo.key', [site]] // not defined → used-but-undefined
  ]),
  probeKeys: new Set(['probed.key']),
  dynamicPrefixes: [{ prefix: 'errors.', site }],
  literalPool: new Set(['data.key'])
});

describe('findUnusedKeys — usage layers', () => {
  it('treats a key as used if any layer reaches it; only the orphan is unused', () => {
    const report = findUnusedKeys(DEFINED, BASE_SCAN);
    expect(report.unused.map((u) => u.key)).toEqual(['orphan.key']);
  });

  it('marks the unused key confirmed when there are no opaque sites', () => {
    const report = findUnusedKeys(DEFINED, BASE_SCAN);
    expect(report.unused[0]?.tier).toBe('confirmed');
  });

  it('downgrades unused keys to suspect when opaque t(variable) sites exist', () => {
    const report = findUnusedKeys(DEFINED, scanOf({ ...BASE_SCAN, opaqueSites: [site] }));
    expect(report.unused[0]?.tier).toBe('suspect');
    expect(report.opaqueSiteCount).toBe(1);
  });
});

describe('findUnusedKeys — used-but-undefined', () => {
  it('reports a static render key with no matching defined key', () => {
    const report = findUnusedKeys(DEFINED, BASE_SCAN);
    expect(report.usedButUndefined.map((u) => u.key)).toEqual(['typo.key']);
  });

  it('never treats an exists() probe key as used-but-undefined', () => {
    const report = findUnusedKeys([], scanOf({ probeKeys: new Set(['intentionally.absent']) }));
    expect(report.usedButUndefined).toEqual([]);
  });
});

describe('findUnusedKeys — options', () => {
  it('honours an explicit dynamic-key allowlist', () => {
    const report = findUnusedKeys(DEFINED, BASE_SCAN, { dynamicKeys: ['orphan.*'] });
    expect(report.unused).toEqual([]);
  });

  it('drops ignored keys from both unused and used-but-undefined', () => {
    const report = findUnusedKeys(DEFINED, BASE_SCAN, { ignoreKeys: ['orphan.key', 'typo.*'] });
    expect(report.unused).toEqual([]);
    expect(report.usedButUndefined).toEqual([]);
  });

  it('counts runtime-observed keys as used', () => {
    const report = findUnusedKeys(DEFINED, BASE_SCAN, { runtimeUsedKeys: ['orphan.key'] });
    expect(report.unused).toEqual([]);
  });

  it('ignores an empty prefix so it cannot shield every key', () => {
    const report = findUnusedKeys(
      ['a.unused'],
      scanOf({ dynamicPrefixes: [{ prefix: '', site }] })
    );
    expect(report.unused.map((u) => u.key)).toEqual(['a.unused']);
  });
});

describe('findUnusedKeys — diagnostics', () => {
  it('reports each dynamic prefix and how many defined keys it shields', () => {
    const report = findUnusedKeys(DEFINED, BASE_SCAN);
    const coverage = report.dynamicPrefixCoverage.find((c) => c.prefix === 'errors.');
    expect(coverage?.shieldedKeys).toBe(1); // errors.timeout
  });
});
