<script lang="ts" module>
  import type { Locale } from '@urbicon-ui/i18n';
  import { registerBlocksLocale } from '#lib/i18n/index.js';
  import en from '#lib/translations/en.js';

  /**
   * Registers `fr` with every `chart` string set to its English one behind a
   * `fr:` marker, and returns it. Derived from `en`, so each key differs from
   * English — a real catalog may legitimately match it ("Segment" in `de`) —
   * and a header that reads `fr:…` can only have come through the active
   * locale. `fr` ships no blocks bundle, so nothing real is overridden.
   */
  export function registerMarkedLocale(): Locale {
    const chart = Object.fromEntries(
      Object.entries(en.chart).map(([key, text]) => [key, `fr:${text}`])
    );
    registerBlocksLocale('fr', { chart });
    return 'fr';
  }
</script>

<script lang="ts">
  // A chart mounted under a request-scoped i18n state, so a test reads the
  // strings a chart translates itself — the data-table headers, the names of
  // unnamed series — in a locale other than the base one. The caller registers
  // the bundle first (`registerMarkedLocale`): `fr` has no loader, so without it
  // every string resolves to English.
  import { provideI18n } from '@urbicon-ui/i18n';
  import type { Component } from 'svelte';

  let {
    locale,
    chart: Chart,
    props
  }: {
    locale: Locale;
    // `any`: Component checks its props parameter contravariantly, so
    // `Component<BarChartProps>` is no `Component<Record<string, unknown>>`
    // and no one concrete type takes all four charts. The caller types `props`.
    chart: Component<any>;
    props: Record<string, unknown>;
  } = $props();

  // provideI18n must run during setup, and no test re-points the locale after mount.
  // svelte-ignore state_referenced_locally
  provideI18n(locale);
</script>

<Chart {...props} />
