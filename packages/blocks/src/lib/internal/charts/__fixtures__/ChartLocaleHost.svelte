<script lang="ts">
  // A chart mounted under a request-scoped i18n state, so a test reads the
  // strings a chart translates itself — the data-table headers, the names of
  // unnamed series — in a locale other than the base one. The caller
  // eager-registers the bundle (`registerBlocksLocale`), so resolution is
  // synchronous instead of waiting for the lazy chunk.
  import { type Locale, provideI18n } from '@urbicon-ui/i18n';
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
