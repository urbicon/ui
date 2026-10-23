<script lang="ts">
  import I18nProvider from '../../components/I18nProvider.svelte';
  import type { Locale } from '../types';
  import SsrChild from './SsrChild.svelte';

  let { locale }: { locale?: Locale } = $props();
</script>

{#if locale}
  <I18nProvider {locale}>
    <SsrChild />
  </I18nProvider>
{:else}
  <SsrChild />
{/if}
