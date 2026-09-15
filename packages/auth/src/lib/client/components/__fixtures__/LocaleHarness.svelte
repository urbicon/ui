<!--
  Test fixture: any one auth component inside an `<I18nProvider>`, so the locale
  half of its contract can be driven from a test. `useAuthLocale` reads the
  provider's locale out of context, and context only flows downward, so a
  `mount()` of the component alone always sees the default locale. Not part of
  the published package (package.json `files` excludes `__fixtures__`).
-->
<script lang="ts">
  import { I18nProvider, type Locale } from '@urbicon-ui/i18n';
  import type { Component } from 'svelte';

  let {
    component: Subject,
    componentProps = {},
    locale = 'en'
  }: {
    component: Component<Record<string, unknown>>;
    componentProps?: Record<string, unknown>;
    locale?: Locale;
  } = $props();
</script>

<I18nProvider {locale}>
  <Subject {...componentProps} />
</I18nProvider>
