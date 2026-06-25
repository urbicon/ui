import { afterEach, describe, expect, it } from 'vitest';
import { configureI18n } from '$lib/i18n/context.svelte';
import { createPackageI18n } from '$lib/i18n/package-integration';
import { getRegistry } from '$lib/i18n/registry.svelte';
import { createMissingKeyCollector } from './missing-key-collector';

// Registered once; the registry is module-global but vitest isolates per file.
// Misses are driven through `registry.translate` directly — the typed `pkg.t`
// rejects unknown keys at compile time, which is exactly what we want to bypass
// when exercising the resolve-nowhere path.
const pkg = createPackageI18n('mk-test', {
  en: { greeting: 'Hi', items: '{{count}} items' }
});
const opts = { packageName: 'mk-test' } as const;

afterEach(() => {
  configureI18n({ onMissingKey: undefined });
});

describe('onMissingKey + createMissingKeyCollector', () => {
  it('records a key that resolves nowhere, with its package scope', () => {
    const misses = createMissingKeyCollector();
    configureI18n({ onMissingKey: misses.onMissingKey });

    const registry = getRegistry();
    expect(registry.translate('totally.absent', 'en', 'en', undefined, opts)).toBe(
      'totally.absent'
    );
    const report = misses.report();
    expect(report).toHaveLength(1);
    expect(report[0]).toMatchObject({ key: 'totally.absent', packageName: 'mk-test', count: 1 });
    expect(misses.isClean()).toBe(false);
  });

  it('does not fire for a key that resolves', () => {
    const misses = createMissingKeyCollector();
    configureI18n({ onMissingKey: misses.onMissingKey });

    expect(pkg.t('greeting')).toBe('Hi');
    expect(misses.isClean()).toBe(true);
  });

  it('counts repeated misses of the same key once, with a hit count', () => {
    const misses = createMissingKeyCollector();
    configureI18n({ onMissingKey: misses.onMissingKey });

    const registry = getRegistry();
    registry.translate('absent.one', 'en', 'en', undefined, opts);
    registry.translate('absent.one', 'en', 'en', undefined, opts);
    registry.translate('absent.two', 'en', 'en', undefined, opts);
    const report = misses.report();
    expect(report.map((r) => r.key)).toEqual(['absent.one', 'absent.two']);
    expect(report.find((r) => r.key === 'absent.one')?.count).toBe(2);
  });

  it('does NOT report the optional _plural probe as a miss, but does report a missing base key', () => {
    const misses = createMissingKeyCollector();
    configureI18n({ onMissingKey: misses.onMissingKey });
    const registry = getRegistry();

    // `items` exists but has no `items_plural` object — the probe must stay silent.
    registry.pluralize('items', { count: 2 }, 'en', 'en', opts);
    expect(misses.report().some((r) => r.key === 'items_plural')).toBe(false);
    expect(misses.report().some((r) => r.key === 'items')).toBe(false);

    // A genuinely absent base key still reports (only the `_plural` suffix is suppressed).
    registry.pluralize('ghost', { count: 1 }, 'en', 'en', opts);
    const keys = misses.report().map((r) => r.key);
    expect(keys).toContain('ghost');
    expect(keys).not.toContain('ghost_plural');
  });
});
