<script lang="ts">
  import Studio from '$lib/Studio.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<!--
  `{#key}`, weil das Studio den Serverzustand als Startwert übernimmt und danach
  selbst fortschreibt. Ohne den Schlüssel behielte ein Wechsel von einer Sitzung
  zur anderen (gleiche Route, andere `data`) die Versionen der vorigen.
-->
{#key data.session.id}
  <Studio session={data.session} />
{/key}
