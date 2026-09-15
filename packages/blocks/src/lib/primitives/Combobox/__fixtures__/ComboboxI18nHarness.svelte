<script lang="ts">
  // Test-only harness that mounts a Combobox under a request-scoped i18n state,
  // so a suite can read a row the component translates itself (the allowCustom
  // row) in a locale other than the base one. `provideI18n` is the primitive
  // behind <I18nProvider>; the caller eager-registers the locale bundle
  // (registerBlocksLocale) so resolution is synchronous instead of waiting for
  // the lazy chunk. Under __fixtures__/ so it is excluded from the published
  // package and never collected as a test.
  import { provideI18n } from '@urbicon-ui/i18n';
  import type { Locale } from '@urbicon-ui/i18n';
  import Combobox from '../Combobox.svelte';
  import type { ComboboxSingleProps } from '../index';

  type V = string | number | boolean;

  let {
    locale = 'en',
    ...props
  }: ComboboxSingleProps<V> & {
    locale?: Locale;
  } = $props();

  // Read once at init on purpose: provideI18n must run during component setup,
  // and the harness never re-points `locale` after mount.
  // svelte-ignore state_referenced_locally
  provideI18n(locale);
</script>

<Combobox {...props} />
