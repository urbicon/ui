<script lang="ts">
  // Test-only harness for the DatePicker/DateRangePicker locale chain. Both resolve
  // `locale="auto"` through `useI18n()`, which reads the request-scoped I18nState from
  // context — so proving the chain needs a parent that installs one. `provideI18n` is
  // the primitive behind <I18nProvider>; leaving `initialLocale` undefined mounts NO
  // provider, which is the case where the library must fall back to the base locale.
  //
  // `which` picks the component so both live under one fixture: their locale handling is
  // the same code path (the file pair is kept in deliberate mirror), and a second harness
  // would just be a place for the two to drift.
  import { provideI18n } from '@urbicon-ui/i18n';
  import type { Locale } from '@urbicon-ui/i18n';
  import DatePicker from '../DatePicker.svelte';
  import DateRangePicker from '../DateRangePicker.svelte';

  let {
    initialLocale,
    which = 'single',
    ...props
  }: Record<string, unknown> & {
    /** Locale for the surrounding provider. `undefined` mounts no provider. */
    initialLocale?: Locale;
    which?: 'single' | 'range';
  } = $props();

  // provideI18n must run during component setup; each test mounts its own harness
  // rather than re-pointing this after mount.
  // svelte-ignore state_referenced_locally
  if (initialLocale) provideI18n(initialLocale);
</script>

{#if which === 'range'}
  <DateRangePicker {...props} />
{:else}
  <DatePicker {...props} />
{/if}
