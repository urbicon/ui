<script lang="ts">
  // Test-only harness for LocaleSwitcher — it reads the active locale via useI18n() and calls the
  // write-strict setLocale(), which throws without an <I18nProvider>. provideI18n (the primitive
  // behind <I18nProvider>) installs the request-scoped I18nState on this harness's context, so the
  // child LocaleSwitcher reads it; `onReady` hands the state back so the test can assert a selection
  // actually moved the locale (setLocale), not just fired the callback. Under __fixtures__/ so it is
  // excluded from the published package and never collected as a test file.
  import { provideI18n } from '@urbicon-ui/i18n';
  import type { Locale } from '@urbicon-ui/i18n';
  import LocaleSwitcher from '../LocaleSwitcher.svelte';
  import type { LocaleSwitcherProps } from '../index';

  let {
    initialLocale = 'en',
    onReady,
    ...props
  }: LocaleSwitcherProps & {
    initialLocale?: Locale;
    onReady?: (state: ReturnType<typeof provideI18n>) => void;
  } = $props();

  // Read once at init on purpose: provideI18n must run during component setup, and the harness
  // never re-points initialLocale/onReady after mount (setLocale drives locale changes instead).
  // svelte-ignore state_referenced_locally
  const state = provideI18n(initialLocale);
  // svelte-ignore state_referenced_locally
  onReady?.(state);
</script>

<LocaleSwitcher {...props} />
