<script lang="ts">
  // A Progress mounted under a request-scoped i18n state, so a suite reads the
  // value text it formats itself in a locale other than the base one. Number
  // formatting reads only the locale, so no translation bundle has to be
  // registered first.
  import { provideI18n } from '@urbicon-ui/i18n';
  import type { Locale } from '@urbicon-ui/i18n';
  import Progress from '../Progress.svelte';
  import type { ProgressProps } from '../index';

  let { locale, ...props }: ProgressProps & { locale: Locale } = $props();

  // Read once at init on purpose: provideI18n must run during component setup,
  // and the harness never re-points `locale` after mount.
  // svelte-ignore state_referenced_locally
  provideI18n(locale);
</script>

<Progress {...props} />
