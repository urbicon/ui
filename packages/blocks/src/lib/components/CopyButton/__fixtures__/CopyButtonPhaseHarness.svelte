<!--
  Real `children` snippet for CopyButton, which `createRawSnippet` cannot stand
  in for: a raw snippet renders its string once and never reads the parameter
  again, so the phase argument looks static even when it is not. A compiled
  snippet re-renders on the dependency, which is exactly what this asserts.
-->
<script lang="ts">
  import CopyButton from '../CopyButton.svelte';

  let { value = 'copied text' }: { value?: string } = $props();
</script>

<CopyButton {value}>
  {#snippet children(phase)}
    <span data-testid="phase">{phase}</span>
  {/snippet}
</CopyButton>
