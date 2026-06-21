import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runVerb, runVerbList } from './verb.js';

const VERB_NAMES = [
  'onboard',
  'adopt',
  'compose',
  'redesign',
  'polish',
  'critique',
  'fix',
  'retheme',
  'audit',
  'migrate'
];

describe('urbicon verb / verbs', () => {
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('lists every verb with its purpose (exit 0)', async () => {
    expect(await runVerbList([], {})).toBe(0);
    const out = log.mock.calls.map((c: unknown[]) => c[0]).join('\n');
    for (const name of VERB_NAMES) expect(out, name).toContain(name);
  });

  it('prints a known recipe body (exit 0)', async () => {
    expect(await runVerb(['compose'], {})).toBe(0);
    const out = log.mock.calls.map((c: unknown[]) => c[0]).join('\n');
    expect(out).toContain('# compose');
    expect(out).toContain('manifest'); // every recipe opens by reading the manifest
  });

  it('rejects a missing verb name (exit 2)', async () => {
    expect(await runVerb([], {})).toBe(2);
  });

  it('rejects an unknown verb (exit 2)', async () => {
    expect(await runVerb(['does-not-exist'], {})).toBe(2);
  });

  it('rejects an unsafe name before any filesystem access (exit 2)', async () => {
    // `../…` must not become a path read — the SAFE_VERB guard catches it.
    expect(await runVerb(['../secret'], {})).toBe(2);
    expect(await runVerb(['foo/bar'], {})).toBe(2);
  });
});
