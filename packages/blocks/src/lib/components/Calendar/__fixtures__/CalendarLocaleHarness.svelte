<script lang="ts">
  // Test-only harness for the Calendar locale chain. Calendar resolves `locale="auto"` through
  // useI18n(), which reads the request-scoped I18nState from context — so proving the chain needs a
  // parent that installs one. `provideI18n` is the primitive behind <I18nProvider>; passing
  // `initialLocale` undefined mounts NO provider at all, which is the third case under test (the
  // library must then fall back to the base locale rather than to a hardcoded tag).
  //
  // Under __fixtures__/ so it is excluded from the published package and never collected as a test.
  import { provideI18n } from '@urbicon-ui/i18n';
  import type { Locale } from '@urbicon-ui/i18n';
  import Calendar from '../Calendar.svelte';
  import type { CalendarProps } from '../index';

  let {
    initialLocale,
    ...props
  }: CalendarProps & {
    /** Locale for the surrounding provider. `undefined` mounts no provider. */
    initialLocale?: Locale;
  } = $props();

  // provideI18n must run during component setup, and the harness never re-points initialLocale
  // after mount — the tests mount one harness per case instead.
  // svelte-ignore state_referenced_locally
  if (initialLocale) provideI18n(initialLocale);
</script>

<Calendar {...props} />
