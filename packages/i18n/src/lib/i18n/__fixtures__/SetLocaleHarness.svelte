<script lang="ts">
  import I18nProvider from '../../components/I18nProvider.svelte';
  import SetLocaleChild from './SetLocaleChild.svelte';

  let { provide }: { provide?: boolean } = $props();
</script>

{#if provide}
  <I18nProvider locale="en">
    <SetLocaleChild />
  </I18nProvider>
{:else}
  <SetLocaleChild />
{/if}
