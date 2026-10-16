<script lang="ts">
  import I18nProvider from '../../components/I18nProvider.svelte';
  import BaseLocaleChild from './BaseLocaleChild.svelte';
  import type { Locale } from '../types';

  let { locale }: { locale?: Locale } = $props();
</script>

{#if locale}
  <I18nProvider {locale}>
    <BaseLocaleChild />
  </I18nProvider>
{:else}
  <BaseLocaleChild />
{/if}
