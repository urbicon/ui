<script lang="ts">
  import I18nProvider from '../../components/I18nProvider.svelte';
  import SsrChild from './SsrChild.svelte';
  import type { Locale } from '../types';

  let { locale }: { locale?: Locale } = $props();
</script>

{#if locale}
  <I18nProvider {locale}>
    <SsrChild />
  </I18nProvider>
{:else}
  <SsrChild />
{/if}
